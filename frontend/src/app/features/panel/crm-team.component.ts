import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { CrmService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CrmTeamPerformance } from '../../models';

interface Employee {
  id?: string;
  name: string;
  email: string;
  password?: string;
  permissions: string[];
}

const GESTOR_MODULES = [
  { id: 'dashboard', label: 'Resumen CRM', hint: 'Métricas y vista general del negocio' },
  { id: 'pipeline', label: 'Embudo de venta', hint: 'Trámites organizados por etapas' },
  { id: 'servicios', label: 'Servicios y precios', hint: 'Catálogo de trámites y tarifas' },
  { id: 'plantillas', label: 'Plantillas de mensaje', hint: 'Respuestas rápidas para clientes' },
  { id: 'pdf_designer', label: 'Cotizador PDF', hint: 'Diseño de cotizaciones en PDF' },
  { id: 'finanzas', label: 'Finanzas', hint: 'Ingresos, gastos y reportes' },
  { id: 'asistente', label: 'Asistente IA', hint: 'Colores, nombre y prompt del bot de ayuda' },
  { id: 'perfil', label: 'Perfil', hint: 'Datos públicos, logo y mapa' },
];

const CONCESIONARIA_MODULES = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Métricas y vista general' },
  { id: 'pipeline', label: 'Embudo de ventas', hint: 'Leads y negociaciones por etapa' },
  { id: 'inventory', label: 'Inventario', hint: 'Listado de vehículos publicados' },
  { id: 'edit', label: 'Editar/ publicar', hint: 'Alta y edición de vehículos' },
  { id: 'reputation', label: 'Reputación', hint: 'Reseñas y calificación' },
  { id: 'finanzas', label: 'Finanzas', hint: 'Ingresos, gastos y reportes' },
  { id: 'asistente', label: 'Asistente IA', hint: 'Colores, nombre y prompt del bot de ayuda' },
  { id: 'perfil', label: 'Perfil', hint: 'Datos públicos de la concesionaria' },
];

