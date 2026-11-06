import { Component, input, output, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePlus, LucideSearch, LucideFilter } from '@lucide/angular';
import { CrmDeal } from '../../models';

const STAGE_COLORS = ['#579bfc', '#0073ea', '#a25ddc', '#fdab3d', '#00c875', '#e2445c', '#037f4c', '#9d99b0', '#ff642e'];

@Component({
  selector: 'app-crm-deals-board',
  standalone: true,
  imports: [DecimalPipe, FormsModule, LucidePlus, LucideSearch, LucideFilter],
  template: `
    <div class="mon-board">
      <header class="mon-board-head">
        <div>
          <h2 class="mon-board-title">Acuerdos</h2>
          <div class="mon-board-tabs" role="tablist">
            <button type="button" role="tab" class="mon-board-tab" [class.active]="view() === 'tabla'" (click)="view.set('tabla')">Tabla principal</button>
            <button type="button" role="tab" class="mon-board-tab" [class.active]="view() === 'pipeline'" (click)="view.set('pipeline')">Pipeline</button>
          </div>
        </div>
        <div class="mon-board-actions">
          <button type="button" class="mon-btn-primary" (click)="addDeal.emit()">
            <svg lucidePlus [size]="16" aria-hidden="true"></svg>
            Agregar acuerdo
          </button>
        </div>
      </header>

      @if (view() === 'tabla') {
        <div class="mon-board-toolbar">
          <label class="mon-search">
            <svg lucideSearch [size]="15" aria-hidden="true"></svg>
            <input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Buscar" />
          </label>
          <button type="button" class="mon-tool-btn" (click)="view.set('pipeline')">
            <svg lucideFilter [size]="15" aria-hidden="true"></svg>
            Ver pipeline
          </button>
        </div>

        <div class="mon-insight">
          <div>
            <strong>Salud del pipeline</strong>
            <p>{{ activeDeals().length }} acuerdos activos · {{ closedDeals().length }} cerrados</p>
          </div>
          <div class="mon-insight-stats">
            <span>Valor activo <b>\${{ activeTotal() | number:'1.0-0' }}</b></span>
            <span>Cerrado <b>\${{ closedTotal() | number:'1.0-0' }}</b></span>
          </div>
        </div>

        <div class="mon-table-wrap">
          @for (group of groups(); track group.id) {
            <button type="button" class="mon-group-head" (click)="toggle(group.id)">
              <span class="mon-group-bar" [style.background]="group.color"></span>
              <span class="mon-chevron">{{ collapsed()[group.id] ? '▸' : '▾' }}</span>
              <strong>{{ group.label }}</strong>
              <span class="mon-count">{{ group.items.length }}</span>
            </button>

            @if (!collapsed()[group.id]) {
              <table class="mon-table">
                <thead>
                  <tr>
                    <th class="col-check"></th>
                    <th>Acuerdo</th>
                    <th>Etapa</th>
                    <th>Contacto</th>
                    <th>Teléfono</th>
                    <th class="col-num">Valor</th>
                    <th>Días</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of group.items; track d.id) {
                    <tr (click)="dealSelect.emit(d)">
                      <td class="col-check" (click)="$event.stopPropagation()">
                        <input type="checkbox" aria-label="Seleccionar" />
                      </td>
                      <td>
                        <button type="button" class="mon-deal-name" (click)="$event.stopPropagation(); dealSelect.emit(d)">{{ d.title }}</button>
                      </td>
                      <td>
                        <span class="mon-stage-pill" [style.background]="stageColor(d.stage)">{{ stageLabel(d.stage) }}</span>
                      </td>
                      <td>
                        <span class="mon-contact-chip">{{ d.contact?.name || '—' }}</span>
                      </td>
                      <td class="mon-muted">{{ d.contact?.phone || '—' }}</td>
                      <td class="col-num">\${{ d.estimatedValue || 0 | number:'1.0-0' }}</td>
                      <td class="mon-muted">{{ d.daysInStage ?? '—' }}{{ d.daysInStage != null ? 'd' : '' }}</td>
                      <td>
                        <span class="mon-pay-pill" [class.paid]="d.paymentStatus === 'paid'">
                          {{ d.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5">Total</td>
                    <td class="col-num">\${{ groupTotal(group.items) | number:'1.0-0' }}</td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
              <button type="button" class="mon-add-row" (click)="addDeal.emit()">+ Agregar acuerdo</button>
            }
          }
        </div>
      } @else {
        <ng-content />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mon-board {
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      padding: 20px 22px 24px;
      color: #323338;
      font-family: Figtree, system-ui, sans-serif;
    }
    .mon-board-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .mon-board-title {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .mon-board-tabs { display: flex; gap: 4px; }
    .mon-board-tab {
      border: none;
      background: transparent;
      color: #676879;
      font: 600 13px Figtree, system-ui, sans-serif;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
    }
    .mon-board-tab.active {
      color: #0073ea;
      background: #e5f4ff;
    }
    .mon-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      border-radius: 8px;
      background: #0073ea;
      color: #fff;
      font: 600 14px Figtree, system-ui, sans-serif;
      padding: 10px 14px;
      cursor: pointer;
    }
    .mon-btn-primary:hover { background: #0060c2; }
    .mon-board-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .mon-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      background: #f5f6f8;
      min-width: min(280px, 100%);
    }
    .mon-search input {
      border: none !important;
      background: transparent !important;
      outline: none;
      color: #323338 !important;
      font-size: 14px;
      width: 100%;
      padding: 0 !important;
    }
    .mon-tool-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      background: #fff;
      color: #323338;
      padding: 8px 12px;
      font: 600 13px Figtree, system-ui, sans-serif;
      cursor: pointer;
    }
    .mon-insight {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 16px;
      border-radius: 10px;
      background: #e8f7f3;
      border: 1px solid #b7ebe0;
    }
    .mon-insight strong { display: block; font-size: 14px; margin-bottom: 2px; }
    .mon-insight p { margin: 0; font-size: 13px; color: #676879; }
    .mon-insight-stats { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #676879; }
    .mon-insight-stats b { color: #323338; }
    .mon-group-head {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: none;
      background: transparent;
      padding: 12px 4px 8px;
      cursor: pointer;
      font: 700 14px Figtree, system-ui, sans-serif;
      color: #323338;
      text-align: left;
    }
    .mon-group-bar { width: 4px; height: 16px; border-radius: 4px; }
    .mon-chevron { color: #676879; width: 12px; }
    .mon-count {
      background: #f0f1f5;
      color: #676879;
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .mon-table-wrap { overflow-x: auto; }
    .mon-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      min-width: 860px;
    }
    .mon-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #676879;
      padding: 8px 10px;
      border-bottom: 1px solid #e6e9ef;
      border-right: 1px solid #e6e9ef;
      background: #f7f8fa;
      white-space: nowrap;
    }
    .mon-table td {
      padding: 10px;
      border-bottom: 1px solid #e6e9ef;
      border-right: 1px solid #eef0f4;
      font-size: 14px;
      vertical-align: middle;
    }
    .mon-table tbody tr { cursor: pointer; }
    .mon-table tbody tr:hover td { background: #f8fbff; }
    .mon-table tfoot td {
      background: #fafbfc;
      font-weight: 700;
      color: #323338;
    }
    .col-check { width: 36px; text-align: center; }
    .col-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mon-deal-name {
      border: none;
      background: none;
      padding: 0;
      color: #323338;
      font: 600 14px Figtree, system-ui, sans-serif;
      text-align: left;
      cursor: pointer;
    }
    .mon-deal-name:hover { color: #0073ea; text-decoration: underline; }
    .mon-stage-pill {
      display: inline-flex;
      max-width: 160px;
      padding: 4px 10px;
      border-radius: 4px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mon-contact-chip {
      display: inline-flex;
      padding: 3px 8px;
      border-radius: 999px;
      background: #e5f4ff;
      color: #0073ea;
      font-size: 12px;
      font-weight: 600;
    }
    .mon-pay-pill {
      display: inline-flex;
      padding: 3px 8px;
      border-radius: 4px;
      background: #fdab3d;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }
    .mon-pay-pill.paid { background: #00c875; }
    .mon-muted { color: #676879; }
    .mon-add-row {
      width: 100%;
      border: none;
      border-bottom: 1px solid #e6e9ef;
      background: transparent;
      color: #676879;
      text-align: left;
      padding: 10px 12px;
      font: 400 13px Figtree, system-ui, sans-serif;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .mon-add-row:hover { color: #0073ea; background: #f8fbff; }

    @media (max-width: 760px) {
      .mon-board { padding: 16px 14px; }
      .mon-board-title { font-size: 20px; }
      .mon-insight { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class CrmDealsBoardComponent {
  deals = input.required<CrmDeal[]>();
  stageLabels = input<Record<string, string>>({});

  dealSelect = output<CrmDeal>();
  addDeal = output<void>();

  view = signal<'tabla' | 'pipeline'>('tabla');
  search = signal('');
  collapsed = signal<Record<string, boolean>>({});

  filteredDeals = computed(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.deals();
    if (!q) return all;
    return all.filter((d) => {
      const blob = `${d.title} ${d.contact?.name || ''} ${d.contact?.phone || ''} ${d.stage}`.toLowerCase();
      return blob.includes(q);
    });
  });

  activeDeals = computed(() =>
    this.filteredDeals().filter((d) => !['completado', 'vendido', 'perdido'].includes(d.stage)),
  );
  closedDeals = computed(() =>
    this.filteredDeals().filter((d) => d.stage === 'completado' || d.stage === 'vendido'),
  );
  lostDeals = computed(() => this.filteredDeals().filter((d) => d.stage === 'perdido'));

  groups = computed(() => {
    const list: { id: string; label: string; color: string; items: CrmDeal[] }[] = [];
    const active = this.activeDeals();
    const closed = this.closedDeals();
    const lost = this.lostDeals();
    if (active.length || (!closed.length && !lost.length)) {
      list.push({ id: 'activos', label: 'Acuerdos activos', color: '#0073ea', items: active });
    }
    if (closed.length) list.push({ id: 'cerrados', label: 'Cerrados: ganados', color: '#00c875', items: closed });
    if (lost.length) list.push({ id: 'perdidos', label: 'Cerrados: perdidos', color: '#e2445c', items: lost });
    return list;
  });

  activeTotal = computed(() => this.groupTotal(this.activeDeals()));
  closedTotal = computed(() => this.groupTotal(this.closedDeals()));

  groupTotal(items: CrmDeal[]) {
    return items.reduce((s, d) => s + Number(d.estimatedValue || 0), 0);
  }

  toggle(id: string) {
    this.collapsed.update((m) => ({ ...m, [id]: !m[id] }));
  }

  stageLabel(stage: string) {
    return this.stageLabels()[stage] || stage;
  }

  stageColor(stage: string) {
    let h = 0;
    for (let i = 0; i < stage.length; i++) h = (h + stage.charCodeAt(i) * (i + 1)) % STAGE_COLORS.length;
    if (stage === 'completado' || stage === 'vendido') return '#00c875';
    if (stage === 'perdido') return '#e2445c';
    if (stage.includes('pago')) return '#fdab3d';
    return STAGE_COLORS[h];
  }
}
