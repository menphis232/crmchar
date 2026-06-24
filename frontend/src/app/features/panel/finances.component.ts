import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideBarChart3,
  LucideCalendar,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClipboardList,
  LucideCreditCard,
  LucideFileText,
  LucideInbox,
  LucidePin,
  LucidePlus,
  LucideSave,
  LucideScale,
  LucideSettings,
  LucideTrash2,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideTriangleAlert,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { FinancesService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { FinDashboard, FinTransaction, FIN_ALL_METHODS, FinFilterOptions } from '../../models';
import {
  buildActiveFormMethods,
  buildFinPaymentMethodsPayload,
  finPaymentMethodLabel,
  FinPaymentMethodOption,
  parseFinPaymentMethods,
} from '../../shared/fin-payment-methods.utils';
import { formatMoney } from '../../shared/format-amount.util';

@Component({
  selector: 'app-finances',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, LucideWallet, LucideBarChart3, LucideFileText, LucidePlus, LucideTrendingUp, LucideTrendingDown, LucideScale, LucideCalendar, LucideCreditCard, LucideClipboardList, LucideSettings, LucideX, LucideInbox, LucideTrash2, LucideSave, LucideTriangleAlert, LucideArrowUp, LucideArrowDown, LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="fin-wrap">

      <!-- ── HEADER ── -->
      <div class="fin-header">
        <div>
          <h2 class="fin-title fin-title-with-icon">
            <svg lucideWallet [size]="22" aria-hidden="true"></svg>
            Módulo de Finanzas
          </h2>
          <p class="fin-sub">Controla tus ingresos y gastos en un solo lugar</p>
        </div>
        <div class="fin-header-actions">
          <button class="btn-export csv btn-with-icon" (click)="doExportCsv()" title="Exportar CSV">
            <svg lucideBarChart3 [size]="16" aria-hidden="true"></svg>
            Exportar CSV
          </button>
          <button class="btn-export pdf btn-with-icon" (click)="doExportPdf()" title="Exportar PDF">
            <svg lucideFileText [size]="16" aria-hidden="true"></svg>
            Exportar PDF
          </button>
          <button class="btn-new btn-with-icon" (click)="openForm()">
            <svg lucidePlus [size]="16" aria-hidden="true"></svg>
            Nueva transacción
          </button>
        </div>
      </div>

      <!-- ── FILTROS DE FECHA ── -->
      <div class="filter-bar">
        <div class="date-inputs">
          <label>Desde</label>
          <input type="date" [(ngModel)]="filterFrom" (change)="onDateChange()">
          <label>Hasta</label>
          <input type="date" [(ngModel)]="filterTo" (change)="onDateChange()">
        </div>
        <div class="quick-btns">
          <button (click)="setRange('today')" [class.active]="quickRange === 'today'">Hoy</button>
          <button (click)="setRange('week')" [class.active]="quickRange === 'week'">Esta semana</button>
          <button (click)="setRange('month')" [class.active]="quickRange === 'month'">Este mes</button>
          <button (click)="setRange('year')" [class.active]="quickRange === 'year'">Este año</button>
          <button (click)="setRange('all')" [class.active]="quickRange === 'all'">Todo</button>
        </div>
        <div class="tx-filters">
          <div class="tx-filter-field">
            <label>Método de pago</label>
            <select class="fin-select" [(ngModel)]="filterMethod" (change)="onFilterChange()">
              <option value="">Todos los métodos</option>
              @for (m of filterMethods(); track m) {
                <option [value]="m">{{ methodLabel(m) }}</option>
              }
            </select>
          </div>
          <div class="tx-filter-field">
            <label>{{ isConcesionaria ? 'Vehículo' : 'Trámite' }}</label>
            <select class="fin-select" [(ngModel)]="filterDealId" (change)="onFilterChange()">
              <option value="">{{ isConcesionaria ? 'Todos los vehículos' : 'Todos los trámites' }}</option>
              @for (d of filterDeals(); track d.id) {
                <option [value]="d.id">{{ d.title }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <!-- ── DASHBOARD ── -->
      @if (dashboard()) {
        <div class="stats-grid">
          <div class="stat-card income-card">
            <div class="stat-icon fin-stat-icon"><svg lucideTrendingUp [size]="22" aria-hidden="true"></svg></div>
            <div class="stat-body">
              <span class="stat-label">Ingresos Totales</span>
              @let inc = fmt(dashboard()!.totalIncome);
              <span class="stat-val income-val" [class.has-tip]="inc.truncated"
                (mouseenter)="showTipIf($event, inc)"
                (mouseleave)="hideTip()">{{ inc.display }}</span>
            </div>
          </div>
          <div class="stat-card expense-card">
            <div class="stat-icon fin-stat-icon"><svg lucideTrendingDown [size]="22" aria-hidden="true"></svg></div>
            <div class="stat-body">
              <span class="stat-label">Gastos Totales</span>
              @let exp = fmt(dashboard()!.totalExpense);
              <span class="stat-val expense-val" [class.has-tip]="exp.truncated"
                (mouseenter)="showTipIf($event, exp)"
                (mouseleave)="hideTip()">{{ exp.display }}</span>
            </div>
          </div>
          <div class="stat-card balance-card" [class.negative]="dashboard()!.netBalance < 0">
            <div class="stat-icon fin-stat-icon"><svg lucideScale [size]="22" aria-hidden="true"></svg></div>
            <div class="stat-body">
              <span class="stat-label">Balance Neto</span>
              @let bal = fmt(dashboard()!.netBalance, true);
              <span class="stat-val" [class.balance-pos]="dashboard()!.netBalance >= 0" [class.balance-neg]="dashboard()!.netBalance < 0"
                [class.has-tip]="bal.truncated"
                (mouseenter)="showTipIf($event, bal)"
                (mouseleave)="hideTip()">{{ bal.display }}</span>
            </div>
          </div>
          <div class="stat-card month-card">
            <div class="stat-icon fin-stat-icon"><svg lucideCalendar [size]="22" aria-hidden="true"></svg></div>
            <div class="stat-body">
              <span class="stat-label">Balance Mes Actual</span>
              @let mon = fmt(dashboard()!.monthBalance, true);
              <span class="stat-val" [class.balance-pos]="dashboard()!.monthBalance >= 0" [class.balance-neg]="dashboard()!.monthBalance < 0"
                [class.has-tip]="mon.truncated"
                (mouseenter)="showTipIf($event, mon)"
                (mouseleave)="hideTip()">{{ mon.display }}</span>
            </div>
          </div>
        </div>

        <!-- Desglose por método de pago -->
        @if (dashboard()!.byMethod && hasMethodData()) {
          <div class="method-breakdown">
            <h3 class="section-title fin-section-with-icon">
              <svg lucideCreditCard [size]="18" aria-hidden="true"></svg>
              Ingresos por método de cobro
            </h3>
            <div class="method-pills">
              @for (m of allMethods; track m.id) {
                @if (getMethodAmount(m.id) > 0) {
                  <div class="method-pill" [style.border-color]="m.color">
                    <span class="method-icon">{{ m.icon }}</span>
                    <span class="method-name">{{ m.label }}</span>
                    @let ma = fmt(getMethodAmount(m.id));
                    <span class="method-amount" [style.color]="m.color" [class.has-tip]="ma.truncated"
                      (mouseenter)="showTipIf($event, ma)"
                      (mouseleave)="hideTip()">{{ ma.display }}</span>
                  </div>
                }
              }
            </div>
          </div>
        }
      }

      <!-- ── TABS ── -->
      <div class="tab-bar">
        <button class="fin-tab-with-icon" [class.tab-active]="activeTab === 'transactions'" (click)="activeTab = 'transactions'">
          <svg lucideClipboardList [size]="16" aria-hidden="true"></svg>
          Transacciones
        </button>
        <button class="fin-tab-with-icon" [class.tab-active]="activeTab === 'config'" (click)="activeTab = 'config'; loadPaymentMethods()">
          <svg lucideSettings [size]="16" aria-hidden="true"></svg>
          Métodos de Pago
        </button>
      </div>

      <!-- ── TABLA DE TRANSACCIONES ── -->
      @if (activeTab === 'transactions') {
        <div class="table-wrap">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Referencia</th>
                <th>Método</th>
                <th>{{ isConcesionaria ? 'Vehículo' : 'Trámite' }}</th>
                <th class="col-right">Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (tx of transactions(); track tx.id) {
                <tr class="tx-row">
                  <td class="col-date">{{ tx.date | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <span class="badge" [class.badge-income]="tx.type === 'income'" [class.badge-expense]="tx.type === 'expense'">
                      {{ tx.type === 'income' ? '↑ Ingreso' : '↓ Gasto' }}
                    </span>
                  </td>
                  <td class="col-desc">{{ tx.description }}</td>
                  <td class="col-ref">{{ tx.referencia || '—' }}</td>
                  <td>
                    <span class="method-tag" [class]="'mt-' + (tx.payment_method || 'general')">
                      {{ methodLabel(tx.payment_method || 'general') }}
                    </span>
                  </td>
                  <td class="col-deal">{{ linkLabel(tx) }}</td>
                  <td class="col-right">
                    @let ta = fmt(tx.type === 'income' ? +tx.amount : -tx.amount, true, 13);
                    <span [class.txt-income]="tx.type === 'income'" [class.txt-expense]="tx.type === 'expense'"
                      [class.has-tip]="ta.truncated"
                      (mouseenter)="showTipIf($event, ta)"
                      (mouseleave)="hideTip()">{{ ta.display }}</span>
                  </td>
                  <td>
                    <button class="btn-del" (click)="deleteTx(tx.id)" title="Eliminar">
                      <svg lucideX [size]="14" aria-hidden="true"></svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="empty-state">
                    <div class="empty-inner">
                      <span class="empty-icon"><svg lucideInbox [size]="28" aria-hidden="true"></svg></span>
                      <p>No hay transacciones en este período.</p>
                      <button class="btn-new small btn-with-icon" (click)="openForm()">
                        <svg lucidePlus [size]="14" aria-hidden="true"></svg>
                        Registrar primera transacción
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1 || totalItems() > 0) {
          <div class="pagination">
            <button type="button" class="page-btn btn-with-icon" [disabled]="currentPage() <= 1" (click)="goPage(currentPage() - 1)">
              <svg lucideChevronLeft [size]="14" aria-hidden="true"></svg>
              Anterior
            </button>
            <span class="page-info">Página {{ currentPage() }} de {{ totalPages() }} · {{ totalItems() }} registros</span>
            <button type="button" class="page-btn btn-with-icon" [disabled]="currentPage() >= totalPages()" (click)="goPage(currentPage() + 1)">
              Siguiente
              <svg lucideChevronRight [size]="14" aria-hidden="true"></svg>
            </button>
          </div>
        }
      }

      <!-- ── CONFIG MÉTODOS DE PAGO ── -->
      @if (activeTab === 'config') {
        <div class="config-card">
          <h3 class="section-title fin-section-with-icon">
            <svg lucideSettings [size]="18" aria-hidden="true"></svg>
            Métodos de pago
          </h3>
          <p class="config-desc">Activa o desactiva métodos predefinidos y crea métodos personalizados. Stripe siempre está disponible desde webhooks automáticos. Recuerda pulsar <strong>Guardar configuración</strong> para que aparezcan en ingresos y egresos.</p>

          <!-- Métodos predefinidos -->
          <div class="config-section-label">Métodos predefinidos</div>
          <div class="methods-list">
            @for (m of allMethods; track m.id) {
              <label class="method-toggle" [class.disabled]="m.id === 'stripe'">
                <input
                  type="checkbox"
                  [checked]="isMethodEnabled(m.id)"
                  (change)="toggleMethod(m.id, $event)"
                  [disabled]="m.id === 'stripe'"
                >
                <div class="method-toggle-body" [style.border-color]="isMethodEnabled(m.id) ? m.color : 'var(--border)'">
                  <span class="mt-icon">{{ m.icon }}</span>
                  <div style="flex:1">
                    <strong>{{ m.label }}</strong>
                    @if (m.id === 'stripe') {
                      <small>Se registra automáticamente desde webhooks</small>
                    }
                  </div>
                  @if (m.id !== 'stripe') {
                    <span class="toggle-status" [class.on]="isMethodEnabled(m.id)">
                      {{ isMethodEnabled(m.id) ? 'Activo' : 'Inactivo' }}
                    </span>
                  }
                </div>
              </label>
            }
          </div>

          <!-- Métodos personalizados existentes -->
          @if (customMethods.length > 0) {
            <div class="config-section-label" style="margin-top: 20px;">Métodos personalizados</div>
            <div class="methods-list">
              @for (m of customMethods; track m.id) {
                <div class="method-custom-item">
                  <label class="method-toggle" style="flex:1; margin-bottom:0">
                    <input
                      type="checkbox"
                      [checked]="isMethodEnabled(m.id)"
                      (change)="toggleMethod(m.id, $event)"
                    >
                    <div class="method-toggle-body" [style.border-color]="isMethodEnabled(m.id) ? '#C8A94A' : 'var(--border)'">
                      <span class="mt-icon">{{ m.icon }}</span>
                      <div style="flex:1">
                        <strong>{{ m.label }}</strong>
                        <small>Personalizado</small>
                      </div>
                      <span class="toggle-status" [class.on]="isMethodEnabled(m.id)">
                        {{ isMethodEnabled(m.id) ? 'Activo' : 'Inactivo' }}
                      </span>
                    </div>
                  </label>
                  <button class="btn-del-method" (click)="removeCustomMethod(m.id)" title="Eliminar método">
                    <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
                  </button>
                </div>
              }
            </div>
          }

          <!-- Agregar método personalizado -->
          <div class="add-custom-method">
            <div class="config-section-label fin-section-with-icon" style="margin-bottom: 10px;">
              <svg lucidePlus [size]="14" aria-hidden="true"></svg>
              Agregar método personalizado
            </div>
            <div class="custom-method-form">
              <div class="emoji-picker-wrap">
                <button class="emoji-btn" (click)="showEmojiPicker = !showEmojiPicker">{{ newMethodIcon || '💰' }}</button>
                @if (showEmojiPicker) {
                  <div class="emoji-grid">
                    @for (e of emojiOptions; track e) {
                      <button class="emoji-opt" (click)="newMethodIcon = e; showEmojiPicker = false">{{ e }}</button>
                    }
                  </div>
                }
              </div>
              <input
                class="custom-name-input"
                [(ngModel)]="newMethodName"
                placeholder="Nombre del método (ej: Cheque, Cripto, Débito)"
                (keyup.enter)="addCustomMethod()"
              >
              <button class="btn-add-method" (click)="addCustomMethod()" [disabled]="!newMethodName.trim()">
                Agregar
              </button>
            </div>
          </div>

          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); display:flex; justify-content:flex-end;">
            <button class="btn-new btn-with-icon" (click)="savePaymentMethods()" [disabled]="savingMethods">
              <svg lucideSave [size]="16" aria-hidden="true"></svg>
              {{ savingMethods ? 'Guardando...' : 'Guardar configuración' }}
            </button>
          </div>
        </div>
      }

      <!-- ── MODAL NUEVA TRANSACCIÓN ── -->
      @if (showForm()) {
        <div class="modal-overlay" (click)="closeForm()">
          <div class="modal-box" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="fin-section-with-icon">
                @if (newTx.type === 'income') {
                  <svg lucideTrendingUp [size]="18" aria-hidden="true"></svg>
                  Registrar Ingreso
                } @else {
                  <svg lucideTrendingDown [size]="18" aria-hidden="true"></svg>
                  Registrar Gasto
                }
              </h3>
              <button class="btn-close" (click)="closeForm()" aria-label="Cerrar">
                <svg lucideX [size]="18" aria-hidden="true"></svg>
              </button>
            </div>

            <!-- Tipo -->
            <div class="type-toggle">
              <button class="btn-with-icon" [class.type-active-income]="newTx.type === 'income'" (click)="newTx.type = 'income'">
                <svg lucideArrowUp [size]="14" aria-hidden="true"></svg>
                Ingreso
              </button>
              <button class="btn-with-icon" [class.type-active-expense]="newTx.type === 'expense'" (click)="newTx.type = 'expense'">
                <svg lucideArrowDown [size]="14" aria-hidden="true"></svg>
                Gasto
              </button>
            </div>

            <div class="modal-fields">
              <div class="field-row">
                <label>Monto *</label>
                <div class="input-money">
                  <span>$</span>
                  <input type="number" [(ngModel)]="newTx.amount" placeholder="0.00" min="0" step="0.01">
                </div>
              </div>

              <div class="field-row">
                <label>Descripción *</label>
                <input type="text" [(ngModel)]="newTx.description" [placeholder]="isConcesionaria ? 'Ej. Anticipo de apartado' : 'Ej. Anticipo de trámite de placas'">
              </div>

              <div class="field-row">
                <label>Referencia</label>
                <input type="text" [(ngModel)]="newTx.referencia" placeholder="Ej. Factura #123, folio, transferencia...">
              </div>

              <div class="field-row">
                <label>Fecha *</label>
                <input type="date" [(ngModel)]="newTx.date">
              </div>

              <!-- Método de pago/cobro (ambos tipos) -->
              <div class="field-row">
                <label>{{ newTx.type === 'income' ? 'Método de cobro' : 'Método de pago' }}</label>
                @if (formMethods().length > 0) {
                  <div class="select-wrap">
                    <select [(ngModel)]="newTx.payment_method" class="method-select">
                      @for (m of formMethods(); track m.id) {
                        <option [ngValue]="m.id">{{ m.icon }} {{ m.label }}</option>
                      }
                    </select>
                    <span class="select-arrow">▾</span>
                  </div>
                } @else {
                  <div class="no-methods-hint fin-section-with-icon">
                    <svg lucideTriangleAlert [size]="14" aria-hidden="true"></svg>
                    No tienes métodos configurados. Ve a <strong>Métodos de Pago</strong> para activar algunos.
                  </div>
                }
              </div>

              @if (newTx.type === 'income' || isConcesionaria) {
                <div class="field-row">
                  <label>{{ isConcesionaria ? 'Vehículo / Lead (opcional)' : 'Trámite relacionado (opcional)' }}</label>
                  <div class="select-wrap">
                    <select [(ngModel)]="newTx.deal_id" class="method-select">
                      <option [ngValue]="null">— Ninguno —</option>
                      @for (deal of pendingDeals(); track deal.id) {
                        <option [ngValue]="deal.id">{{ deal.title }}@if (!isConcesionaria) { (pendiente: \${{ deal.estimated_value - deal.paid_amount | number:'1.2-2' }}) }</option>
                      }
                    </select>
                    <span class="select-arrow">▾</span>
                  </div>
                </div>
              }

              <div class="field-row">
                <label>Categoría</label>
                <input type="text" [(ngModel)]="newTx.category" placeholder="general, operativo, administrativo...">
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-ghost" (click)="closeForm()">Cancelar</button>
              <button class="btn-new" (click)="saveTx()" [disabled]="!newTx.amount || !newTx.description || !newTx.date || (formMethods().length > 0 && !newTx.payment_method)">
                Guardar transacción
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      --text: #ffffff;
      --muted: rgba(255,255,255,0.45);
      --surface: #141414;
      --border: rgba(255,255,255,0.10);
      --gold: rgba(255,255,255,0.75);
      --bg: #000;
      font-family: var(--f-display);
    }

    /* ── WRAP ── */
    .fin-wrap { display: flex; flex-direction: column; gap: 20px; color: #fff; }

    /* ── HEADER ── */
    .fin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
    .fin-title { margin: 0; font-size: 24px; font-weight: 800; font-family: var(--f-display); color: #fff; letter-spacing: 0.06em; text-transform: uppercase; }
    .fin-sub { margin: 4px 0 0 0; font-size: 15px; color: rgba(255,255,255,0.45); font-family: var(--f-display); }
    .fin-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .btn-new { background: #fff; color: #000; border: 2px solid #fff; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 12px; font-family: var(--f-display); letter-spacing: 0.10em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px; transition: all .2s; }
    .btn-new:hover { background: transparent; color: #fff; }
    .btn-new:disabled { opacity: .4; cursor: not-allowed; }
    .btn-new.small { padding: 6px 14px; font-size: 11px; }

    .btn-export { padding: 10px 16px; border-radius: 8px; font-size: 11px; font-weight: 700; font-family: var(--f-display); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s; border: 1px solid; background: transparent; }
    .btn-export.csv { border-color: rgba(34,197,94,.35); color: #4ade80; }
    .btn-export.csv:hover { background: rgba(34,197,94,.10); }
    .btn-export.pdf { border-color: rgba(255,255,255,.25); color: rgba(255,255,255,.75); }
    .btn-export.pdf:hover { background: rgba(255,255,255,.08); }

    /* ── FILTER BAR ── */
    .filter-bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; background: #141414; border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 16px 20px; }
    .date-inputs { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .date-inputs label { font-size: 10px; color: rgba(255,255,255,0.40); font-family: var(--f-display); letter-spacing: 0.12em; text-transform: uppercase; }
    .date-inputs input { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.14); padding: 10px 12px; border-radius: 8px; color: #fff; font-size: 14px; font-family: var(--f-display); outline: none; color-scheme: dark; }
    .date-inputs input:focus { border-color: rgba(255,255,255,0.40); }
    .quick-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .quick-btns button { background: transparent; border: 1px solid rgba(255,255,255,0.14); color: rgba(255,255,255,0.45); padding: 6px 12px; border-radius: 999px; font-size: 11px; font-family: var(--f-display); letter-spacing: 0.06em; cursor: pointer; transition: all .2s; }
    .quick-btns button:hover, .quick-btns button.active { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.40); color: #fff; font-weight: 700; }

    .tx-filters { display: flex; gap: 12px; flex-wrap: wrap; margin-left: auto; }
    .tx-filter-field { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
    .tx-filter-field label { font-size: 10px; color: rgba(255,255,255,0.40); font-family: var(--f-display); letter-spacing: 0.12em; text-transform: uppercase; }
    .fin-select {
      color-scheme: dark;
      background-color: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      color: rgba(255,255,255,0.80) !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      padding: 8px 10px !important;
      font-family: var(--f-display) !important;
      cursor: pointer !important;
      width: 100% !important;
    }
    .fin-select option { background: #1a1a1a; color: #fff; }

    /* ── STATS GRID ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .stat-card {
      display: flex; align-items: center; gap: 14px; padding: 16px 18px;
      border-radius: 14px; border: 1px solid rgba(255,255,255,0.10); background: #141414;
      min-width: 0; container-type: inline-size;
    }
    .income-card { border-top: 2px solid rgba(34,197,94,0.50); }
    .expense-card { border-top: 2px solid rgba(239,68,68,0.50); }
    .balance-card { border-top: 2px solid rgba(255,255,255,0.30); }
    .balance-card.negative { border-top-color: rgba(239,68,68,0.50); }
    .month-card { border-top: 2px solid rgba(59,130,246,0.50); }
    .stat-icon { font-size: 24px; flex-shrink: 0; }
    .stat-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .stat-label { font-size: 10px; color: rgba(255,255,255,0.40); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; font-family: var(--f-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stat-val {
      display: block;
      font-size: clamp(14px, 9cqi, 22px); font-weight: 800; color: #fff; font-family: var(--f-display);
      font-variant-numeric: tabular-nums; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.15;
    }
    .income-val { color: #4ade80; }
    .expense-val { color: #f87171; }
    .balance-pos { color: #fff !important; }
    .balance-neg { color: #f87171 !important; }
    .has-tip { cursor: help; }

    /* ── METHOD BREAKDOWN ── */
    .section-title { margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.70); font-family: var(--f-display); letter-spacing: 0.08em; text-transform: uppercase; }
    .method-breakdown { background: #141414; border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 16px 20px; }
    .method-pills { display: flex; flex-wrap: wrap; gap: 10px; }
    .method-pill { display: flex; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 14px; }
    .method-icon { font-size: 18px; }
    .method-name { font-size: 13px; color: rgba(255,255,255,0.50); font-family: var(--f-display); }
    .method-amount { font-size: 15px; font-weight: 800; font-family: var(--f-display); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; }

    /* ── TABS ── */
    .tab-bar { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.10); }
    .tab-bar button { background: transparent; border: none; border-bottom: 2px solid transparent; padding: 10px 18px; font-size: 12px; color: rgba(255,255,255,0.40); cursor: pointer; font-weight: 700; font-family: var(--f-display); letter-spacing: 0.06em; margin-bottom: -1px; transition: all .2s; }
    .tab-bar button:hover { color: rgba(255,255,255,0.80); }
    .tab-active { color: #fff !important; border-bottom-color: rgba(255,255,255,0.60) !important; }

    /* ── TABLE ── */
    .table-wrap { background: #141414; border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; min-width: 640px; }
    .fin-table th { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.35); font-size: 10px; font-weight: 700; font-family: var(--f-display); text-transform: uppercase; letter-spacing: 0.12em; text-align: left; }
    .fin-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 15px; color: rgba(255,255,255,0.80); font-family: var(--f-display); }
    .fin-table tr:last-child td { border-bottom: none; }
    .tx-row:hover { background: rgba(255,255,255,0.03); }
    .col-right { text-align: right; }
    .col-date { color: rgba(255,255,255,0.40); font-size: 12px; white-space: nowrap; }
    .col-desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-deal { color: rgba(255,255,255,0.40); font-size: 12px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-ref { color: rgba(255,255,255,0.55); font-size: 12px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .badge { padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; font-family: var(--f-display); letter-spacing: 0.06em; }
    .badge-income { background: rgba(34,197,94,.12); color: #4ade80; }
    .badge-expense { background: rgba(239,68,68,.12); color: #f87171; }
    .txt-income { color: #4ade80; font-weight: 800; max-width: 140px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
    .txt-expense { color: #f87171; font-weight: 800; max-width: 140px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }

    .method-tag { padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; font-family: var(--f-display); }
    .mt-stripe { background: rgba(99,102,241,.15); color: #a5b4fc; }
    .mt-efectivo { background: rgba(34,197,94,.12); color: #4ade80; }
    .mt-transferencia { background: rgba(59,130,246,.12); color: #93c5fd; }
    .mt-mercadopago { background: rgba(168,85,247,.12); color: #d8b4fe; }
    .mt-general { background: rgba(255,255,255,.08); color: rgba(255,255,255,0.50); }

    .btn-del { background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.35); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all .2s; }
    .btn-del:hover { border-color: rgba(239,68,68,.4); color: #f87171; background: rgba(239,68,68,.10); }

    .empty-state { text-align: center; padding: 48px !important; }
    .empty-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon { font-size: 40px; }
    .empty-inner p { color: rgba(255,255,255,0.40); margin: 0; font-family: var(--f-display); }

    /* ── PAGINATION ── */
    .pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 4px; flex-wrap: wrap; }
    .page-btn { background: transparent; border: 1px solid rgba(255,255,255,0.20); color: rgba(255,255,255,0.70); padding: 8px 16px; border-radius: 8px; font-family: var(--f-display); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all .2s; }
    .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.40); }
    .page-btn:disabled { opacity: 0.30; cursor: not-allowed; }
    .page-info { font-size: 12px; color: rgba(255,255,255,0.40); font-family: var(--f-display); }

    /* ── CONFIG ── */
    .config-card { background: #141414; border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .config-desc { color: rgba(255,255,255,0.45); font-size: 13px; margin: 0; line-height: 1.6; font-family: var(--f-display); }
    .config-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.35); font-family: var(--f-display); }
    .methods-list { display: flex; flex-direction: column; gap: 8px; }
    .method-toggle { display: block; cursor: pointer; margin-bottom: 0; }
    .method-toggle.disabled { cursor: default; opacity: .6; }
    .method-toggle input { display: none; }
    .method-toggle-body { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; transition: all .2s; }
    .mt-icon { font-size: 22px; flex-shrink: 0; }
    .method-toggle-body strong { display: block; font-size: 14px; color: #fff; font-family: var(--f-display); }
    .method-toggle-body small { display: block; font-size: 11px; color: rgba(255,255,255,0.40); margin-top: 2px; font-family: var(--f-display); }
    .toggle-status { font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.06); color: rgba(255,255,255,0.40); flex-shrink: 0; font-family: var(--f-display); letter-spacing: 0.06em; }
    .toggle-status.on { background: rgba(34,197,94,.12); color: #4ade80; }

    .method-custom-item { display: flex; align-items: center; gap: 8px; }
    .btn-del-method { background: transparent; border: 1px solid rgba(239,68,68,.30); color: #f87171; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 14px; flex-shrink: 0; transition: all .2s; }
    .btn-del-method:hover { background: rgba(239,68,68,.12); }

    .add-custom-method { background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; }
    .custom-method-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .emoji-picker-wrap { position: relative; flex-shrink: 0; }
    .emoji-btn { width: 44px; height: 44px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); background: #1a1a1a; font-size: 22px; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; }
    .emoji-btn:hover { border-color: rgba(255,255,255,0.35); }
    .emoji-grid { position: absolute; top: calc(100% + 6px); left: 0; background: #141414; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,.6); min-width: 200px; }
    .emoji-opt { background: transparent; border: none; font-size: 20px; width: 32px; height: 32px; cursor: pointer; border-radius: 6px; transition: background .15s; }
    .emoji-opt:hover { background: rgba(255,255,255,.08); }
    .custom-name-input { flex: 1; min-width: 160px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.14); padding: 10px 12px; border-radius: 8px; color: #fff; font-size: 14px; font-family: var(--f-display); outline: none; }
    .custom-name-input:focus { border-color: rgba(255,255,255,0.40); }
    .btn-add-method { background: transparent; border: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.75); padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 11px; font-family: var(--f-display); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all .2s; }
    .btn-add-method:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .btn-add-method:disabled { opacity: .4; cursor: not-allowed; }

    /* ── MODAL ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
    .modal-box { background: #0d0d0d; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; width: 480px; max-width: 100%; display: flex; flex-direction: column; box-shadow: 0 24px 80px rgba(0,0,0,.6); animation: slideUp .2s ease; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; font-family: var(--f-display); letter-spacing: 0.06em; text-transform: uppercase; }
    .btn-close { background: transparent; border: none; color: rgba(255,255,255,0.45); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .btn-close:hover { color: #fff; background: rgba(255,255,255,.08); }

    .type-toggle { display: flex; gap: 6px; padding: 16px 24px 0; }
    .type-toggle button { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: rgba(255,255,255,0.45); font-size: 13px; font-weight: 700; font-family: var(--f-display); cursor: pointer; transition: all .2s; }
    .type-active-income { border-color: rgba(34,197,94,.45) !important; color: #4ade80 !important; background: rgba(34,197,94,.08) !important; }
    .type-active-expense { border-color: rgba(239,68,68,.45) !important; color: #f87171 !important; background: rgba(239,68,68,.08) !important; }

    .modal-fields { display: flex; flex-direction: column; gap: 14px; padding: 16px 24px; }
    .field-row { display: flex; flex-direction: column; gap: 6px; }
    .field-row label { font-size: 10px; color: rgba(255,255,255,0.40); font-weight: 700; font-family: var(--f-display); text-transform: uppercase; letter-spacing: 0.12em; }
    .field-row input, .field-row select { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.14); padding: 10px 12px; border-radius: 8px; color: #fff; font-size: 14px; font-family: var(--f-display); outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
    .field-row input:focus, .field-row select:focus { border-color: rgba(255,255,255,0.40); }
    .input-money { display: flex; align-items: center; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; overflow: hidden; }
    .input-money span { padding: 0 12px; color: rgba(255,255,255,0.60); font-weight: 700; font-size: 16px; border-right: 1px solid rgba(255,255,255,0.10); background: #141414; font-family: var(--f-display); }
    .input-money input { border: none; background: transparent; flex: 1; color: #fff; }

    .select-wrap { position: relative; }
    .method-select { appearance: none; -webkit-appearance: none; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.14); padding: 11px 40px 11px 14px; border-radius: 8px; color: #fff; font-size: 14px; font-family: var(--f-display); outline: none; width: 100%; box-sizing: border-box; cursor: pointer; color-scheme: dark; }
    .method-select:focus { border-color: rgba(255,255,255,0.40); }
    .method-select option { background: #1a1a1a; color: #fff; }
    .select-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.35); pointer-events: none; font-size: 14px; }
    .no-methods-hint { background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: rgba(255,255,255,0.45); display: flex; align-items: center; gap: 8px; font-family: var(--f-display); }
    .no-methods-hint strong { color: #fff; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 0 24px 20px; }
    .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.20); color: rgba(255,255,255,0.70); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: var(--f-display); letter-spacing: 0.08em; text-transform: uppercase; }
    .btn-ghost:hover { background: rgba(255,255,255,.06); color: #fff; }
  `]
})
export class FinancesComponent implements OnInit, OnDestroy {
  dashboard = signal<FinDashboard | null>(null);
  transactions = signal<FinTransaction[]>([]);
  filterDeals = signal<FinFilterOptions['deals']>([]);
  filterMethods = signal<string[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);
  pageSize = 15;
  pendingDeals = signal<any[]>([]);
  showForm = signal(false);
  activeTab: 'transactions' | 'config' = 'transactions';

  filterFrom = '';
  filterTo = '';
  filterMethod = '';
  filterDealId = '';
  quickRange = 'all';

  // Payment methods config
  enabledMethods = signal<FinPaymentMethodOption[]>([]);
  paymentMethodCatalog = signal<FinPaymentMethodOption[]>([]);
  allMethods = [...FIN_ALL_METHODS];
  customMethods: FinPaymentMethodOption[] = [];
  selectedMethodIds: string[] = ['efectivo', 'transferencia', 'mercadopago', 'stripe'];
  savingMethods = false;

  // Methods shown inside the transaction form (refreshed on each open)
  formMethods = signal<FinPaymentMethodOption[]>([]);

  // Custom method form
  newMethodName = '';
  newMethodIcon = '💰';
  showEmojiPicker = false;
  emojiOptions = [
    '💰', '💵', '💳', '🏦', '⚡', '📱', '💴', '🔑',
    '🎁', '📦', '💼', '📝', '📄', '⭐', '💪', '🔗',
    '📬', '🛡', '🏆', '⏩', '📊', '🧩', '🔗', '✅'
  ];

  newTx = this.emptyTx();

  get isConcesionaria(): boolean {
    return this.auth.user()?.role === 'concesionaria';
  }

  constructor(private fin: FinancesService, private auth: AuthService, private toast: ToastService) {}

  ngOnInit() {
    this.loadData();
    this.loadPaymentMethods();
  }

  emptyTx() {
    return {
      type: 'income' as 'income' | 'expense',
      amount: null as number | null,
      description: '',
      category: 'general',
      date: new Date().toISOString().split('T')[0],
      deal_id: null as string | null,
      payment_method: '',
      referencia: '',
    };
  }

  loadData() {
    const from = this.filterFrom || undefined;
    const to = this.filterTo || undefined;
    this.fin.getDashboard(from, to).subscribe(d => this.dashboard.set(d));
    this.fin.getTransactions({
      from, to,
      page: this.currentPage(),
      limit: this.pageSize,
      payment_method: this.filterMethod || undefined,
      deal_id: this.filterDealId || undefined,
    }).subscribe(res => {
      this.transactions.set(res.items);
      this.totalItems.set(res.total);
      this.totalPages.set(res.pages);
      this.currentPage.set(res.page);
    });
    this.loadFilterOptions();
  }

  loadFilterOptions() {
    const from = this.filterFrom || undefined;
    const to = this.filterTo || undefined;
    this.fin.getFilterOptions(from, to).subscribe(opts => {
      this.filterDeals.set(opts.deals);
      this.filterMethods.set(opts.methods);
    });
  }

  onDateChange() {
    this.currentPage.set(1);
    this.loadData();
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.loadData();
  }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadData();
  }

  setRange(range: string) {
    this.quickRange = range;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (range === 'today') {
      this.filterFrom = fmt(now);
      this.filterTo = fmt(now);
    } else if (range === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      this.filterFrom = fmt(start);
      this.filterTo = fmt(now);
    } else if (range === 'month') {
      this.filterFrom = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      this.filterTo = fmt(now);
    } else if (range === 'year') {
      this.filterFrom = `${now.getFullYear()}-01-01`;
      this.filterTo = fmt(now);
    } else {
      this.filterFrom = '';
      this.filterTo = '';
    }
    this.filterMethod = '';
    this.filterDealId = '';
    this.currentPage.set(1);
    this.loadData();
  }

  loadPaymentMethods() {
    this.fin.getPaymentMethods().subscribe(res => {
      this.customMethods = [];
      this.selectedMethodIds = ['stripe'];

      const saved = res.methods || [];
      if (saved.length === 0) {
        this.paymentMethodCatalog.set([]);
        this.updateEnabledMethods();
        return;
      }

      for (const m of saved) {
        if (typeof m === 'string') {
          if (m !== 'stripe' && !this.selectedMethodIds.includes(m)) {
            this.selectedMethodIds.push(m);
          }
        } else if (m?.id) {
          if (!this.customMethods.find(x => x.id === m.id)) {
            this.customMethods.push({
              id: m.id,
              label: m.label || m.id,
              icon: m.icon || '💰',
              color: '#C8A94A',
            });
          }
          if (m.enabled !== false && !this.selectedMethodIds.includes(m.id)) {
            this.selectedMethodIds.push(m.id);
          }
        }
      }

      this.paymentMethodCatalog.set(parseFinPaymentMethods(saved, { onlyEnabled: false }));
      this.updateEnabledMethods();
    });
  }

  private applyFormMethods(methods: FinPaymentMethodOption[]) {
    this.formMethods.set(methods);
    this.newTx.payment_method = methods[0]?.id || '';
  }

  private refreshFormMethods() {
    const fromConfig = buildActiveFormMethods(this.allMethods, this.customMethods, this.selectedMethodIds);
    this.fin.getPaymentMethods().subscribe({
      next: (res) => {
        const fromApi = parseFinPaymentMethods(res.methods, { excludeStripe: true, onlyEnabled: true });
        const methods = fromApi.length > 0 ? fromApi : fromConfig;
        this.paymentMethodCatalog.set(parseFinPaymentMethods(res.methods, { onlyEnabled: false }));
        this.applyFormMethods(methods);
      },
      error: () => this.applyFormMethods(fromConfig),
    });
  }

  updateEnabledMethods() {
    const predefined = this.allMethods.filter(m => this.selectedMethodIds.includes(m.id as string));
    const custom = this.customMethods.filter(m => this.selectedMethodIds.includes(m.id));
    this.enabledMethods.set([...predefined, ...custom] as any);
  }

  isMethodEnabled(id: string): boolean {
    return this.selectedMethodIds.includes(id);
  }

  toggleMethod(id: string, event: any) {
    if (id === 'stripe') return;
    if (event.target.checked) {
      if (!this.selectedMethodIds.includes(id)) this.selectedMethodIds.push(id);
    } else {
      this.selectedMethodIds = this.selectedMethodIds.filter(m => m !== id);
    }
    this.updateEnabledMethods();
  }

  addCustomMethod() {
    const name = this.newMethodName.trim();
    if (!name) return;
    const id = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newM = { id, label: name, icon: this.newMethodIcon || '💰', color: '#C8A94A' };
    this.customMethods.push(newM);
    this.selectedMethodIds.push(id);
    this.newMethodName = '';
    this.newMethodIcon = '💰';
    this.updateEnabledMethods();
    this.toast.success(`Método "${name}" agregado. Recuerda guardar la configuración.`, 'Método creado');
  }

  removeCustomMethod(id: string) {
    const m = this.customMethods.find(x => x.id === id);
    this.customMethods = this.customMethods.filter(m => m.id !== id);
    this.selectedMethodIds = this.selectedMethodIds.filter(m => m !== id);
    this.updateEnabledMethods();
    if (m) this.toast.warning(`Método "${m.label}" eliminado. Guarda para confirmar.`, 'Método eliminado');
  }

  savePaymentMethods() {
    const toSave = buildFinPaymentMethodsPayload(this.allMethods, this.customMethods, this.selectedMethodIds);
    const activeCount = buildActiveFormMethods(this.allMethods, this.customMethods, this.selectedMethodIds).length;
    if (!toSave.length || activeCount === 0) {
      this.toast.warning('Activa al menos un método de pago antes de guardar.', 'Sin métodos activos');
      return;
    }

    this.savingMethods = true;
    this.fin.savePaymentMethods(toSave).subscribe({
      next: () => {
        this.savingMethods = false;
        this.loadPaymentMethods();
        this.toast.success('La configuración de métodos de pago fue guardada.', 'Configuración guardada');
      },
      error: () => {
        this.savingMethods = false;
        this.toast.error('No se pudo guardar la configuración.', 'Error');
      }
    });
  }

  openForm() {
    this.fin.getPendingDeals().subscribe(d => this.pendingDeals.set(d));
    this.newTx = this.emptyTx();
    this.refreshFormMethods();
    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); }

  saveTx() {
    const txType = this.newTx.type;
    const allowedIds = new Set(this.formMethods().map(m => m.id));
    if (!this.newTx.payment_method || !allowedIds.has(this.newTx.payment_method)) {
      this.toast.warning('Selecciona un método de cobro/pago configurado en Finanzas.', 'Método requerido');
      return;
    }
    this.fin.createTransaction(this.newTx as any).subscribe({
      next: () => {
        this.closeForm();
        this.loadData();
        this.toast.success(
          txType === 'income' ? 'Ingreso registrado correctamente.' : 'Gasto registrado correctamente.',
          txType === 'income' ? 'Ingreso guardado' : 'Gasto guardado'
        );
      },
      error: () => this.toast.error('No se pudo guardar la transacción.', 'Error')
    });
  }

  async deleteTx(id: string) {
    const ok = await this.toast.confirm('¿Esta acción no se puede deshacer. Continuar?', '¿Eliminar transacción?');
    if (!ok) return;
    this.fin.deleteTransaction(id).subscribe({
      next: () => {
        this.loadData();
        this.toast.success('La transacción fue eliminada.', 'Eliminada');
      },
      error: () => this.toast.error('No se pudo eliminar la transacción.', 'Error')
    });
  }

  doExportCsv() {
    window.open(this.fin.exportCsv(
      this.filterFrom || undefined,
      this.filterTo || undefined,
      this.filterMethod || undefined,
      this.filterDealId || undefined,
    ), '_blank');
    this.toast.info('Exportando con los filtros actuales (fecha, método y trámite).', 'Exportando CSV');
  }

  doExportPdf() {
    window.open(this.fin.exportPdf(
      this.filterFrom || undefined,
      this.filterTo || undefined,
      this.filterMethod || undefined,
      this.filterDealId || undefined,
    ), '_blank');
    this.toast.info('Generando PDF con los filtros actuales.', 'Exportando PDF');
  }

  methodLabel(method: string): string {
    return finPaymentMethodLabel(method, this.paymentMethodCatalog());
  }

  hasMethodData(): boolean {
    const bm = this.dashboard()?.byMethod;
    return !!bm && Object.values(bm).some(v => v > 0);
  }

  getMethodAmount(id: string): number {
    return Number(this.dashboard()?.byMethod?.[id] || 0);
  }

  linkLabel(tx: FinTransaction): string {
    if (this.isConcesionaria) {
      return tx.vehicle_label || tx.deal_title || '—';
    }
    return tx.deal_title || '—';
  }

  // ── Tooltip de montos ─────────────────────────────────────────
  private _tipEl: HTMLElement | null = null;

  fmt(n: number, signed = false, maxLength = 10) {
    return formatMoney(n, { signed, maxLength });
  }

  showTipIf(ev: MouseEvent, d: { truncated: boolean; full: string }): void {
    if (d.truncated) this.showTip(ev, d.full);
  }

  showTip(ev: MouseEvent, fullText: string): void {
    this.hideTip();

    const anchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();

    const tip = document.createElement('div');
    tip.textContent = fullText;
    // Apply styles individually to avoid cssText parsing quirks
    tip.style.position = 'fixed';
    tip.style.zIndex = '99999';
    tip.style.background = '#111111';
    tip.style.color = '#ffffff';
    tip.style.border = '1px solid rgba(255,255,255,0.25)';
    tip.style.padding = '7px 14px';
    tip.style.borderRadius = '8px';
    tip.style.fontSize = '13px';
    tip.style.fontWeight = '700';
    tip.style.fontFamily = 'Spartan, sans-serif';
    tip.style.whiteSpace = 'nowrap';
    tip.style.boxShadow = '0 6px 24px rgba(0,0,0,0.85)';
    tip.style.pointerEvents = 'none';
    tip.style.visibility = 'hidden';  // hidden but rendered so we can measure
    tip.style.top = '0';
    tip.style.left = '0';

    document.body.appendChild(tip);
    this._tipEl = tip;

    // Measure synchronously after append (forced reflow)
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    let left = anchor.left;
    let top = anchor.top - th - 8;

    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (left < 8) left = 8;
    if (top < 8) top = anchor.bottom + 8;

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = 'visible';
  }

  hideTip(): void {
    this._tipEl?.remove();
    this._tipEl = null;
  }

  ngOnDestroy(): void {
    this.hideTip();
  }
}
