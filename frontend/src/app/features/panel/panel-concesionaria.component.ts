import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { AdminService, AutosService, ConcesionariaService, CrmService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { Auto, AutoStatus, AutoPrivateDocument, ConcesionariaDashboard, CrmDashboard, CrmDeal, CrmTodayInbox, DealerReview, MessageTemplate, SiteSettings, PageBuilderConfig } from '../../models';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { PageBuilderComponent } from './page-builder.component';
import { ToastService } from '../../core/toast.service';
import { FinancesComponent } from './finances.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import { RichTextEditorComponent } from '../../shared/rich-text-editor.component';

type Tab = 'dashboard' | 'pipeline' | 'inventory' | 'edit' | 'reputation' | 'plantillas' | 'perfil' | 'pdf_designer' | 'page_builder' | 'finanzas';

const DEFAULT_AI_TIPS = [
  'Responde leads en menos de 2 horas con fotos del vehículo y opciones de financiamiento; la velocidad cierra ventas en concesionarias.',
  'Programa visitas al showroom con recordatorio automático; los clientes que visitan tienen mucha más probabilidad de comprar.',
  'Prepara una ficha comparativa (precio, kilometraje, garantía) antes de la negociación para generar confianza y acelerar el cierre.',
];

const AUTO_DOC_LABELS = [
  'Factura de origen',
  'Refacturas',
  'Pagos anteriores',
  'Baja de placas',
  'Identificación antiguo propietario',
  'Contrato de compra venta',
  'Otro',
] as const;

@Component({
  selector: 'app-panel-concesionaria',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent, CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, PageBuilderComponent, NotificationBellComponent, FinancesComponent, PanelColorPaletteComponent, AiAssistantComponent, RichTextEditorComponent],
  templateUrl: './panel-concesionaria.component.html',
  styleUrls: ['./panel-dashboard.css', './panel-concesionaria.component.css'],
})
export class PanelConcesionariaComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

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

  form: Partial<Auto> & { status?: AutoStatus } = this.emptyForm();

  readonly autoDocLabels = AUTO_DOC_LABELS;
  privateDocuments = signal<AutoPrivateDocument[]>([]);
  newDocLabel = AUTO_DOC_LABELS[0];
  newDocNotes = '';
  isUploadingPrivateDoc = false;

  // Manual lead form
  showManualLeadForm = signal(false);
  savingManualLead = signal(false);
  manualLeadCars = signal<Auto[]>([]);
  manualLead = {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    autoId: '',
    title: '',
    message: '',
    estimatedValue: '' as string | number,
    stage: 'lead_nuevo',
  };

  constructor(
    public auth: AuthService,
    private autosService: AutosService,
    private concesionariaService: ConcesionariaService,
    private crmService: CrmService,
    private adminService: AdminService,
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
      this.panelAssistantFont = u.panel_assistant_font || 'League Spartan';
      this.panelAssistantPrompt = u.panel_assistant_prompt || '';
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
      make: '', model: '', year: new Date().getFullYear(), price: 0, specialPrice: null as number | null, verified: false, mileage: 0,
      transmission: 'Automático', location: '', description: '', imageUrl: '', images: [],
      videoUrl: '', status: 'draft' as AutoStatus,
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

  onStagesChange(stages: { id: string; label: string }[]) {
    this.adminService.updateMyProfile({ crm_stages: stages }).subscribe({
      next: () => {
        this.toast.success('Etapas guardadas');
        this.loadCrm();
      },
      error: () => this.toast.error('Error al guardar etapas'),
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

  openManualLeadForm() {
    this.manualLead = {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      autoId: '',
      title: '',
      message: '',
      estimatedValue: '',
      stage: 'lead_nuevo',
    };
    this.autosService.getMyInventory('published').subscribe(cars => this.manualLeadCars.set(cars));
    this.showManualLeadForm.set(true);
  }

  closeManualLeadForm() {
    this.showManualLeadForm.set(false);
  }

  onManualLeadCarChange() {
    const car = this.manualLeadCars().find(c => c.id === this.manualLead.autoId);
    if (!car) return;
    this.manualLead.title = `${car.make} ${car.model} ${car.year}`;
    const price = car.specialPrice ?? car.price;
    if (price) this.manualLead.estimatedValue = price;
  }

  saveManualLead() {
    if (!this.manualLead.clientName.trim()) {
      this.toast.warning('El nombre del cliente es obligatorio');
      return;
    }
    this.savingManualLead.set(true);
    const estimatedValue = this.manualLead.estimatedValue !== ''
      ? Number(this.manualLead.estimatedValue)
      : undefined;
    this.crmService.createDeal({
      clientName: this.manualLead.clientName.trim(),
      clientEmail: this.manualLead.clientEmail.trim() || undefined,
      clientPhone: this.manualLead.clientPhone.trim() || undefined,
      autoId: this.manualLead.autoId || undefined,
      title: this.manualLead.title.trim() || undefined,
      message: this.manualLead.message.trim() || undefined,
      estimatedValue,
      stage: this.manualLead.stage || 'lead_nuevo',
    }).subscribe({
      next: (deal) => {
        this.savingManualLead.set(false);
        this.showManualLeadForm.set(false);
        this.toast.success('Lead registrado');
        this.loadCrm();
        this.loadDashboard();
        this.openDeal(deal.id);
      },
      error: (e) => {
        this.savingManualLead.set(false);
        this.toast.error(e.error?.error || 'Error al crear lead');
      },
    });
  }

  startNew() {
    this.form = this.emptyForm();
    this.editing.set(null);
    this.privateDocuments.set([]);
    this.newDocLabel = AUTO_DOC_LABELS[0];
    this.newDocNotes = '';
    this.tab.set('edit');
  }

  startEdit(car: Auto) {
    this.editing.set(car);
    this.form = { ...car, status: car.status || 'draft', images: car.images || [], verified: !!car.verified };
    this.newDocLabel = AUTO_DOC_LABELS[0];
    this.newDocNotes = '';
    this.loadPrivateDocuments(car.id);
    this.tab.set('edit');
  }

  // --- CAR GALLERY LOGIC ---
  isUploadingCarImages = false;
  isUploadingVideo = false;

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

  onVideoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploadingVideo = true;
    this.uploadService.uploadVideo(file).subscribe({
      next: (res) => {
        this.form.videoUrl = res.url;
        this.isUploadingVideo = false;
        this.toast.success('Video subido correctamente', 'Video del vehículo');
        input.value = '';
      },
      error: (e) => {
        this.isUploadingVideo = false;
        this.toast.error(e.error?.error || 'Error al subir video', 'Error');
        input.value = '';
      },
    });
  }

  removeVideo() {
    this.form.videoUrl = '';
  }

  loadPrivateDocuments(autoId: string) {
    this.autosService.getPrivateDocuments(autoId).subscribe({
      next: docs => this.privateDocuments.set(docs),
      error: () => this.privateDocuments.set([]),
    });
  }

  onPrivateDocSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.editing()?.id) return;

    this.isUploadingPrivateDoc = true;
    this.uploadService.uploadDocument(file).subscribe({
      next: (uploaded) => {
        this.autosService.addPrivateDocument(this.editing()!.id, {
          label: this.newDocLabel,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName || file.name,
          notes: this.newDocNotes.trim() || undefined,
        }).subscribe({
          next: (doc) => {
            this.privateDocuments.update(list => [doc, ...list]);
            this.newDocNotes = '';
            this.isUploadingPrivateDoc = false;
            this.toast.success('Documento guardado (solo visible en tu panel)', 'Documentación privada');
            input.value = '';
          },
          error: (e) => {
            this.isUploadingPrivateDoc = false;
            this.toast.error(e.error?.error || 'Error al registrar documento', 'Error');
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.isUploadingPrivateDoc = false;
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  deletePrivateDocument(doc: AutoPrivateDocument) {
    if (!this.editing()?.id || !confirm('¿Eliminar este documento?')) return;
    this.autosService.deletePrivateDocument(this.editing()!.id, doc.id).subscribe({
      next: () => {
        this.privateDocuments.update(list => list.filter(d => d.id !== doc.id));
        this.toast.success('Documento eliminado');
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al eliminar', 'Error'),
    });
  }

  privateDocIcon(fileName?: string | null): string {
    const name = (fileName || '').toLowerCase();
    if (name.endsWith('.pdf')) return '📄';
    if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return '🖼️';
    return '📎';
  }

  downloadPrivateDocument(doc: AutoPrivateDocument) {
    const fileName = doc.fileName || doc.label || 'documento';
    const url = doc.fileUrl;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
      });
  }
  // -------------------------

  saveCar(asDraft = false) {
    const status: AutoStatus = asDraft ? 'draft' : (this.form.status === 'baja' ? 'baja' : 'published');
    const payload = { ...this.form, status };

    const obs = this.editing()
      ? this.autosService.update(this.editing()!.id, payload)
      : this.autosService.create(payload);

    obs.subscribe({
      next: (saved) => {
        const wasNew = !this.editing();
        this.toast.success(asDraft ? 'Borrador guardado' : 'Vehículo guardado', '¡Éxito!');
        this.editing.set(saved);
        this.form = { ...saved, status: saved.status || 'draft', images: saved.images || [], verified: !!saved.verified };
        this.loadPrivateDocuments(saved.id);
        this.loadInventory();
        this.loadDashboard();
        if (wasNew) {
          this.tab.set('edit');
          this.toast.info('Puedes subir la documentación privada del vehículo abajo.', 'Documentación interna');
        } else {
          this.tab.set('inventory');
          this.editing.set(null);
          this.form = this.emptyForm();
          this.privateDocuments.set([]);
        }
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
  panelAssistantFont = 'League Spartan';
  panelAssistantPrompt = '';

  readonly assistantFontOptions = [
    { value: 'League Spartan', label: 'League Spartan (actual)' },
    { value: 'Inter', label: 'Inter' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Georgia', label: 'Georgia' },
  ];

  readonly assistantColorFields: ColorPaletteFieldDef[] = [
    { key: 'bg', label: 'Fondo del chat' },
    { key: 'btn', label: 'Color del botón' },
    { key: 'text', label: 'Color de texto' },
  ];

  get assistantColors(): Record<string, string> {
    return {
      bg: this.panelAssistantBgColor,
      btn: this.panelAssistantBtnColor,
      text: this.panelAssistantTextColor,
    };
  }

  applyAssistantColors(map: Record<string, string>) {
    if (map['bg']) this.panelAssistantBgColor = map['bg'];
    if (map['btn']) this.panelAssistantBtnColor = map['btn'];
    if (map['text']) this.panelAssistantTextColor = map['text'];
  }

  saveAssistantColors() {
    this.saveProfile();
  }

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
      panel_assistant_font: this.panelAssistantFont,
      panel_assistant_prompt: this.panelAssistantPrompt || null,
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
