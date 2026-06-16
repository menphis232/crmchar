import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancesService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { FinDashboard, FinTransaction, FIN_ALL_METHODS } from '../../models';

@Component({
  selector: 'app-finances',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="fin-wrap">

      <!-- ── HEADER ── -->
      <div class="fin-header">
        <div>
          <h2 class="fin-title">💰 Módulo de Finanzas</h2>
          <p class="fin-sub">Controla tus ingresos y gastos en un solo lugar</p>
        </div>
        <div class="fin-header-actions">
          <button class="btn-export csv" (click)="doExportCsv()" title="Exportar CSV">
            <span>📊</span> Exportar CSV
          </button>
          <button class="btn-export pdf" (click)="doExportPdf()" title="Exportar PDF">
            <span>📄</span> Exportar PDF
          </button>
          <button class="btn-new" (click)="openForm()">
            <span>＋</span> Nueva transacción
          </button>
        </div>
      </div>

      <!-- ── FILTROS DE FECHA ── -->
      <div class="filter-bar">
        <div class="date-inputs">
          <label>Desde</label>
          <input type="date" [(ngModel)]="filterFrom" (change)="loadData()">
          <label>Hasta</label>
          <input type="date" [(ngModel)]="filterTo" (change)="loadData()">
        </div>
        <div class="quick-btns">
          <button (click)="setRange('today')" [class.active]="quickRange === 'today'">Hoy</button>
          <button (click)="setRange('week')" [class.active]="quickRange === 'week'">Esta semana</button>
          <button (click)="setRange('month')" [class.active]="quickRange === 'month'">Este mes</button>
          <button (click)="setRange('year')" [class.active]="quickRange === 'year'">Este año</button>
          <button (click)="setRange('all')" [class.active]="quickRange === 'all'">Todo</button>
        </div>
      </div>

      <!-- ── DASHBOARD ── -->
      @if (dashboard()) {
        <div class="stats-grid">
          <div class="stat-card income-card">
            <div class="stat-icon">📈</div>
            <div class="stat-body">
              <span class="stat-label">Ingresos Totales</span>
              <span class="stat-val income-val">\${{ dashboard()!.totalIncome | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="stat-card expense-card">
            <div class="stat-icon">📉</div>
            <div class="stat-body">
              <span class="stat-label">Gastos Totales</span>
              <span class="stat-val expense-val">\${{ dashboard()!.totalExpense | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="stat-card balance-card" [class.negative]="dashboard()!.netBalance < 0">
            <div class="stat-icon">⚖️</div>
            <div class="stat-body">
              <span class="stat-label">Balance Neto</span>
              <span class="stat-val" [class.balance-pos]="dashboard()!.netBalance >= 0" [class.balance-neg]="dashboard()!.netBalance < 0">
                {{ dashboard()!.netBalance >= 0 ? '+' : '' }}\${{ dashboard()!.netBalance | number:'1.2-2' }}
              </span>
            </div>
          </div>
          <div class="stat-card month-card">
            <div class="stat-icon">📅</div>
            <div class="stat-body">
              <span class="stat-label">Balance Mes Actual</span>
              <span class="stat-val" [class.balance-pos]="dashboard()!.monthBalance >= 0" [class.balance-neg]="dashboard()!.monthBalance < 0">
                {{ dashboard()!.monthBalance >= 0 ? '+' : '' }}\${{ dashboard()!.monthBalance | number:'1.2-2' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Desglose por método de pago -->
        @if (dashboard()!.byMethod && hasMethodData()) {
          <div class="method-breakdown">
            <h3 class="section-title">💳 Ingresos por método de cobro</h3>
            <div class="method-pills">
              @for (m of allMethods; track m.id) {
                @if (getMethodAmount(m.id) > 0) {
                  <div class="method-pill" [style.border-color]="m.color">
                    <span class="method-icon">{{ m.icon }}</span>
                    <span class="method-name">{{ m.label }}</span>
                    <span class="method-amount" [style.color]="m.color">\${{ getMethodAmount(m.id) | number:'1.2-2' }}</span>
                  </div>
                }
              }
            </div>
          </div>
        }
      }

      <!-- ── TABS ── -->
      <div class="tab-bar">
        <button [class.tab-active]="activeTab === 'transactions'" (click)="activeTab = 'transactions'">📋 Transacciones</button>
        <button [class.tab-active]="activeTab === 'config'" (click)="activeTab = 'config'; loadPaymentMethods()">⚙️ Métodos de Pago</button>
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
                <th>Método</th>
                <th>Trámite</th>
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
                  <td>
                    <span class="method-tag" [class]="'mt-' + (tx.payment_method || 'general')">
                      {{ methodLabel(tx.payment_method || 'general') }}
                    </span>
                  </td>
                  <td class="col-deal">{{ tx.deal_title || '—' }}</td>
                  <td class="col-right">
                    <span [class.txt-income]="tx.type === 'income'" [class.txt-expense]="tx.type === 'expense'">
                      {{ tx.type === 'income' ? '+' : '-' }}\${{ tx.amount | number:'1.2-2' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn-del" (click)="deleteTx(tx.id)" title="Eliminar">✕</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-state">
                    <div class="empty-inner">
                      <span class="empty-icon">📭</span>
                      <p>No hay transacciones en este período.</p>
                      <button class="btn-new small" (click)="openForm()">+ Registrar primera transacción</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ── CONFIG MÉTODOS DE PAGO ── -->
      @if (activeTab === 'config') {
        <div class="config-card">
          <h3 class="section-title">⚙️ Métodos de pago</h3>
          <p class="config-desc">Activa o desactiva métodos predefinidos y crea métodos personalizados. Stripe siempre está disponible desde webhooks automáticos.</p>

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
                  <button class="btn-del-method" (click)="removeCustomMethod(m.id)" title="Eliminar método">🗑</button>
                </div>
              }
            </div>
          }

          <!-- Agregar método personalizado -->
          <div class="add-custom-method">
            <div class="config-section-label" style="margin-bottom: 10px;">➕ Agregar método personalizado</div>
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
            <button class="btn-new" (click)="savePaymentMethods()" [disabled]="savingMethods">
              {{ savingMethods ? 'Guardando...' : '💾 Guardar configuración' }}
            </button>
          </div>
        </div>
      }

      <!-- ── MODAL NUEVA TRANSACCIÓN ── -->
      @if (showForm()) {
        <div class="modal-overlay" (click)="closeForm()">
          <div class="modal-box" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ newTx.type === 'income' ? '📈 Registrar Ingreso' : '📉 Registrar Gasto' }}</h3>
              <button class="btn-close" (click)="closeForm()">✕</button>
            </div>

            <!-- Tipo -->
            <div class="type-toggle">
              <button [class.type-active-income]="newTx.type === 'income'" (click)="newTx.type = 'income'">
                ↑ Ingreso
              </button>
              <button [class.type-active-expense]="newTx.type === 'expense'" (click)="newTx.type = 'expense'">
                ↓ Gasto
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
                <input type="text" [(ngModel)]="newTx.description" placeholder="Ej. Anticipo de trámite de placas">
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
                      <option ngValue="general">📌 General</option>
                    </select>
                    <span class="select-arrow">▾</span>
                  </div>
                } @else {
                  <div class="no-methods-hint">
                    <span>⚠️</span> No tienes métodos configurados. Ve a <strong>⚙️ Métodos de Pago</strong> para activar algunos.
                  </div>
                }
              </div>

              @if (newTx.type === 'income') {
                <div class="field-row">
                  <label>Trámite relacionado (opcional)</label>
                  <div class="select-wrap">
                    <select [(ngModel)]="newTx.deal_id" class="method-select">
                      <option [ngValue]="null">— Ninguno —</option>
                      @for (deal of pendingDeals(); track deal.id) {
                        <option [ngValue]="deal.id">{{ deal.title }} (pendiente: \${{ deal.estimated_value - deal.paid_amount | number:'1.2-2' }})</option>
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
              <button class="btn-new" (click)="saveTx()" [disabled]="!newTx.amount || !newTx.description || !newTx.date">
                Guardar transacción
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── WRAP ── */
    .fin-wrap { display: flex; flex-direction: column; gap: 20px; }

    /* ── HEADER ── */
    .fin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
    .fin-title { margin: 0; font-size: 22px; font-weight: 800; background: linear-gradient(135deg, var(--gold), #e8c96d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .fin-sub { margin: 4px 0 0 0; font-size: 13px; color: var(--muted); }
    .fin-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .btn-new { background: linear-gradient(135deg, var(--gold), #b8952e); color: #000; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: opacity .2s; }
    .btn-new:hover { opacity: .85; }
    .btn-new:disabled { opacity: .5; cursor: not-allowed; }
    .btn-new.small { padding: 6px 14px; font-size: 12px; }

    .btn-export { padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s; border: 1px solid; }
    .btn-export.csv { background: rgba(34,197,94,.1); border-color: rgba(34,197,94,.4); color: #22c55e; }
    .btn-export.csv:hover { background: rgba(34,197,94,.2); }
    .btn-export.pdf { background: rgba(200,169,74,.1); border-color: rgba(200,169,74,.4); color: var(--gold); }
    .btn-export.pdf:hover { background: rgba(200,169,74,.2); }

    /* ── FILTER BAR ── */
    .filter-bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 20px; }
    .date-inputs { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .date-inputs label { font-size: 12px; color: var(--muted); }
    .date-inputs input { background: #ffffff; border: 1px solid rgba(0,0,0,.18); padding: 10px 12px; border-radius: 8px; color: var(--brand-black); font-size: 14px; outline: none; }
    .date-inputs input:focus { border-color: var(--brand-black); box-shadow: 0 0 0 2px rgba(0,0,0,.08); }
    .quick-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .quick-btns button { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 6px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all .2s; }
    .quick-btns button:hover, .quick-btns button.active { background: var(--gold); border-color: var(--gold); color: #000; font-weight: 700; }

    /* ── STATS GRID ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); position: relative; overflow: hidden; }
    .stat-card::before { content: ''; position: absolute; inset: 0; opacity: .05; pointer-events: none; }
    .income-card::before { background: #22c55e; }
    .expense-card::before { background: #ef4444; }
    .balance-card::before { background: var(--gold); }
    .month-card::before { background: #3b82f6; }
    .income-card { border-top: 3px solid #22c55e; }
    .expense-card { border-top: 3px solid #ef4444; }
    .balance-card { border-top: 3px solid var(--gold); }
    .balance-card.negative { border-top-color: #ef4444; }
    .month-card { border-top: 3px solid #3b82f6; }
    .stat-icon { font-size: 28px; flex-shrink: 0; }
    .stat-body { display: flex; flex-direction: column; gap: 4px; }
    .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
    .stat-val { font-size: 22px; font-weight: 800; color: var(--text); }
    .income-val { color: #22c55e; }
    .expense-val { color: #ef4444; }
    .balance-pos { color: var(--gold) !important; }
    .balance-neg { color: #ef4444 !important; }

    /* ── METHOD BREAKDOWN ── */
    .section-title { margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: var(--text); }
    .method-breakdown { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; }
    .method-pills { display: flex; flex-wrap: wrap; gap: 10px; }
    .method-pill { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,.2); border: 1px solid; border-radius: 8px; padding: 8px 14px; }
    .method-icon { font-size: 18px; }
    .method-name { font-size: 13px; color: var(--muted); }
    .method-amount { font-size: 15px; font-weight: 700; }

    /* ── TABS ── */
    .tab-bar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); }
    .tab-bar button { background: transparent; border: none; border-bottom: 2px solid transparent; padding: 10px 18px; font-size: 13px; color: var(--muted); cursor: pointer; font-weight: 600; margin-bottom: -1px; transition: all .2s; }
    .tab-bar button:hover { color: var(--text); }
    .tab-active { color: var(--gold) !important; border-bottom-color: var(--gold) !important; }

    /* ── TABLE ── */
    .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; min-width: 640px; }
    .fin-table th { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; text-align: left; }
    .fin-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.03); font-size: 13px; color: var(--text); }
    .fin-table tr:last-child td { border-bottom: none; }
    .tx-row:hover { background: rgba(255,255,255,.02); }
    .col-right { text-align: right; }
    .col-date { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .col-desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-deal { color: var(--muted); font-size: 12px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .badge-income { background: rgba(34,197,94,.15); color: #22c55e; }
    .badge-expense { background: rgba(239,68,68,.15); color: #ef4444; }

    .txt-income { color: #22c55e; font-weight: 700; }
    .txt-expense { color: #ef4444; font-weight: 700; }

    .method-tag { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .mt-stripe { background: rgba(99,102,241,.15); color: #818cf8; }
    .mt-efectivo { background: rgba(34,197,94,.15); color: #22c55e; }
    .mt-transferencia { background: rgba(59,130,246,.15); color: #60a5fa; }
    .mt-mercadopago { background: rgba(168,85,247,.15); color: #c084fc; }
    .mt-general { background: rgba(255,255,255,.07); color: var(--muted); }

    .btn-del { background: transparent; border: 1px solid transparent; color: var(--muted); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all .2s; }
    .btn-del:hover { border-color: rgba(239,68,68,.4); color: #ef4444; background: rgba(239,68,68,.1); }

    .empty-state { text-align: center; padding: 48px !important; }
    .empty-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon { font-size: 40px; }
    .empty-inner p { color: var(--muted); margin: 0; }

    /* ── CONFIG ── */
    .config-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .config-desc { color: var(--muted); font-size: 13px; margin: 0; line-height: 1.6; }
    .config-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .methods-list { display: flex; flex-direction: column; gap: 8px; }
    .method-toggle { display: block; cursor: pointer; margin-bottom: 0; }
    .method-toggle.disabled { cursor: default; opacity: .6; }
    .method-toggle input { display: none; }
    .method-toggle-body { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: rgba(0,0,0,.2); border: 2px solid; border-radius: 10px; transition: all .2s; }
    .mt-icon { font-size: 22px; flex-shrink: 0; }
    .method-toggle-body strong { display: block; font-size: 14px; color: var(--text); }
    .method-toggle-body small { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
    .toggle-status { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,.05); color: var(--muted); flex-shrink: 0; }
    .toggle-status.on { background: rgba(34,197,94,.15); color: #22c55e; }

    /* Métodos personalizados */
    .method-custom-item { display: flex; align-items: center; gap: 8px; }
    .btn-del-method { background: transparent; border: 1px solid rgba(239,68,68,.3); color: #ef4444; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 14px; flex-shrink: 0; transition: all .2s; }
    .btn-del-method:hover { background: rgba(239,68,68,.15); }

    /* Agregar método personalizado */
    .add-custom-method { background: rgba(200,169,74,.04); border: 1px dashed rgba(200,169,74,.3); border-radius: 10px; padding: 16px; }
    .custom-method-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .emoji-picker-wrap { position: relative; flex-shrink: 0; }
    .emoji-btn { width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--border); background: rgba(0,0,0,.2); font-size: 22px; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; }
    .emoji-btn:hover { border-color: var(--gold); background: rgba(200,169,74,.1); }
    .emoji-grid { position: absolute; top: calc(100% + 6px); left: 0; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,.5); min-width: 200px; }
    .emoji-opt { background: transparent; border: none; font-size: 20px; width: 32px; height: 32px; cursor: pointer; border-radius: 6px; transition: background .15s; }
    .emoji-opt:hover { background: rgba(255,255,255,.1); }
    .custom-name-input { flex: 1; min-width: 160px; background: #ffffff; border: 1px solid rgba(0,0,0,.18); padding: 10px 12px; border-radius: 8px; color: var(--brand-black); font-size: 14px; outline: none; }
    .custom-name-input:focus { border-color: var(--brand-black); box-shadow: 0 0 0 2px rgba(0,0,0,.08); }
    .btn-add-method { background: rgba(200,169,74,.15); border: 1px solid rgba(200,169,74,.4); color: var(--gold); padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; transition: all .2s; }
    .btn-add-method:hover { background: rgba(200,169,74,.25); }
    .btn-add-method:disabled { opacity: .4; cursor: not-allowed; }

    /* ── MODAL ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
    .modal-box { background: var(--bg); border: 1px solid var(--border); border-radius: 18px; width: 480px; max-width: 100%; display: flex; flex-direction: column; box-shadow: 0 24px 80px rgba(0,0,0,.5); animation: slideUp .2s ease; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
    .modal-header h3 { margin: 0; font-size: 16px; color: var(--gold); }
    .btn-close { background: transparent; border: none; color: var(--muted); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .btn-close:hover { color: var(--text); background: rgba(255,255,255,.08); }

    .type-toggle { display: flex; gap: 6px; padding: 16px 24px 0; }
    .type-toggle button { flex: 1; padding: 10px; border-radius: 8px; border: 2px solid var(--border); background: transparent; color: var(--muted); font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; }
    .type-active-income { border-color: #22c55e !important; color: #22c55e !important; background: rgba(34,197,94,.1) !important; }
    .type-active-expense { border-color: #ef4444 !important; color: #ef4444 !important; background: rgba(239,68,68,.1) !important; }

    .modal-fields { display: flex; flex-direction: column; gap: 14px; padding: 16px 24px; }
    .field-row { display: flex; flex-direction: column; gap: 6px; }
    .field-row label { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    .field-row input, .field-row select { background: #ffffff; border: 1px solid rgba(0,0,0,.18); padding: 10px 12px; border-radius: 8px; color: var(--brand-black); font-size: 14px; outline: none; width: 100%; box-sizing: border-box; }
    .field-row input:focus, .field-row select:focus { border-color: var(--brand-black); box-shadow: 0 0 0 2px rgba(0,0,0,.08); }
    .input-money { display: flex; align-items: center; background: #ffffff; border: 1px solid rgba(0,0,0,.18); border-radius: 8px; overflow: hidden; }
    .input-money span { padding: 0 12px; color: var(--brand-black); font-weight: 700; font-size: 16px; border-right: 1px solid rgba(0,0,0,.12); background: #f5f3f0; }
    .input-money input { border: none; background: transparent; flex: 1; color: var(--brand-black); }

    /* Styled select for payment method */
    .select-wrap { position: relative; }
    .method-select { appearance: none; -webkit-appearance: none; background: #ffffff; border: 1px solid rgba(0,0,0,.18); padding: 11px 40px 11px 14px; border-radius: 8px; color: var(--brand-black); font-size: 14px; outline: none; width: 100%; box-sizing: border-box; cursor: pointer; transition: border-color .2s; }
    .method-select:focus { border-color: var(--brand-black); box-shadow: 0 0 0 2px rgba(0,0,0,.08); }
    .method-select option { background: #ffffff; color: var(--brand-black); padding: 6px; }
    .select-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; font-size: 14px; }
    .no-methods-hint { background: rgba(200,169,74,.08); border: 1px dashed rgba(200,169,74,.3); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
    .no-methods-hint strong { color: var(--gold); }

    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 0 24px 20px; }
    .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .btn-ghost:hover { background: rgba(255,255,255,.05); }
  `]
})
export class FinancesComponent implements OnInit {
  dashboard = signal<FinDashboard | null>(null);
  transactions = signal<FinTransaction[]>([]);
  pendingDeals = signal<any[]>([]);
  showForm = signal(false);
  activeTab: 'transactions' | 'config' = 'transactions';

  filterFrom = '';
  filterTo = '';
  quickRange = 'all';

  // Payment methods config
  enabledMethods = signal<{ id: string; label: string; icon: string; color: string }[]>([]);
  allMethods = [...FIN_ALL_METHODS];
  customMethods: { id: string; label: string; icon: string; color: string }[] = [];
  selectedMethodIds: string[] = ['efectivo', 'transferencia', 'mercadopago', 'stripe'];
  savingMethods = false;

  // Methods shown inside the transaction form (refreshed on each open)
  formMethods = signal<{ id: string; label: string; icon: string; color: string }[]>([]);

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

  constructor(private fin: FinancesService, private toast: ToastService) {}

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
      payment_method: 'efectivo',
    };
  }

  loadData() {
    const from = this.filterFrom || undefined;
    const to = this.filterTo || undefined;
    this.fin.getDashboard(from, to).subscribe(d => this.dashboard.set(d));
    this.fin.getTransactions(from, to).subscribe(t => this.transactions.set(t));
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
    this.loadData();
  }

  loadPaymentMethods() {
    this.fin.getPaymentMethods().subscribe(res => {
      // res.methods can contain predefined IDs AND custom method objects {id, label, icon}
      const predefinedIds = this.allMethods.map(m => m.id);
      this.customMethods = [];
      this.selectedMethodIds = ['stripe'];

      for (const m of res.methods) {
        if (typeof m === 'string') {
          this.selectedMethodIds.push(m);
        } else if (m && typeof m === 'object') {
          // Custom method object
          const cm = m as any;
          if (!this.customMethods.find(x => x.id === cm.id)) {
            this.customMethods.push({ id: cm.id, label: cm.label, icon: cm.icon || '💰', color: '#C8A94A' });
          }
          this.selectedMethodIds.push(cm.id);
        }
      }
      this.updateEnabledMethods();
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
    // Build set of predefined IDs as plain strings to avoid literal-type includes() error
    const predefinedSet = new Set<string>(this.allMethods.map(m => String(m.id)));
    const toSave: (string | { id: string; label: string; icon: string })[] = [];

    for (const id of this.selectedMethodIds) {
      if (id === 'stripe') continue;
      if (predefinedSet.has(id)) {
        toSave.push(id);
      } else {
        const cm = this.customMethods.find(m => m.id === id);
        if (cm) toSave.push({ id: cm.id, label: cm.label, icon: cm.icon });
      }
    }
    // Also persist disabled custom methods so they aren't lost on next load
    for (const cm of this.customMethods) {
      const alreadyIn = toSave.some(x => (typeof x === 'object' ? x.id : x) === cm.id);
      if (!alreadyIn) toSave.push({ id: cm.id, label: cm.label, icon: cm.icon });
    }

    this.savingMethods = true;
    this.fin.savePaymentMethods(toSave).subscribe({
      next: () => {
        this.savingMethods = false;
        this.toast.success('La configuración de métodos de pago fue guardada.', '✅ Configuración guardada');
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

    // Reload methods fresh from API so the select always reflects the saved config
    this.fin.getPaymentMethods().subscribe(res => {
      const predefinedMap: Record<string, { id: string; label: string; icon: string; color: string }> = {
        stripe:        { id: 'stripe',        label: 'Stripe',        icon: '⚡', color: '#6366f1' },
        efectivo:      { id: 'efectivo',      label: 'Efectivo',      icon: '💵', color: '#22c55e' },
        transferencia: { id: 'transferencia', label: 'Transferencia', icon: '🏦', color: '#3b82f6' },
        mercadopago:   { id: 'mercadopago',   label: 'MercadoPago',   icon: '💳', color: '#a855f7' },
      };

      const methods: { id: string; label: string; icon: string; color: string }[] = [];
      for (const m of res.methods) {
        if (typeof m === 'string') {
          if (predefinedMap[m]) methods.push(predefinedMap[m]);
        } else if (m && typeof m === 'object') {
          const cm = m as any;
          methods.push({ id: cm.id, label: cm.label, icon: cm.icon || '💰', color: '#C8A94A' });
        }
      }

      this.formMethods.set(methods);

      // Set smart default: first configured method, not stripe (manual entry)
      const first = methods.find(x => x.id !== 'stripe') || methods[0];
      if (first) this.newTx.payment_method = first.id;
      else this.newTx.payment_method = 'general';
    });

    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); }

  saveTx() {
    const txType = this.newTx.type;
    this.fin.createTransaction(this.newTx as any).subscribe({
      next: () => {
        this.closeForm();
        this.loadData();
        this.toast.success(
          txType === 'income' ? 'Ingreso registrado correctamente.' : 'Gasto registrado correctamente.',
          txType === 'income' ? '📈 Ingreso guardado' : '📉 Gasto guardado'
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
    window.open(this.fin.exportCsv(this.filterFrom || undefined, this.filterTo || undefined), '_blank');
    this.toast.info('Tu archivo CSV se está descargando.', '📊 Exportando CSV');
  }

  doExportPdf() {
    window.open(this.fin.exportPdf(this.filterFrom || undefined, this.filterTo || undefined), '_blank');
    this.toast.info('Tu reporte PDF se está generando.', '📄 Exportando PDF');
  }

  methodLabel(method: string): string {
    const labels: Record<string, string> = {
      stripe: '⚡ Stripe',
      efectivo: '💵 Efectivo',
      transferencia: '🏦 Transferencia',
      mercadopago: '💳 MercadoPago',
      general: '📌 General',
    };
    if (labels[method]) return labels[method];
    // Check custom methods
    const custom = this.customMethods.find(m => m.id === method);
    if (custom) return `${custom.icon} ${custom.label}`;
    return method;
  }

  hasMethodData(): boolean {
    const bm = this.dashboard()?.byMethod;
    return !!bm && Object.values(bm).some(v => v > 0);
  }

  getMethodAmount(id: string): number {
    return Number(this.dashboard()?.byMethod?.[id] || 0);
  }
}
