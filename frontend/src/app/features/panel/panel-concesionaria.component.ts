import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { AutosService, ConcesionariaService, CrmService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { Auto, AutoStatus, ConcesionariaDashboard, CrmDashboard, CrmDeal, CrmTodayInbox, DealerReview, MessageTemplate, SiteSettings, PageBuilderConfig } from '../../models';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { PageBuilderComponent } from './page-builder.component';

import { NotificationBellComponent } from '../../shared/notification-bell.component';

type Tab = 'dashboard' | 'pipeline' | 'inventory' | 'edit' | 'reputation' | 'plantillas' | 'perfil' | 'pdf_designer' | 'page_builder';

@Component({
  selector: 'app-panel-concesionaria',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent, CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, PageBuilderComponent, NotificationBellComponent],
  templateUrl: './panel-concesionaria.component.html',
  styleUrl: './panel-dashboard.css',
})
export class PanelConcesionariaComponent implements OnInit {

  isMobileMenuOpen = signal(false);
  tab = signal<Tab>('dashboard');
  dashboard = signal<ConcesionariaDashboard | null>(null);
  crmDashboard = signal<CrmDashboard | null>(null);
  todayInbox = signal<CrmTodayInbox | null>(null);
  deals = signal<CrmDeal[]>([]);
  templates = signal<MessageTemplate[]>([]);
  selectedDealId = signal<string | null>(null);
  selectedContactId = signal<string | null>(null);
  searchQuery = '';
  filterStage = '';
  inventory = signal<Auto[]>([]);
  filterStatus = signal<AutoStatus | ''>('');
  reviews = signal<DealerReview[]>([]);
  reputation = signal({ rating: 0, reviewCount: 0 });
  editing = signal<Auto | null>(null);
  panelTheme = signal<SiteSettings>({});
  message = signal('');
  newTemplate = { name: '', content: '' };

  form: Partial<Auto> & { status?: AutoStatus } = this.emptyForm();

  constructor(
    public auth: AuthService,
    private autosService: AutosService,
    private concesionariaService: ConcesionariaService,
    private crmService: CrmService,
    private siteService: SiteService,
    private themeService: ThemeService,
    private uploadService: UploadService,
  ) {}

  ngOnInit() {
    this.siteService.get('panel-concesionaria').subscribe(t => {
      this.panelTheme.set(t);
      this.themeService.applyPanel(t);
    });
    this.loadDashboard();
    this.loadCrm();
    this.loadInventory();

    // Load profile fields from /auth/me
    this.auth.getMe().subscribe(res => {
      const u = res.user;
      this.profileName = u.name || '';
      this.profileLogoUrl = u.logo_url || '';
      this.profileDescription = (u as any).description || '';
      this.profilePhone = (u as any).phone || '';
      this.profileAddress = (u as any).address || '';
      this.profileMapEmbedUrl = (u as any).map_embed_url || '';
      this.publicSlug = (u as any).slug || '';
    });
  }