@Component({
  selector: 'app-crm-team',
  standalone: true,
  imports: [CommonModule, FormsModule, LucidePlus],
  host: { '[class.theme-dark]': 'isConcesionaria' },
  template: `
    <div class="mon-board team-panel perf-panel">
      <header class="mon-board-head">
        <div>
          <h2 class="mon-board-title">Desempeño del equipo</h2>
          <p class="mon-board-desc">{{ perfDesc }}</p>
        </div>
      </header>

      @if (performance().length) {
        <div class="mon-table-wrap">
          <table class="mon-table perf-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th>Vendedor</th>
                <th class="col-num">Cerrados</th>
                <th class="col-num">Activos</th>
                <th class="col-num">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              @for (p of performance(); track p.id; let i = $index) {
                <tr [class.perf-top]="i === 0 && p.dealsClosed > 0">
                  <td class="col-rank">{{ i + 1 }}</td>
                  <td>
                    <span class="perf-name">{{ p.name }}</span>
                    @if (p.isOwner) { <span class="perf-owner-tag">Admin</span> }
                  </td>
                  <td class="col-num perf-strong">{{ p.dealsClosed }}</td>
                  <td class="col-num">{{ p.assignedActive }}</td>
                  <td class="col-num">{{ p.revenueClosed | currency:'MXN':'symbol-narrow':'1.0-0' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="perf-empty">{{ isConcesionaria ? 'Aún no hay ventas cerradas asignadas. Asigna leads a tu equipo desde cada negociación para ver el ranking.' : 'Aún no hay trámites cerrados asignados. Asigna leads a tu equipo desde cada trámite para ver el ranking.' }}</p>
      }
    </div>

    <div class="mon-board team-panel">
      <header class="mon-board-head">
        <div>
          <h2 class="mon-board-title">{{ panelTitle }}</h2>
          <p class="mon-board-desc">Agrega colaboradores y elige qué secciones del panel pueden ver y usar.</p>
        </div>
        @if (!showForm()) {
          <button type="button" class="mon-btn-primary" (click)="openForm()">
            <svg lucidePlus [size]="16" aria-hidden="true"></svg>
            Nuevo empleado
          </button>
        }
      </header>

      @if (message()) {
        <div class="team-alert" [class.error]="message().startsWith('Error') || message().startsWith('Faltan')">{{ message() }}</div>
      }

      @if (showForm()) {
        <div class="team-form-card">
          <h3 class="team-form-title">{{ editingId() ? 'Editar empleado' : 'Crear empleado' }}</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="team-name">Nombre</label>
              <input id="team-name" [(ngModel)]="form.name" placeholder="Ej. Juan Pérez" />
            </div>
            <div class="form-group">
              <label for="team-email">Email</label>
              <input id="team-email" type="email" [(ngModel)]="form.email" [disabled]="!!editingId()" [placeholder]="emailPlaceholder" />
            </div>
            <div class="form-group">
              <label for="team-password">Contraseña {{ editingId() ? '(opcional)' : '' }}</label>
              <input id="team-password" type="password" [(ngModel)]="form.password" placeholder="••••••••" />
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
            <button type="button" class="mon-tool-btn" (click)="closeForm()">Cancelar</button>
            <button type="button" class="mon-btn-primary" (click)="save()">Guardar empleado</button>
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
          @if (!showForm()) {
            <div class="team-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <p class="team-empty-title">Aún no tienes empleados</p>
              <p class="team-empty-hint">Crea el primero para que tu equipo acceda al panel con permisos limitados.</p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .mon-board {
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      padding: 20px 22px 24px;
      margin-bottom: 16px;
      color: #323338;
      font-family: Figtree, system-ui, sans-serif;
      width: 100%;
      max-width: none;
      box-sizing: border-box;
      box-shadow: none;
    }

    .mon-board-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .mon-board-title {
      margin: 0 0 6px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #323338;
      text-transform: none;
    }

    .mon-board-desc {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #676879;
      max-width: 68ch;
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
      flex-shrink: 0;
    }
    .mon-btn-primary:hover { background: #0060c2; }

    .mon-tool-btn {
      display: inline-flex;
      align-items: center;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      background: #fff;
      color: #323338;
      font: 600 13px Figtree, system-ui, sans-serif;
      padding: 8px 12px;
      cursor: pointer;
    }
    .mon-tool-btn:hover { border-color: #0073ea; color: #0073ea; }

    .form-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .form-group {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .team-form-card .form-group label {
      font-family: Figtree, system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      color: #676879;
    }

    .team-form-card .form-group input:not([type="checkbox"]):not([type="radio"]) {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      background-color: #fff;
      border: 1px solid #c5c7d0;
      color: #323338;
      -webkit-text-fill-color: #323338;
      caret-color: #323338;
      border-radius: 8px;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
      outline: none;
    }

    .team-form-card .form-group input::placeholder {
      color: #9ca0ad;
      opacity: 1;
    }

    .team-form-card .form-group input:focus {
      border-color: #0073ea;
      box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.15);
    }

    /* ── Tema oscuro concesionaria ── */
    :host.theme-dark .mon-board {
      background: #141414;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    :host.theme-dark .mon-board-title { color: #ffffff; }
    :host.theme-dark .mon-board-desc { color: rgba(255, 255, 255, 0.45); }

    :host.theme-dark .team-form-card {
      background: #0d0d0d;
      border-color: rgba(255, 255, 255, 0.10);
      border-radius: 12px;
    }

    :host.theme-dark .team-form-title,
    :host.theme-dark .team-perms-section h4,
    :host.theme-dark .team-perm-label,
    :host.theme-dark .member-info h4,
    :host.theme-dark .team-empty-title {
      color: #ffffff;
    }

    :host.theme-dark .team-perms-hint,
    :host.theme-dark .team-perm-desc,
    :host.theme-dark .member-info span,
    :host.theme-dark .member-perm-empty,
    :host.theme-dark .team-empty-hint {
      color: rgba(255, 255, 255, 0.45);
    }

    :host.theme-dark .team-form-card .form-group label {
      color: rgba(255, 255, 255, 0.50);
    }

    :host.theme-dark .team-form-card .form-group input:not([type="checkbox"]):not([type="radio"]) {
      background-color: #111111;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #ffffff;
      -webkit-text-fill-color: #ffffff;
      caret-color: #ffffff;
      color-scheme: dark;
    }

    :host.theme-dark .team-form-card .form-group input::placeholder {
      color: rgba(255, 255, 255, 0.28);
    }

    :host.theme-dark .team-form-card .form-group input:focus {
      background-color: #111111;
      border-color: rgba(255, 255, 255, 0.45);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
    }

    :host.theme-dark .team-form-card .form-group input:-webkit-autofill,
    :host.theme-dark .team-form-card .form-group input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 1000px #111111 inset;
      box-shadow: 0 0 0 1000px #111111 inset;
      -webkit-text-fill-color: #ffffff;
    }

    :host.theme-dark .team-perm-option {
      background: #111111;
      border-color: rgba(255, 255, 255, 0.10);
    }

    :host.theme-dark .team-member-card {
      background: #181818;
      border-color: rgba(255, 255, 255, 0.10);
    }

    :host.theme-dark .member-perm-badge {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.14);
      color: rgba(255, 255, 255, 0.85);
    }

    :host.theme-dark .member-avatar {
      background: #ffffff;
      color: #000000;
    }

    :host.theme-dark .member-btn {
      background: transparent;
      border-color: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }

    :host.theme-dark .member-btn:hover {
      background: #ffffff;
      color: #000000;
      border-color: #ffffff;
    }

    :host.theme-dark .team-empty {
      background: #0d0d0d;
      border-color: rgba(255, 255, 255, 0.10);
    }

    :host.theme-dark .team-alert {
      background: rgba(68, 187, 102, 0.10);
      border-color: rgba(68, 187, 102, 0.30);
      color: rgba(134, 239, 172, 0.95);
    }

    :host.theme-dark .team-alert.error {
      background: rgba(239, 68, 68, 0.10);
      border-color: rgba(239, 68, 68, 0.35);
      color: #fca5a5;
    }

    .team-panel { margin-bottom: 0; }
    .perf-panel { margin-bottom: 16px; }

    .mon-table-wrap { overflow-x: auto; width: 100%; }
    .mon-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      min-width: 560px;
    }
    .mon-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #676879;
      padding: 8px 12px;
      border-bottom: 1px solid #e6e9ef;
      border-right: 1px solid #e6e9ef;
      background: #f7f8fa;
      white-space: nowrap;
    }
    .mon-table td {
      padding: 12px;
      border-bottom: 1px solid #e6e9ef;
      border-right: 1px solid #eef0f4;
      font-size: 14px;
      vertical-align: middle;
      color: #323338;
      background: #fff;
    }
    .mon-table tbody tr:hover td { background: #f8fbff; }
    .mon-table tr.perf-top td { background: #e5f4ff; }
    .col-rank { width: 48px; text-align: center; font-weight: 700; color: #676879; }
    .col-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .perf-name { font-weight: 600; margin-right: 8px; }
    .perf-owner-tag {
      display: inline-flex;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f0f1f5;
      color: #676879;
    }
    .perf-strong { font-weight: 700; }
    .perf-empty {
      font-size: 13px;
      color: #676879;
      line-height: 1.5;
      margin: 4px 0 0;
    }

    :host.theme-dark .mon-table th { background: #1a1a1a; color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.10); }
    :host.theme-dark .mon-table td { background: #141414; color: #fff; border-color: rgba(255,255,255,0.10); }
    :host.theme-dark .mon-table tr.perf-top td { background: rgba(0,115,234,0.18); }
    :host.theme-dark .perf-owner-tag { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.65); }
    :host.theme-dark .perf-empty { color: rgba(255,255,255,0.45); }

    .team-alert {
      padding: 10px 14px;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 8px;
      color: #166534;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .team-alert.error {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.35);
      color: #fca5a5;
    }

    .team-form-card {
      background: #f7f8fa;
      border: 1px solid #e6e9ef;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .team-form-title {
      font-family: Figtree, system-ui, sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      text-transform: none;
      color: #323338;
      margin: 0 0 16px;
    }

    .team-form-card .form-group input:disabled { opacity: 0.55; }

    .team-perms-section {
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .team-perms-section h4 {
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: #323338;
      margin: 0 0 4px;
    }

    .team-perms-hint {
      font-size: 13px;
      color: #676879;
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
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.10);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    .team-perm-option:hover { border-color: rgba(0, 0, 0, 0.25); }

    .team-perm-option input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #0073ea;
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
      font-weight: 600;
      color: #323338;
      line-height: 1.3;
    }

    .team-perm-desc {
      font-size: 12px;
      color: #676879;
      line-height: 1.35;
    }

    .team-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
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
      background: #f7f8fa;
      border: 1px solid #e6e9ef;
      border-left: 4px solid #0073ea;
      border-radius: 10px;
      padding: 14px 16px;
      transition: border-color 0.15s ease;
    }

    .team-member-card:hover { border-color: #c5c7d0; }

    .member-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .member-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #0073ea;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      font-family: Figtree, system-ui, sans-serif;
      flex-shrink: 0;
    }

    .member-info { min-width: 0; }

    .member-info h4 {
      margin: 0 0 3px;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: #323338;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-info span {
      font-size: 13px;
      color: #676879;
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
      background: #e5f4ff;
      border: 1px solid #b3dbfd;
      color: #0073ea;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0;
      white-space: nowrap;
    }

    .member-perm-empty {
      font-size: 12px;
      color: var(--muted, #979797);
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
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      background: #fff;
      color: var(--brand-black, #000);
      font-size: 12px;
      font-weight: 600;
      font-family: var(--f-ui, 'Spartan', sans-serif);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
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
      background: #f5f6f8;
      color: #0073ea;
      border-color: #0073ea;
    }

    .member-btn--delete {
      color: #f87171;
      border-color: rgba(248, 113, 113, 0.35);
    }

    .member-btn--delete:hover {
      background: #dc2626;
      border-color: #dc2626;
      color: #ffffff;
    }

    .team-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 40px 24px 32px;
      border: 1px dashed #c5c7d0;
      border-radius: 10px;
      background: #f7f8fa;
    }

    .team-empty svg {
      width: 36px;
      height: 36px;
      stroke: rgba(0, 0, 0, 0.22);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-bottom: 14px;
    }

    .team-empty-title {
      font-family: Figtree, system-ui, sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: #323338;
      margin: 0 0 8px;
    }

    .team-empty-hint {
      font-size: 13px;
      line-height: 1.5;
      color: #676879;
      max-width: 360px;
      margin: 0;
    }

    @media (max-width: 800px) {
      .form-row { grid-template-columns: 1fr; }
      .team-perms-grid { grid-template-columns: 1fr; }
      .team-member-card {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .member-actions { justify-content: flex-end; }
      .mon-board-title { font-size: 20px; }
      .mon-board { padding: 16px 14px; }
    }
  `]
})
export class CrmTeamComponent implements OnInit {
  team = signal<Employee[]>([]);
  performance = signal<CrmTeamPerformance[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  message = signal('');

  availableModules = GESTOR_MODULES;
  emailPlaceholder = 'juan@gestoria.com';
  defaultPerms = ['dashboard', 'pipeline'];

  get panelTitle(): string {
    return this.auth.user()?.role === 'concesionaria' ? 'Roles y permisos' : 'Mi Equipo';
  }

  get isConcesionaria(): boolean {
    return this.auth.user()?.role === 'concesionaria';
  }

  get perfDesc(): string {
    return this.isConcesionaria
      ? 'Ranking de ventas cerradas por vendedor. Queda registro permanente de quién cierra más.'
      : 'Ranking de trámites cerrados por vendedor. Queda registro permanente de quién cierra más.';
  }

  form: Employee = { name: '', email: '', password: '', permissions: [] };

  constructor(private crm: CrmService, private auth: AuthService) {}

  ngOnInit() {
    const role = this.auth.user()?.role;
    if (role === 'concesionaria') {
      this.availableModules = CONCESIONARIA_MODULES;
      this.emailPlaceholder = 'juan@concesionaria.com';
    }
    this.loadTeam();
    this.loadPerformance();
  }

  loadTeam() {
    this.crm.request('GET', '/team').subscribe({
      next: (data) => this.team.set(data),
      error: () => this.message.set('Error al cargar equipo')
    });
  }

  loadPerformance() {
    this.crm.getTeamPerformance().subscribe({
      next: (data) => this.performance.set(data),
      error: () => {},
    });
  }

  openForm() {
    this.editingId.set(null);
    this.form = { name: '', email: '', password: '', permissions: [...this.defaultPerms] };
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
        next: () => { this.loadTeam(); this.loadPerformance(); this.closeForm(); },
        error: (e) => this.message.set(e.error?.error || 'Error al guardar')
      });
    } else {
      this.crm.request('POST', '/team', this.form).subscribe({
        next: () => { this.loadTeam(); this.loadPerformance(); this.closeForm(); },
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
        next: () => { this.loadTeam(); this.loadPerformance(); },
        error: (e) => this.message.set(e.error?.error || 'Error al eliminar')
      });
    }
  }
}
