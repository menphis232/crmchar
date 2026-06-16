import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { AutosService, ConcesionariaService, CrmService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { Auto, AutoStatus, ConcesionariaDashboard, CrmDashboard, CrmDeal, CrmTodayInbox, DealerReview, MessageTemplate, SiteSettings, PageBuilderConfig } from '../../models';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { PageBuilderComponent } from './page-builder.component';
import { ToastService } from '../../core/toast.service';
import { FinancesComponent } from './finances.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { ColorPickerComponent } from '../../shared/color-picker.component';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';

type Tab = 'dashboard' | 'pipeline' | 'inventory' | 'edit' | 'reputation' | 'plantillas' | 'perfil' | 'pdf_designer' | 'page_builder' | 'ajustes-crm' | 'finanzas';

const DEFAULT_AI_TIPS = [
  'Responde leads en menos de 2 horas con fotos del vehículo y opciones de financiamiento; la velocidad cierra ventas en concesionarias.',
  'Programa visitas al showroom con recordatorio automático; los clientes que visitan tienen mucha más probabilidad de comprar.',
  'Prepara una ficha comparativa (precio, kilometraje, garantía) antes de la negociación para generar confianza y acelerar el cierre.',
];

@Component({
  selector: 'app-panel-concesionaria',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent, CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, PageBuilderComponent, NotificationBellComponent, FinancesComponent, ColorPickerComponent, AiAssistantComponent],
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
  aiInsights = signal<string[]>(DEFAULT_AI_TIPS);
  isAiLoading = signal(false);

  // CRM Stages Settings
  crmStages: { id: string, label: string }[] = [];
  isSavingStages = false;

  form: Partial<Auto> & { status?: AutoStatus } = this.emptyForm();

  constructor(
    public auth: AuthService,
    private autosService: AutosService,
    private concesionariaService: ConcesionariaService,
    private crmService: CrmService,
    private siteService: SiteService,
    private themeService: ThemeService,
    private uploadService: UploadService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.siteService.get('panel-concesionaria').subscribe(t => {
      this.panelTheme.set(t);
      this.themeService.applyPanel(t);
    });
    this.loadDashboard();
    this.loadCrm();
    this.loadAiInsights();
    this.loadInventory();

    this.route.queryParams.subscribe(params => {
      if (params['deal']) {
        this.openDeal(params['deal']);
      }
    });

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
      this.panelAssistantEnabled = u.panel_assistant_enabled !== 0 && u.panel_assistant_enabled !== false;
      this.panelAssistantName = u.panel_assistant_name || 'VEGA';
      this.panelAssistantPosition = u.panel_assistant_position || 'bottom-right';
      this.panelAssistantBgColor = u.panel_assistant_bg_color || '#0f172a';
      this.panelAssistantBtnColor = u.panel_assistant_btn_color || '#4F46E5';
      this.panelAssistantTextColor = u.panel_assistant_text_color || '#FFFFFF';
      this.crmStages = u.crm_stages ? [...u.crm_stages] : [
        { id: 'lead_nuevo', label: 'Lead Nuevo' },
        { id: 'contactado', label: 'Contactado' },
        { id: 'visita', label: 'Visita Showroom' },
        { id: 'negociacion', label: 'Negociación / Crédito' },
        { id: 'vendido', label: 'Vendido' },
        { id: 'perdido', label: 'Perdido' }
      ];
    });
  }

  emptyForm() {
    return {
      make: '', model: '', year: new Date().getFullYear(), price: 0, mileage: 0,
      transmission: 'Automático', location: '', description: '', imageUrl: '', images: [], status: 'draft' as AutoStatus,
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
    this.loadAiInsights();
  }

  loadAiInsights() {
    const today = new Date().toDateString();
    const cacheKey = 'crm_ai_insights_concesionaria_v2';
    const cacheDateKey = 'crm_ai_insights_concesionaria_date_v2';
    const cachedData = localStorage.getItem(cacheKey);
    const cachedDate = localStorage.getItem(cacheDateKey);

    if (cachedDate === today && cachedData) {
      try {
        const parsed = JSON.parse(cachedData) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.aiInsights.set(parsed);
          this.isAiLoading.set(false);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(cacheDateKey);
      }
    }

    this.isAiLoading.set(true);
    this.http.get<{ insights: string[] }>(`${environment.apiUrl}/crm/ai/insights`).subscribe({
      next: (res) => {
        const insights = (res.insights || []).filter(Boolean);
        const finalInsights = insights.length > 0 ? insights : DEFAULT_AI_TIPS;
        this.aiInsights.set(finalInsights);
        localStorage.setItem(cacheKey, JSON.stringify(finalInsights));
        localStorage.setItem(cacheDateKey, today);
        this.isAiLoading.set(false);
      },
      error: () => {
        this.aiInsights.set(DEFAULT_AI_TIPS);
        this.isAiLoading.set(false);
      },
    });
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

  onStageChange({ deal, stage, fromDrag }: { deal: CrmDeal; stage: string; fromDrag?: boolean }) {
    if (stage === 'perdido') {
      this.deals.update(list => list.map(d => (d.id === deal.id ? { ...d, stage: 'perdido' } : d)));
      if (fromDrag) {
        this.message.set('Trámite movido a Perdido. Haz clic en la tarjeta para indicar el motivo de pérdida.');
      } else {
        this.selectedDealId.set(deal.id);
        this.message.set('Indica el motivo de pérdida en el panel lateral');
      }
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
    this.form = { ...car, status: car.status || 'draft', images: car.images || [] };
    this.tab.set('edit');
  }

  // --- CAR GALLERY LOGIC ---
  isUploadingCarImages = false;

  onCarImagesSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (!files.length) return;
    this.isUploadingCarImages = true;
    
    const uploads = files.map(file => {
      return new Promise<string>((resolve, reject) => {
        this.uploadService.uploadFile(file).subscribe({
          next: (res: any) => resolve(res.url),
          error: (err) => reject(err)
        });
      });
    });

    Promise.all(uploads).then(urls => {
      if (!this.form.images) this.form.images = [];
      this.form.images.push(...urls);
      if (this.form.images.length > 0) this.form.imageUrl = this.form.images[0];
      this.isUploadingCarImages = false;
      this.toast.success('Fotos subidas correctamente', '¡Éxito!');
    }).catch(() => {
      this.isUploadingCarImages = false;
      this.toast.error('Error al subir algunas fotos', 'Error');
    });
  }

  addManualImageUrl() {
    const url = prompt('Ingresa la URL de la imagen:');
    if (url && url.startsWith('http')) {
      if (!this.form.images) this.form.images = [];
      this.form.images.push(url);
      if (this.form.images.length === 1) this.form.imageUrl = url;
    }
  }

  removeCarImage(index: number) {
    if (!this.form.images) return;
    this.form.images.splice(index, 1);
    this.form.imageUrl = this.form.images.length > 0 ? this.form.images[0] : '';
  }
  // -------------------------

  saveCar(asDraft = false) {
    const status: AutoStatus = asDraft ? 'draft' : (this.form.status === 'baja' ? 'baja' : 'published');
    const payload = { ...this.form, status };

    const obs = this.editing()
      ? this.autosService.update(this.editing()!.id, payload)
      : this.autosService.create(payload);

    obs.subscribe({
      next: () => {
        this.toast.success(asDraft ? 'Borrador guardado' : 'Vehículo guardado', '¡Éxito!');
        this.form = this.emptyForm();
        this.editing.set(null);
        this.loadInventory();
        this.loadDashboard();
        this.tab.set('inventory');
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al guardar', 'Error'),
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

  panelAssistantEnabled = true;
  panelAssistantName = 'VEGA';
  panelAssistantPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  panelAssistantBgColor = '#0f172a';
  panelAssistantBtnColor = '#4F46E5';
  panelAssistantTextColor = '#FFFFFF';

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

  savePageBuilder(config: any) {
    this.auth.updateMe({ page_builder_config: config }).subscribe(() => {
      this.message.set('Diseño de página guardado exitosamente');
      setTimeout(() => this.message.set(''), 3000);
    });
  }

  // CRM Stages Settings Methods
  addCrmStage() {
    this.crmStages.push({ id: `etapa_${Date.now()}`, label: 'Nueva Etapa' });
    this.saveCrmStages();
  }

  removeCrmStage(index: number) {
    if (this.crmStages.length <= 2) {
      alert('Debes tener al menos 2 etapas.');
      return;
    }
    this.crmStages.splice(index, 1);
    this.saveCrmStages();
  }

  moveCrmStageUp(index: number) {
    if (index === 0) return;
    const temp = this.crmStages[index];
    this.crmStages[index] = this.crmStages[index - 1];
    this.crmStages[index - 1] = temp;
    this.saveCrmStages();
  }

  moveCrmStageDown(index: number) {
    if (index === this.crmStages.length - 1) return;
    const temp = this.crmStages[index];
    this.crmStages[index] = this.crmStages[index + 1];
    this.crmStages[index + 1] = temp;
    this.saveCrmStages();
  }

  saveCrmStages() {
    this.isSavingStages = true;
    this.auth.updateMe({ crm_stages: this.crmStages }).subscribe({
      next: () => {
        this.isSavingStages = false;
        this.toast.success('Las etapas del embudo de ventas han sido actualizadas.', '¡Guardado!');
        this.loadCrm();
      },
      error: () => {
        this.isSavingStages = false;
      }
    });
  }

  saveProfile() {
    this.auth.updateMe({
      name: this.profileName,
      logo_url: this.profileLogoUrl,
      description: this.profileDescription || null,
      phone: this.profilePhone || null,
      address: this.profileAddress || null,
      map_embed_url: this.profileMapEmbedUrl || null,
      panel_assistant_enabled: this.panelAssistantEnabled,
      panel_assistant_name: this.panelAssistantName,
      panel_assistant_position: this.panelAssistantPosition,
      panel_assistant_bg_color: this.panelAssistantBgColor,
      panel_assistant_btn_color: this.panelAssistantBtnColor,
      panel_assistant_text_color: this.panelAssistantTextColor,
    }).subscribe({
      next: () => this.toast.success('Tu información de perfil ha sido guardada.', 'Perfil actualizado'),
      error: () => {}
    });
  }

  statusLabel = statusLabel;
}

function statusLabel(s: AutoStatus | string) {
  return ({ draft: 'Borrador', published: 'Publicado', baja: 'De baja' } as Record<string, string>)[s] || s;
}
