import { Component, output, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideChevronLeft, LucideChevronRight, LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { CrmService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { CrmContact } from '../../models';
import { ENGOMADO_COLORS, engomadoLabel } from '../../shared/engomado-colors';
import { MEXICO_STATES } from '../../shared/mexico-states';

type ClientForm = { name: string; email: string; phone: string; residenceState: string; notes: string };

function emptyForm(): ClientForm {
  return { name: '', email: '', phone: '', residenceState: '', notes: '' };
}

@Component({
  selector: 'app-crm-clients-directory',
  standalone: true,
  imports: [FormsModule, LucideSearch, LucidePlus, LucidePencil, LucideTrash2, LucideChevronLeft, LucideChevronRight],
  templateUrl: './crm-clients-directory.component.html',
  styles: [`
    :host { display: block; }
    .clients-board, .mon-board {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      padding: 20px 22px 24px !important;
      box-sizing: border-box;
      container-type: inline-size;
      color: #323338 !important;
      font-family: Figtree, system-ui, sans-serif;
      box-shadow: none !important;
    }

    .mon-board-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .mon-board-title {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin: 0 0 6px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #323338 !important;
      text-transform: none !important;
    }
    .clients-total {
      font-size: 13px;
      font-weight: 600;
      color: #676879;
      font-variant-numeric: tabular-nums;
    }
    .clients-desc {
      margin: 0;
      max-width: 62ch;
      font-size: 13px;
      line-height: 1.5;
      color: #676879;
    }

    .mon-btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 16px;
      flex-shrink: 0;
      border: none;
      border-radius: 8px;
      background: #0073ea !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .mon-btn-primary:hover:not(:disabled) { background: #0060c2 !important; }
    .clients-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 16px;
      flex-shrink: 0;
      border: 1px solid #c5c7d0;
      border-radius: 8px;
      background: #fff;
      color: #323338;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .clients-btn:hover:not(:disabled) { background: #f5f6f8; border-color: #0073ea; color: #0073ea; }
    .clients-btn:focus-visible, .icon-btn:focus-visible, .mon-deal-name:focus-visible, .clients-link:focus-visible, .mon-btn-primary:focus-visible {
      outline: 2px solid #0073ea;
      outline-offset: 2px;
    }
    .clients-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .clients-btn--primary { background: #0073ea !important; color: #fff !important; -webkit-text-fill-color: #fff !important; border-color: #0073ea !important; }
    .clients-btn--primary:hover:not(:disabled) { background: #0060c2 !important; border-color: #0060c2 !important; color: #fff !important; }

    .clients-link {
      background: none;
      border: none;
      padding: 0 4px;
      color: #676879;
      font-family: var(--f-ui);
      font-size: 13px;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      white-space: nowrap;
    }
    .clients-link:hover { color: #323338; }

    /* Toolbar: búsqueda + filtros en una sola línea */
    .clients-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(140px, 1fr)) auto;
      gap: 10px;
      align-items: center;
      margin-bottom: 18px;
    }
    .clients-search {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      background: #f5f6f8;
      box-sizing: border-box;
    }
    .clients-search:focus-within { border-color: #0073ea; background: #fff; }
    .clients-search svg { color: #676879; flex-shrink: 0; }
    .clients-board .clients-search input#clients-search-input,
    .clients-board .clients-search input#clients-search-input:focus {
      flex: 1;
      min-width: 0;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      outline: none;
      padding: 10px 0;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
    }
    .clients-search input::placeholder { color: #9ca0ad !important; -webkit-text-fill-color: #9ca0ad !important; }
    .clients-toolbar select {
      width: 100%;
      min-height: 42px;
      padding: 0 12px;
      box-sizing: border-box;
      border: 1px solid #e6e9ef !important;
      border-radius: 8px;
      background: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 13px;
      outline: none;
      color-scheme: light !important;
    }
    .clients-toolbar select:focus { border-color: #0073ea !important; }
    @container (max-width: 860px) {
      .clients-toolbar { grid-template-columns: 1fr 1fr 1fr; }
      .clients-search { grid-column: 1 / -1; }
    }
    @container (max-width: 520px) {
      .clients-head { flex-direction: column; }
      .clients-toolbar { grid-template-columns: 1fr; }
    }

    .mon-table-wrap { overflow-x: auto; }
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
    .mon-group-bar { width: 4px; height: 16px; border-radius: 4px; flex-shrink: 0; }
    .mon-chevron { color: #676879; width: 12px; }
    .mon-count {
      background: #f0f1f5;
      color: #676879;
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .mon-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      min-width: 780px;
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
      color: #323338;
    }
    .mon-table tbody tr { cursor: pointer; }
    .mon-table tbody tr:hover td { background: #f8fbff; }
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
    .mon-muted { color: #676879; font-size: 13px; }
    .client-state { margin-top: 2px; font-size: 12px; }
    .client-email {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .deal-extra { display: block; margin-top: 4px; font-size: 12px; }
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

    .client-vehicles { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .plate-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid #e6e9ef;
      border-radius: 6px;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #323338;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      background: #fff;
    }
    .engomado-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: #c5c7d0;
    }
    .engomado-dot[data-color='amarillo'] { background: #f5c518; }
    .engomado-dot[data-color='rosa'] { background: #f472b6; }
    .engomado-dot[data-color='rojo'] { background: #ef4444; }
    .engomado-dot[data-color='verde'] { background: #22c55e; }
    .engomado-dot[data-color='azul'] { background: #3b82f6; }

    .col-actions { width: 88px; white-space: nowrap; text-align: right; }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      background: #fff;
      color: #676879;
      cursor: pointer;
      margin-left: 4px;
    }
    .icon-btn:hover:not(:disabled) { background: #f5f6f8; border-color: #0073ea; color: #0073ea; }
    .icon-btn--danger:hover:not(:disabled) { background: #fff0f1; border-color: #e2445c; color: #e2445c; }
    .icon-btn:disabled { opacity: 0.4; cursor: wait; }

    .client-row--skeleton { cursor: default !important; }
    .client-row--skeleton:hover td { background: transparent !important; }
    .sk {
      display: block;
      height: 12px;
      border-radius: 6px;
      background: #eef0f4;
      animation: sk-pulse 1.2s ease-in-out infinite;
    }
    .sk-name { height: 14px; width: 70%; }
    .sk-line { width: 80%; }
    .sk-short { width: 45%; }
    @keyframes sk-pulse { 50% { opacity: 0.45; } }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }

    .clients-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 28px 4px 8px;
    }
    .clients-empty-title { margin: 0; font-family: var(--f-ui); font-size: 15px; font-weight: 700; color: #323338; }
    .clients-empty-text { margin: 0 0 10px; font-family: var(--f-ui); font-size: 13px; color: #676879; }

    .clients-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 16px;
    }
    .clients-page-info { font-family: var(--f-ui); font-size: 13px; color: #676879; font-variant-numeric: tabular-nums; }

    /* Formulario alta / edición */
    .client-form {
      margin-bottom: 22px;
      padding: 18px 20px;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
    }
    .client-form-head { margin-bottom: 14px; }
    .client-form-title {
      margin: 0 0 4px;
      font-family: var(--f-ui);
      font-size: 15px;
      font-weight: 700;
      color: #323338;
      text-transform: none;
      letter-spacing: 0;
    }
    .client-form-desc { margin: 0; font-family: var(--f-ui); font-size: 13px; color: #676879; }
    .client-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .client-field--full { grid-column: 1 / -1; }
    .client-field label {
      display: block;
      margin-bottom: 5px;
      font-family: var(--f-ui);
      font-size: 12px;
      font-weight: 600;
      color: #676879;
    }
    .client-field input, .client-field select, .client-field textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid #c5c7d0 !important;
      border-radius: 8px;
      background: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 14px;
      outline: none;
      color-scheme: light !important;
    }
    .client-field input:focus, .client-field select:focus, .client-field textarea:focus { border-color: #0073ea !important; }
    .client-field textarea { resize: vertical; line-height: 1.5; }
    .client-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @container (max-width: 620px) { .client-form-grid { grid-template-columns: 1fr; } }

    .status-pill {
      display: inline-flex;
      align-items: center;
      max-width: 180px;
      padding: 4px 10px;
      border-radius: 4px;
      background: #579bfc;
      color: #fff;
      -webkit-text-fill-color: #fff;
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-pill--muted { background: #c5c7d0; color: #323338; -webkit-text-fill-color: #323338; }

    @media (max-width: 760px) {
      .mon-board-title { font-size: 20px; }
      .clients-board, .mon-board { padding: 16px 14px !important; }
    }
  `],
})
export class CrmClientsDirectoryComponent implements OnInit {
  private toast = inject(ToastService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  openContact = output<string>();

  clients = signal<CrmContact[]>([]);
  search = signal('');
  filterTramite = signal('');
  filterEngomado = signal('');
  filterEstado = signal('');
  tramiteOptions = signal<string[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);
  readonly pageSize = 20;
  isLoading = signal(true);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);
  isSaving = signal(false);
  readonly engomadoLabel = engomadoLabel;
  readonly engomadoColors = ENGOMADO_COLORS;
  readonly mexicoStates = MEXICO_STATES;

  form: ClientForm = emptyForm();
  collapsedGroups = signal<Record<string, boolean>>({});

  constructor(private crmService: CrmService) {}

  ngOnInit() {
    this.load();
  }

  contactGroups(): { id: string; label: string; color: string; items: CrmContact[] }[] {
    const all = this.clients();
    const active = all.filter((c) => (c.dealCount || 0) > 0 || !!c.tramites);
    const idle = all.filter((c) => !((c.dealCount || 0) > 0 || !!c.tramites));
    const groups = [];
    if (active.length) groups.push({ id: 'activos', label: 'Contactos activos', color: '#00c875', items: active });
    if (idle.length) groups.push({ id: 'inactivos', label: 'Contactos sin acuerdos', color: '#e2445c', items: idle });
    if (!groups.length) groups.push({ id: 'todos', label: 'Contactos', color: '#0073ea', items: all });
    return groups;
  }

  toggleGroup(id: string) {
    this.collapsedGroups.update((m) => ({ ...m, [id]: !m[id] }));
  }

  load(page = this.currentPage()) {
    this.isLoading.set(true);
    this.crmService.getContacts({
      page,
      limit: this.pageSize,
      q: this.search().trim() || undefined,
      tramite: this.filterTramite() || undefined,
      engomado: this.filterEngomado() || undefined,
      estado: this.filterEstado() || undefined,
    }).subscribe({
      next: (res) => {
        this.clients.set(res.contacts);
        this.currentPage.set(res.page);
        this.totalPages.set(res.totalPages);
        this.totalItems.set(res.total);
        if (res.tramiteOptions?.length) {
          this.tramiteOptions.set(res.tramiteOptions);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onSearchChange(value: string) {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 350);
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    this.currentPage.set(1);
    this.load(1);
  }

  clearFilters() {
    this.search.set('');
    this.filterTramite.set('');
    this.filterEngomado.set('');
    this.filterEstado.set('');
    this.applyFilters();
  }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.load(page);
  }

  hasActiveFilters(): boolean {
    return !!(this.search().trim() || this.filterTramite() || this.filterEngomado() || this.filterEstado());
  }

  firstTramite(c: CrmContact): string {
    return (c.tramites || '').split(', ')[0] || '';
  }

  openAddForm() {
    this.editingId.set(null);
    this.form = emptyForm();
    this.showForm.set(true);
  }

  openEditForm(c: CrmContact) {
    this.editingId.set(c.id);
    this.form = {
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      residenceState: c.residenceState || '',
      notes: c.notes || '',
    };
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.form = emptyForm();
  }

  saveClient() {
    const name = this.form.name.trim();
    if (!name) {
      this.toast.warning('Escribe el nombre del cliente.');
      return;
    }
    const data = {
      name,
      email: this.form.email.trim(),
      phone: this.form.phone.trim(),
      residenceState: this.form.residenceState.trim(),
      notes: this.form.notes.trim(),
    };

    this.isSaving.set(true);
    const id = this.editingId();
    if (id) {
      this.crmService.updateContact(id, { ...data, whatsapp: data.phone }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeForm();
          this.load();
          this.toast.success('Cliente actualizado');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.error || 'No se pudo guardar el cliente');
        },
      });
      return;
    }

    this.crmService.createContact({
      name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      residenceState: data.residenceState || undefined,
      notes: data.notes || undefined,
    }).subscribe({
      next: (contact) => {
        this.isSaving.set(false);
        this.closeForm();
        this.load(1);
        this.toast.success('Cliente agregado al directorio');
        this.openContact.emit(contact.id);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toast.error(err?.error?.error || 'No se pudo guardar el cliente');
      },
    });
  }

  async deleteClient(c: CrmContact) {
    const deals = c.dealCount || 0;
    const ok = deals > 0
      ? await this.toast.confirmDelete(c.name, {
        title: '¿Eliminar cliente y sus trámites?',
        subtitle: `También se borran sus ${deals} trámite(s) con chat, documentos y cotizaciones, y sus vehículos. Los ingresos de Finanzas se conservan. No se puede deshacer.`,
        confirmText: 'Sí, eliminar todo',
      })
      : await this.toast.confirmDelete(c.name, {
        title: '¿Eliminar cliente?',
        subtitle: 'También se borran sus vehículos y documentos. No se puede deshacer.',
      });
    if (!ok) return;

    this.deletingId.set(c.id);
    this.crmService.deleteContact(c.id, deals > 0).subscribe({
      next: (res) => {
        this.deletingId.set(null);
        if (this.editingId() === c.id) this.closeForm();
        const lastOnPage = this.clients().length === 1 && this.currentPage() > 1;
        this.load(lastOnPage ? this.currentPage() - 1 : this.currentPage());
        this.toast.success(res.deletedDeals ? `Cliente y ${res.deletedDeals} trámite(s) eliminados` : 'Cliente eliminado');
      },
      error: (err) => {
        this.deletingId.set(null);
        this.toast.error(err?.error?.error || 'No se pudo eliminar el cliente');
      },
    });
  }
}
