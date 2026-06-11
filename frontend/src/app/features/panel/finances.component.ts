import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancesService } from '../../core/api.service';
import { FinDashboard, FinTransaction } from '../../models';

@Component({
  selector: 'app-finances',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="fin-container">
      <div class="header">
        <h2>💰 Finanzas</h2>
      </div>
      
      @if (dashboard()) {
        <div class="stats-grid">
          <div class="stat-card income">
            <span class="label">Ingresos Totales (Cobrado)</span>
            <span class="value">\${{ dashboard()!.totalIncome | number:'1.2-2' }}</span>
          </div>
          <div class="stat-card projection">
            <span class="label">Por Cobrar (Pendiente)</span>
            <span class="value">\${{ dashboard()!.projectedIncome | number:'1.2-2' }}</span>
          </div>
          <div class="stat-card expense">
            <span class="label">Egresos Totales</span>
            <span class="value">\${{ dashboard()!.totalExpense | number:'1.2-2' }}</span>
          </div>
          <div class="stat-card balance">
            <span class="label">Balance Neto</span>
            <span class="value" [class.negative]="dashboard()!.netBalance < 0">\${{ dashboard()!.netBalance | number:'1.2-2' }}</span>
          </div>
        </div>
      }

      <div class="actions-row">
        <button class="btn-copy" (click)="openForm()">+ Nueva Transacción</button>
      </div>

      <div class="table-container">
        <table class="fin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Trámite Relacionado</th>
              <th>Monto</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (tx of transactions(); track tx.id) {
              <tr>
                <td>{{ tx.date | date:'shortDate' }}</td>
                <td>
                  <span class="badge" [class.income]="tx.type === 'income'" [class.expense]="tx.type === 'expense'">
                    {{ tx.type === 'income' ? 'Ingreso' : 'Egreso' }}
                  </span>
                </td>
                <td>{{ tx.description }}</td>
                <td>{{ tx.deal_title || '-' }}</td>
                <td [class.txt-income]="tx.type==='income'" [class.txt-expense]="tx.type==='expense'">
                  \${{ tx.amount | number:'1.2-2' }}
                </td>
                <td>
                  <button class="btn-delete small" (click)="deleteTx(tx.id)">Eliminar</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-state">No hay transacciones registradas.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      @if (showForm()) {
        <div class="modal-overlay">
          <div class="modal-content glass-card">
            <h3>Registrar Transacción</h3>
            <label>Tipo</label>
            <select [(ngModel)]="newTx.type">
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
            
            <label>Monto</label>
            <input type="number" [(ngModel)]="newTx.amount" placeholder="0.00">
            
            <label>Descripción</label>
            <input type="text" [(ngModel)]="newTx.description" placeholder="Ej. Anticipo de Placas">
            
            <label>Fecha</label>
            <input type="date" [(ngModel)]="newTx.date">

            @if (newTx.type === 'income') {
              <label>Trámite Relacionado (Opcional)</label>
              <select [(ngModel)]="newTx.deal_id">
                <option [ngValue]="null">-- Ninguno --</option>
                @for (deal of pendingDeals(); track deal.id) {
                  <option [ngValue]="deal.id">{{ deal.title }} (Pendiente: \${{ deal.estimated_value - deal.paid_amount | number:'1.2-2' }})</option>
                }
              </select>
            }

            <div class="actions">
              <button class="btn-ghost" (click)="closeForm()">Cancelar</button>
              <button class="btn-copy" (click)="saveTx()" [disabled]="!newTx.amount || !newTx.description || !newTx.date">Guardar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .fin-container { display: flex; flex-direction: column; gap: 24px; }
    .header h2 { margin: 0; font-family: var(--f-display); color: var(--gold); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .stat-card.income { border-top: 3px solid var(--mx-green); }
    .stat-card.projection { border-top: 3px solid #3b82f6; } /* Azul para proyección */
    .stat-card.expense { border-top: 3px solid var(--mx-red); }
    .stat-card.balance { border-top: 3px solid var(--gold); }
    .stat-card .label { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: var(--text); }
    .stat-card .value.negative { color: var(--mx-red); }
    
    .actions-row { display: flex; justify-content: flex-end; }
    
    .table-container { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; text-align: left; }
    .fin-table th { padding: 14px 20px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 13px; font-weight: 600; }
    .fin-table td { padding: 14px 20px; border-bottom: 1px solid var(--border); font-size: 14px; }
    .fin-table tr:last-child td { border-bottom: none; }
    .fin-table tr:hover { background: rgba(255,255,255,0.02); }
    
    .badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge.income { background: var(--mx-green-dim); color: var(--mx-green); }
    .badge.expense { background: var(--mx-red-dim); color: var(--mx-red); }
    .txt-income { color: var(--mx-green); font-weight: 600; }
    .txt-expense { color: var(--mx-red); font-weight: 600; }
    
    .empty-state { text-align: center; color: var(--muted); padding: 40px !important; }

    .modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
    .modal-content { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 32px; width: 400px; max-width: 90%; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-modal); }
    .modal-content h3 { margin: 0 0 8px 0; color: var(--gold); }
    label { font-size: 12px; color: var(--muted); margin-bottom: -10px; }
    input, select { background: rgba(0,0,0,0.2); border: 1px solid var(--border); padding: 10px; border-radius: 8px; color: var(--text); outline: none; }
    input:focus, select:focus { border-color: var(--gold); }
    .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }

    .btn-copy { background: linear-gradient(135deg, var(--gold), #b8952e); color: var(--bg); border: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-copy:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 10px 20px; border-radius: 8px; cursor: pointer; }
    .btn-delete { background: transparent; border: 1px solid rgba(206,17,38,0.3); color: var(--mx-red); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }
    .btn-delete:hover { background: var(--mx-red-dim); }
  `]
})
export class FinancesComponent implements OnInit {
  dashboard = signal<FinDashboard | null>(null);
  transactions = signal<FinTransaction[]>([]);
  pendingDeals = signal<any[]>([]);
  showForm = signal(false);
  
  newTx = {
    type: 'income',
    amount: null,
    description: '',
    category: 'general',
    date: new Date().toISOString().split('T')[0],
    deal_id: null
  };

  constructor(private fin: FinancesService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.fin.getDashboard().subscribe(d => this.dashboard.set(d));
    this.fin.getTransactions().subscribe(t => this.transactions.set(t));
  }

  openForm() {
    this.fin.getPendingDeals().subscribe(d => this.pendingDeals.set(d));
    this.newTx = { type: 'income', amount: null, description: '', category: 'general', date: new Date().toISOString().split('T')[0], deal_id: null };
    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); }

  saveTx() {
    this.fin.createTransaction(this.newTx as any).subscribe(() => {
      this.closeForm();
      this.loadData();
    });
  }

  deleteTx(id: string) {
    if (confirm('¿Eliminar transacción?')) {
      this.fin.deleteTransaction(id).subscribe(() => this.loadData());
    }
  }
}
