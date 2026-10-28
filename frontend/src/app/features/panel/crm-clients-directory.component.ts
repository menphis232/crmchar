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
    .clients-card { padding: 24px 28px; box-sizing: border-box; }

    .clients-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }
    .clients-title { display: flex; align-items: baseline; gap: 10px; margin: 0 0 6px; }
    .clients-total {
      font-family: var(--f-ui);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0;
      color: rgba(255, 255, 255, 0.5);
      font-variant-numeric: tabular-nums;
    }
    .clients-desc {
      margin: 0;
      max-width: 62ch;
      font-family: var(--f-ui);
      font-size: 13px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.55);
    }

    .clients-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 16px;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      background: transparent;
      color: #fff;
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .clients-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.55); }
    .clients-btn:focus-visible, .icon-btn:focus-visible, .client-name:focus-visible, .clients-link:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .clients-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .clients-btn--primary { background: #fff; color: #000; border-color: #fff; }
    .clients-btn--primary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.86); border-color: rgba(255, 255, 255, 0.86); }

    .clients-link {
      background: none;
      border: none;
      padding: 0 4px;
      color: rgba(255, 255, 255, 0.7);
      font-family: var(--f-ui);
      font-size: 13px;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      white-space: nowrap;
    }
    .clients-link:hover { color: #fff; }

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
      min-height: 42px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: #000;
      box-sizing: border-box;
    }
    .clients-search:focus-within { border-color: rgba(255, 255, 255, 0.5); }
    .clients-search svg { color: rgba(255, 255, 255, 0.5); flex-shrink: 0; }
    .clients-search input {
      flex: 1;
      min-width: 0;
      background: transparent !important;
      border: none !important;
      outline: none;
      padding: 10px 0;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      font-family: var(--f-ui);
      font-size: 14px;
    }
    .clients-search input::placeholder { color: rgba(255, 255, 255, 0.45) !important; -webkit-text-fill-color: rgba(255, 255, 255, 0.45) !important; }
    .clients-toolbar select {
      width: 100%;
      min-height: 42px;
      padding: 0 12px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 8px;
      background: #000 !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      font-family: var(--f-ui);
      font-size: 13px;
      outline: none;
      color-scheme: dark;
    }
    .clients-toolbar select:focus { border-color: rgba(255, 255, 255, 0.5) !important; }
    @media (max-width: 1100px) {
      .clients-toolbar { grid-template-columns: 1fr 1fr 1fr; }
      .clients-search { grid-column: 1 / -1; }
    }
    @media (max-width: 640px) {
      .clients-head { flex-direction: column; }
      .clients-toolbar { grid-template-columns: 1fr; }
    }

    /* Lista */
    .clients-list { display: flex; flex-direction: column; }
    .client-row {
      display: grid;
      grid-template-columns: minmax(150px, 1.3fr) minmax(150px, 1.2fr) minmax(150px, 1.3fr) minmax(140px, 1.2fr) 84px;
      gap: 16px;
      align-items: center;
      padding: 14px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .client-row:hover { background: rgba(255, 255, 255, 0.04); }
    .client-row--head {
      padding-top: 0;
      padding-bottom: 10px;
      cursor: default;
      font-family: var(--f-ui);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.5);
    }
    .client-row--head:hover { background: none; }

    .client-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .client-name {
      align-self: flex-start;
      max-width: 100%;
      padding: 0;
      background: none;
      border: none;
      color: #fff;
      font-family: var(--f-ui);
      font-size: 14px;
      font-weight: 700;
      text-align: left;
      line-height: 1.3;
      cursor: pointer;
      overflow-wrap: anywhere;
    }
    .client-name:hover { text-decoration: underline; text-underline-offset: 3px; }
    .client-sub {
      font-family: var(--f-ui);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
      line-height: 1.35;
    }
    .client-phone {
      font-family: var(--f-ui);
      font-size: 13px;
      color: rgba(255, 255, 255, 0.88);
      font-variant-numeric: tabular-nums;
    }
    .client-email, .client-tramite {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .client-tramite {
      font-family: var(--f-ui);
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
    }

    .client-vehicles { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px; }
    .plate-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      font-family: var(--f-ui);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #fff;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .engomado-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.25);
    }
    .engomado-dot[data-color='amarillo'] { background: #f5c518; }
    .engomado-dot[data-color='rosa'] { background: #f472b6; }
    .engomado-dot[data-color='rojo'] { background: #ef4444; }
    .engomado-dot[data-color='verde'] { background: #22c55e; }
    .engomado-dot[data-color='azul'] { background: #3b82f6; }

    .client-actions { flex-direction: row; justify-content: flex-end; gap: 6px; }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: transparent;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .icon-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.5); color: #fff; }
    .icon-btn--danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.6); color: #f87171; }
    .icon-btn:disabled { opacity: 0.4; cursor: wait; }

    /* Carga */
    .client-row--skeleton { cursor: default; }
    .client-row--skeleton:hover { background: none; }
    .sk {
      display: block;
      height: 12px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.07);
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
    .clients-empty-title { margin: 0; font-family: var(--f-ui); font-size: 15px; font-weight: 700; color: #fff; }
    .clients-empty-text { margin: 0 0 10px; font-family: var(--f-ui); font-size: 13px; color: rgba(255, 255, 255, 0.55); }

    .clients-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 16px;
    }
    .clients-page-info { font-family: var(--f-ui); font-size: 13px; color: rgba(255, 255, 255, 0.6); font-variant-numeric: tabular-nums; }

    /* Formulario alta / edición */
    .client-form {
      margin-bottom: 22px;
      padding: 18px 20px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
    }
    .client-form-head { margin-bottom: 14px; }
    .client-form-title {
      margin: 0 0 4px;
      font-family: var(--f-ui);
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      text-transform: none;
      letter-spacing: 0;
    }
    .client-form-desc { margin: 0; font-family: var(--f-ui); font-size: 13px; color: rgba(255, 255, 255, 0.55); }
    .client-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .client-field--full { grid-column: 1 / -1; }
    .client-field label {
      display: block;
      margin-bottom: 5px;
      font-family: var(--f-ui);
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
    }
    .client-field input, .client-field select, .client-field textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 8px;
      background: #000 !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      font-family: var(--f-ui);
      font-size: 14px;
      outline: none;
      color-scheme: dark;
    }
    .client-field input:focus, .client-field select:focus, .client-field textarea:focus { border-color: rgba(255, 255, 255, 0.5) !important; }
    .client-field textarea { resize: vertical; line-height: 1.5; }
    .client-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @media (max-width: 760px) { .client-form-grid { grid-template-columns: 1fr; } }

    /* Tarjetas en pantallas angostas */
    @media (max-width: 900px) {
      .client-row--head { display: none; }
      .client-row {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: 'who actions' 'contact contact' 'vehicles vehicles' 'tramites tramites';
        gap: 8px 12px;
        padding: 14px 4px;
      }
      .client-who { grid-area: who; }
      .client-actions { grid-area: actions; align-self: start; }
      .client-contact { grid-area: contact; }
      .client-vehicles { grid-area: vehicles; }
      .client-tramites { grid-area: tramites; }
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

  constructor(private crmService: CrmService) {}

  ngOnInit() {
    this.load();
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
    if (deals > 0) {
      this.toast.warning(
        `${c.name} tiene ${deals} trámite(s). Elimínalos del embudo antes de borrar al cliente.`,
        'No se puede eliminar',
      );
      return;
    }
    const ok = await this.toast.confirmDelete(c.name, {
      title: '¿Eliminar cliente?',
      subtitle: 'También se borran sus vehículos y documentos. No se puede deshacer.',
    });
    if (!ok) return;

    this.deletingId.set(c.id);
    this.crmService.deleteContact(c.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.editingId() === c.id) this.closeForm();
        const lastOnPage = this.clients().length === 1 && this.currentPage() > 1;
        this.load(lastOnPage ? this.currentPage() - 1 : this.currentPage());
        this.toast.success('Cliente eliminado');
      },
      error: (err) => {
        this.deletingId.set(null);
        this.toast.error(err?.error?.error || 'No se pudo eliminar el cliente');
      },
    });
  }
}
