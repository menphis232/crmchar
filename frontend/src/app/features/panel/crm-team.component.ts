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
    <div class="team-container">
      <div class="header">
        <h2>👥 Mi Equipo</h2>
        <button class="btn-copy" (click)="openForm()">+ Nuevo Empleado</button>
      </div>

      @if (message()) {
        <div class="alert">{{ message() }}</div>
      }

      @if (showForm()) {
        <div class="form-card">
          <h3>{{ editingId() ? 'Editar Empleado' : 'Crear Empleado' }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Nombre</label>
              <input [(ngModel)]="form.name" placeholder="Ej. Juan Pérez" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input [(ngModel)]="form.email" [disabled]="!!editingId()" placeholder="juan@gestoria.com" />
            </div>
            <div class="form-group">
              <label>Contraseña {{ editingId() ? '(dejar en blanco para no cambiar)' : '' }}</label>
              <input type="password" [(ngModel)]="form.password" placeholder="***" />
            </div>
          </div>
          
          <div class="permissions-section">
            <h4>Permisos (Módulos)</h4>
            <div class="checkbox-grid">
              @for (mod of availableModules; track mod.id) {
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [checked]="hasPerm(mod.id)"
                         (change)="togglePerm(mod.id, $any($event.target).checked)" />
                  {{ mod.name }}
                </label>
              }
            </div>
          </div>

          <div class="actions">
            <button class="btn-ghost" (click)="closeForm()">Cancelar</button>
            <button class="btn-copy" (click)="save()">Guardar</button>
          </div>
        </div>
      }

      <div class="team-list">
        @for (emp of team(); track emp.id) {
          <div class="team-card">
            <div class="team-info">
              <div class="avatar">{{ initials(emp.name) }}</div>
              <div>
                <h4>{{ emp.name }}</h4>
                <small>{{ emp.email }}</small>
              </div>
            </div>
            <div class="team-perms">
              @for (p of emp.permissions; track p) {
                <span class="badge">{{ getModName(p) }}</span>
              }
            </div>
            <div class="team-actions">
              <button class="btn-ghost" (click)="editEmp(emp)">Editar</button>
              <button class="btn-danger" (click)="deleteEmp(emp)">Eliminar</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .team-container { padding: 20px; color: var(--mx-white); max-width: 900px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .header h2 { margin: 0; font-family: var(--f-display); }
    .alert { padding: 10px; background: rgba(200, 169, 74, 0.1); border-left: 3px solid var(--gold); margin-bottom: 15px; }
    
    .form-card { background: var(--surface); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .form-group label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }
    .form-group input { width: 100%; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); color: white; border-radius: 4px; }
    
    .permissions-section { margin-bottom: 20px; padding-top: 15px; border-top: 1px solid var(--border); }
    .checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    
    .actions { display: flex; justify-content: flex-end; gap: 10px; }
    
    .team-list { display: flex; flex-direction: column; gap: 10px; }
    .team-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border); }
    .team-info { display: flex; align-items: center; gap: 15px; width: 30%; }
    .team-info h4 { margin: 0; font-size: 14px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--gold); color: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .team-perms { flex: 1; display: flex; gap: 5px; flex-wrap: wrap; }
    .badge { background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 12px; font-size: 11px; }
    .btn-danger { background: rgba(206, 17, 38, 0.2); color: #ff4d4d; border: 1px solid rgba(206, 17, 38, 0.4); padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .btn-danger:hover { background: rgba(206, 17, 38, 0.4); }

    .btn-copy {
      background: linear-gradient(135deg, var(--gold), #b8952e);
      color: var(--bg);
      border: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 700;
      font-family: var(--f-ui);
      font-size: 12px;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-copy:hover { filter: brightness(1.1); box-shadow: 0 4px 16px rgba(200,169,74,0.35); transform: translateY(-1px); }

    .btn-ghost {
      font-family: var(--f-ui);
      font-size: 12px;
      letter-spacing: 0.05em;
      color: var(--text);
      background: transparent;
      border: 1px solid var(--border);
      padding: 10px 20px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: var(--transition);
    }
    .btn-ghost:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-glow); }
  `]
})
export class CrmTeamComponent implements OnInit {
  team = signal<Employee[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  message = signal('');

  availableModules = [
    { id: 'dashboard', name: '📊 Panel CRM (Dashboard)' },
    { id: 'pipeline', name: '📋 Pipeline (Kanban)' },
    { id: 'servicios', name: '🛠 Servicios y Precios' },
    { id: 'plantillas', name: '📝 Plantillas de Mensaje' },
    { id: 'pdf_designer', name: '📄 Cotizador PDF' }
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

  getModName(id: string) {
    return this.availableModules.find(m => m.id === id)?.name || id;
  }

  initials(name: string) {
    return name ? name.substring(0, 2).toUpperCase() : '??';
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