  emptyForm() {
    return {
      make: '', model: '', year: new Date().getFullYear(), price: 0, mileage: 0,
      transmission: 'Automático', location: '', description: '', imageUrl: '', status: 'draft' as AutoStatus,
    };
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'dashboard') { this.loadDashboard(); this.loadCrm(); }
    if (t === 'pipeline') this.loadCrm();
    if (t === 'inventory' || t === 'edit') this.loadInventory();
    if (t === 'reputation') this.loadReviews();
    if (t === 'plantillas') this.loadTemplates();
  }

  loadDashboard() {
    this.concesionariaService.getDashboard().subscribe(d => this.dashboard.set(d));
  }

  loadCrm() {
    this.crmService.getDashboard().subscribe(d => this.crmDashboard.set(d));
    this.crmService.getToday().subscribe(t => this.todayInbox.set(t));
    this.loadDeals();
    this.crmService.getTemplates().subscribe(t => this.templates.set(t));
  }

  loadDeals() {
    this.crmService.getDeals({
      q: this.searchQuery || undefined,
      stage: this.filterStage || undefined,
    }).subscribe(d => this.deals.set(d));
  }

  loadTemplates() {
    this.crmService.getTemplates().subscribe(t => this.templates.set(t));
  }

  loadInventory() {
    const s = this.filterStatus() || undefined;
    this.autosService.getMyInventory(s).subscribe(data => this.inventory.set(data));
  }

  loadReviews() {
    this.concesionariaService.getReviews().subscribe(data => {
      this.reviews.set(data.reviews);
      this.reputation.set({ rating: data.rating, reviewCount: data.reviewCount });
    });
  }

  onStageChange({ deal, stage }: { deal: CrmDeal; stage: string }) {
    if (stage === 'perdido') {
      this.selectedDealId.set(deal.id);
      this.message.set('Indica el motivo de pérdida en el panel lateral');
      return;
    }
    this.deals.update(list => list.map(d => (d.id === deal.id ? { ...d, stage } : d)));
    this.crmService.updateDeal(deal.id, { stage }).subscribe({
      next: () => this.loadCrm(),
      error: () => {
        this.message.set('No se pudo mover la tarjeta');
        this.loadCrm();
      },
    });
  }

  openDeal(id: string) {
    this.selectedDealId.set(id);
    this.selectedContactId.set(null);
    if (this.tab() !== 'pipeline') this.tab.set('pipeline');
  }

  onDealUpdated() {
    this.loadCrm();
    this.loadDashboard();
  }

  startNew() {
    this.form = this.emptyForm();
    this.editing.set(null);
    this.tab.set('edit');
  }

  startEdit(car: Auto) {
    this.editing.set(car);
    this.form = { ...car, status: car.status || 'draft' };
    this.tab.set('edit');
  }

  saveCar(asDraft = false) {
    const status: AutoStatus = asDraft ? 'draft' : (this.form.status === 'baja' ? 'baja' : 'published');
    const payload = { ...this.form, status };

    const obs = this.editing()
      ? this.autosService.update(this.editing()!.id, payload)
      : this.autosService.create(payload);

    obs.subscribe({
      next: () => {
        this.message.set(asDraft ? 'Borrador guardado' : 'Vehículo guardado');
        this.form = this.emptyForm();
        this.editing.set(null);
        this.loadInventory();
        this.loadDashboard();
        this.tab.set('inventory');
      },
      error: (e) => this.message.set(e.error?.error || 'Error al guardar'),
    });
  }

  changeStatus(car: Auto, status: AutoStatus) {
    this.autosService.setStatus(car.id, status).subscribe(() => {
      this.loadInventory();
      this.loadDashboard();
      this.message.set(`Estado cambiado a ${statusLabel(status)}`);
    });
  }

  deleteCar(id: string) {
    if (!confirm('¿Eliminar permanentemente este vehículo?')) return;
    this.autosService.delete(id).subscribe(() => { this.loadInventory(); this.loadDashboard(); });
  }

  saveTemplate() {
    if (!this.newTemplate.name || !this.newTemplate.content) return;
    this.crmService.createTemplate(this.newTemplate.name, this.newTemplate.content).subscribe({
      next: () => {
        this.newTemplate = { name: '', content: '' };
        this.loadTemplates();
        this.message.set('Plantilla creada');
      },
    });
  }

  deleteTemplate(id: string) {
    this.crmService.deleteTemplate(id).subscribe(() => this.loadTemplates());
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  initials(name?: string) {
    return (name || 'AP').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // Phase 3.1 Profile/Logo + New Public Fields
  profileName = '';
  profileLogoUrl = '';
  profileDescription = '';
  profilePhone = '';
  profileAddress = '';
  profileMapEmbedUrl = '';
  publicSlug = '';
  isUploadingLogo = false;

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.isUploadingLogo = true;
    this.uploadService.uploadFile(file).subscribe({
      next: (res: any) => {
        this.profileLogoUrl = res.url;
        this.isUploadingLogo = false;
        this.message.set('Logo subido correctamente, no olvides guardar cambios.');
      },
      error: () => {
        this.isUploadingLogo = false;
        this.message.set('Error al subir la imagen');
      }
    });
  }

  savePageBuilder(config: PageBuilderConfig) {
    this.auth.updateMe({ page_builder_config: config }).subscribe({
      next: () => this.message.set('Diseño de página guardado.'),
      error: () => this.message.set('Error al guardar diseño.'),
    });
    setTimeout(() => this.message.set(''), 3000);
  }

  saveProfile() {
    this.auth.updateMe({
      name: this.profileName,
      logo_url: this.profileLogoUrl,
      description: this.profileDescription || null,
      phone: this.profilePhone || null,
      address: this.profileAddress || null,
      map_embed_url: this.profileMapEmbedUrl || null,
    }).subscribe({
      next: () => this.message.set('Perfil actualizado correctamente.'),
      error: () => this.message.set('Error al actualizar el perfil')
    });
  }

  statusLabel = statusLabel;
}

function statusLabel(s: AutoStatus | string) {
  return ({ draft: 'Borrador', published: 'Publicado', baja: 'De baja' } as Record<string, string>)[s] || s;
}
