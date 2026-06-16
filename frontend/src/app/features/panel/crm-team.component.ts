import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmService } from '../../core/api.service';

interface Employee {
  id?: string;
  name: string;
  email: string;
  password?: string;
  permissions: string[];
}

@Component({
  selector: 'app-crm-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dash-card team-panel">
      <h2 class="card-title">👥 Mi Equipo</h2>
      <p class="card-desc">Agrega colaboradores y elige qué secciones del panel pueden ver y usar.</p>

      <button type="button" class="btn-copy team-add-btn" (click)="openForm()">+ Nuevo empleado</button>

      @if (message()) {
        <div class="team-alert" [class.error]="message().startsWith('Error') || message().startsWith('Faltan')">{{ message() }}</div>
      }

      @if (showForm()) {
        <div class="team-form-card">
          <h3 class="team-form-title">{{ editingId() ? 'Editar empleado' : 'Crear empleado' }}</h3>
          <div class="team-form-grid">
            <div class="form-group">
              <label>Nombre</label>
              <input [(ngModel)]="form.name" placeholder="Ej. Juan Pérez" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input [(ngModel)]="form.email" [disabled]="!!editingId()" placeholder="juan@gestoria.com" />
            </div>
            <div class="form-group">
              <label>Contraseña {{ editingId() ? '(opcional)' : '' }}</label>
              <input type="password" [(ngModel)]="form.password" placeholder="••••••••" />
            </div>
          </div>

          <div class="team-perms-section">
            <h4>¿Qué puede hacer este empleado?</h4>
            <p class="team-perms-hint">Marca las secciones a las que tendrá acceso en el panel.</p>
            <div class="team-perms-grid">
              @for (mod of availableModules; track mod.id) {
                <label class="team-perm-option">
                  <input type="checkbox"
                         [checked]="hasPerm(mod.id)"
                         (change)="togglePerm(mod.id, $any($event.target).checked)" />
                  <div class="team-perm-text">
                    <span class="team-perm-label">{{ mod.label }}</span>
                    <span class="team-perm-desc">{{ mod.hint }}</span>
                  </div>
                </label>
              }
            </div>
          </div>

          <div class="team-form-actions">
            <button type="button" class="btn-ghost" (click)="closeForm()">Cancelar</button>
            <button type="button" class="btn-copy" (click)="save()">Guardar empleado</button>
          </div>
        </div>
      }

      <div class="team-list">
        @for (emp of team(); track emp.id) {
          <div class="team-member-card">
            <div class="member-main">
              <div class="member-avatar">{{ initials(emp.name) }}</div>
              <div class="member-info">
                <h4>{{ emp.name }}</h4>
                <span>{{ emp.email }}</span>
              </div>
            </div>
            <div class="member-perms">
              @for (p of emp.permissions; track p) {
                <span class="member-perm-badge">{{ getModLabel(p) }}</span>
              }
              @if (emp.permissions.length === 0) {
                <span class="member-perm-empty">Sin permisos asignados</span>
              }
            </div>
            <div class="member-actions">
              <button type="button" class="member-btn" (click)="editEmp(emp)" title="Editar">
                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Editar
              </button>
              <button type="button" class="member-btn member-btn--delete" (click)="deleteEmp(emp)" title="Eliminar">
                <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                Eliminar
              </button>
            </div>
          </div>
        } @empty {
          <div class="team-empty">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>Aún no tienes empleados</p>
            <span>Crea el primero para que tu equipo acceda al panel con permisos limitados.</span>
            <button type="button" class="btn-copy team-add-btn" (click)="openForm()">+ Nuevo empleado</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dash-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 3px solid var(--brand-black);
      border-radius: 0;
      padding: 28px 28px 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-card);
    }

    .card-title {
      font-family: var(--f-display);
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--brand-black);
      margin-bottom: 6px;
    }

    .card-desc {
      font-family: var(--f-ui);
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .team-panel { margin-bottom: 0; }

    .team-add-btn {
      margin-bottom: 20px;
    }

    .btn-copy {
      background: var(--brand-black);
      color: #ffffff;
      border: 2px solid var(--brand-black);
      padding: 10px 22px;
      border-radius: 0;
      font-weight: 700;
      font-family: var(--f-display);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-copy:hover {
      background: transparent;
      color: var(--brand-black);
    }

    .btn-ghost {
      font-family: var(--f-display);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--brand-black);
      background: transparent;
      border: 2px solid var(--brand-black);
      padding: 10px 20px;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: var(--transition);
    }

    .btn-ghost:hover {
      border-color: var(--brand-black);
      color: #ffffff;
      background: var(--brand-black);
    }

    .team-alert {
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      color: #166534;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .team-alert.error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #b91c1c;
    }

    .team-form-card {
      background: #faf9f7;
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .team-form-title {
      font-family: var(--f-display);
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--brand-black);
      margin: 0 0 16px;
    }

    .team-form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 16px;
    }

    .team-form-grid .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .team-form-grid .form-group input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid rgba(0,0,0,.14);
      color: var(--brand-black);
      border-radius: 8px;
      font-size: 14px;
      font-family: var(--f-ui);
      outline: none;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    .team-form-grid .form-group input:focus {
      border-color: var(--brand-black);
      box-shadow: 0 0 0 2px rgba(0,0,0,.06);
    }

    .team-form-grid .form-group input:disabled {
      background: #f5f3f0;
      color: var(--muted);
    }

    .team-perms-section {
      padding-top: 16px;
      border-top: 1px solid rgba(0,0,0,.08);
    }

    .team-perms-section h4 {
      font-family: var(--f-display);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--brand-black);
      margin: 0 0 4px;
    }

    .team-perms-hint {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 12px;
      line-height: 1.45;
    }

    .team-perms-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .team-perm-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid rgba(0,0,0,.1);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    .team-perm-option:hover {
      border-color: var(--brand-black);
      box-shadow: 0 0 0 1px rgba(0,0,0,.04);
    }

    .team-perm-option input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--brand-black);
      flex-shrink: 0;
      cursor: pointer;
      margin-top: 2px;
    }

    .team-perm-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .team-perm-label {
      font-size: 14px;
      font-weight: 700;
      color: var(--brand-black);
      line-height: 1.3;
    }

    .team-perm-desc {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.35;
    }

    .team-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0,0,0,.08);
    }

    .team-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .team-member-card {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) 1.4fr auto;
      gap: 16px;
      align-items: center;
      background: #faf9f7;
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 10px;
      padding: 14px 16px;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    .team-member-card:hover {
      border-color: rgba(0,0,0,.14);
      box-shadow: 0 2px 8px rgba(0,0,0,.04);
    }

    .member-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .member-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--brand-black);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      font-family: var(--f-display);
      flex-shrink: 0;
    }

    .member-info {
      min-width: 0;
    }

    .member-info h4 {
      margin: 0 0 3px;
      font-family: var(--f-display);
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--brand-black);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-info span {
      font-size: 13px;
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .member-perms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .member-perm-badge {
      background: #fff;
      border: 1px solid rgba(0,0,0,.14);
      color: var(--brand-black);
      padding: 5px 11px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .member-perm-empty {
      font-size: 12px;
      color: var(--muted);
      font-style: italic;
    }

    .member-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .member-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 12px;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 8px;
      background: #fff;
      color: var(--brand-black);
      font-size: 12px;
      font-weight: 600;
      font-family: var(--f-ui);
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease, color .15s ease;
    }

    .member-btn svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .member-btn:hover {
      background: var(--brand-black);
      color: #fff;
      border-color: var(--brand-black);
    }

    .member-btn--delete {
      color: #dc2626;
      border-color: rgba(220,38,38,.25);
    }

    .member-btn--delete:hover {
      background: #dc2626;
      border-color: #dc2626;
      color: #fff;
    }

    .team-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 48px 24px;
      background: #faf9f7;
      border: 1px dashed rgba(0,0,0,.12);
      border-radius: 10px;
      color: var(--muted);
    }

    .team-empty svg {
      width: 36px;
      height: 36px;
      stroke: rgba(0,0,0,.2);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-bottom: 12px;
    }

    .team-empty p {
      font-size: 15px;
      font-weight: 700;
      color: var(--brand-black);
      margin: 0 0 6px;
    }

    .team-empty span {
      font-size: 13px;
      line-height: 1.45;
      max-width: 320px;
      margin-bottom: 16px;
    }

    @media (max-width: 800px) {
      .team-form-grid { grid-template-columns: 1fr; }
      .team-perms-grid { grid-template-columns: 1fr; }
      .team-member-card {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .member-actions { justify-content: flex-end; }
    }
  `]
})
export class CrmTeamComponent implements OnInit {
  team = signal<Employee[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  message = signal('');

  availableModules = [
    { id: 'dashboard', label: 'Resumen CRM', hint: 'Métricas y vista general del negocio' },
    { id: 'pipeline', label: 'Embudo de venta', hint: 'Trámites organizados por etapas' },
    { id: 'servicios', label: 'Servicios y precios', hint: 'Catálogo de trámites y tarifas' },
    { id: 'plantillas', label: 'Plantillas de mensaje', hint: 'Respuestas rápidas para clientes' },
    { id: 'pdf_designer', label: 'Cotizador PDF', hint: 'Diseño de cotizaciones en PDF' }
  ];

  form: Employee = { name: '', email: '', password: '', permissions: [] };

  constructor(private crm: CrmService) {}

  ngOnInit() {
    this.loadTeam();
  }

  loadTeam() {
    this.crm.request('GET', '/team').subscribe({
      next: (data) => this.team.set(data),
      error: () => this.message.set('Error al cargar equipo')
    });
  }

  openForm() {
    this.editingId.set(null);
    this.form = { name: '', email: '', password: '', permissions: ['dashboard', 'pipeline'] };
    this.showForm.set(true);
    this.message.set('');
  }

  closeForm() {
    this.showForm.set(false);
  }

  hasPerm(id: string) {
    return this.form.permissions.includes(id);
  }

  togglePerm(id: string, checked: boolean) {
    if (checked) {
      if (!this.form.permissions.includes(id)) this.form.permissions.push(id);
    } else {
      this.form.permissions = this.form.permissions.filter(p => p !== id);
    }
  }

  getModLabel(id: string) {
    return this.availableModules.find(m => m.id === id)?.label || id;
  }

  initials(name: string) {
    return name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';
  }

  save() {
    if (!this.form.name || (!this.editingId() && (!this.form.email || !this.form.password))) {
      this.message.set('Faltan campos obligatorios');
      return;
    }

    if (this.editingId()) {
      this.crm.request('PUT', `/team/${this.editingId()}`, this.form).subscribe({
        next: () => { this.loadTeam(); this.closeForm(); },
        error: (e) => this.message.set(e.error?.error || 'Error al guardar')
      });
    } else {
      this.crm.request('POST', '/team', this.form).subscribe({
        next: () => { this.loadTeam(); this.closeForm(); },
        error: (e) => this.message.set(e.error?.error || 'Error al guardar')
      });
    }
  }

  editEmp(emp: Employee) {
    this.editingId.set(emp.id!);
    this.form = { ...emp, password: '' };
    this.showForm.set(true);
    this.message.set('');
  }

  deleteEmp(emp: Employee) {
    if (confirm(`¿Eliminar a ${emp.name}?`)) {
      this.crm.request('DELETE', `/team/${emp.id}`).subscribe({
        next: () => this.loadTeam(),
        error: (e) => this.message.set(e.error?.error || 'Error al eliminar')
      });
    }
  }
}
