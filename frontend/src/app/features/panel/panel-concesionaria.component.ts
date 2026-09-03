import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { isPaidDealBackwardMoveBlocked, isCompletedStage, isShippedStage } from '../../shared/payment-stage.utils';
import { FinancesComponent } from './finances.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { RichTextEditorComponent } from '../../shared/rich-text-editor.component';
import { PanelUserMenuComponent } from './panel-user-menu.component';
import { PanelSubscriptionLockComponent } from './panel-subscription-lock.component';
import { AmountTipDirective } from '../../shared/amount-tip.directive';
import { CrmTeamComponent } from './crm-team.component';
import { ImageCropperModalComponent, CropResult } from '../../shared/image-cropper-modal.component';
import {
  LucideBot,
  LucideCamera,
  LucideCar,
  LucideDownload,
  LucideFileText,
  LucideFolderOpen,
  LucideFunnel,
  LucideGlobe,
  LucideGripVertical,
  LucideGrid2x2,
  LucideImage,
  LucideLandmark,
  LucideLayoutDashboard,
  LucideLightbulb,
  LucideLink,
  LucideList,
  LucideMapPin,
  LucidePaperclip,
  LucidePlus,
  LucideSave,
  LucideSearch,
  LucideSettings,
  LucideSparkles,
  LucideSquarePen,
  LucideStar,
  LucideStarCheck,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUsers,
  LucideVideo,
  LucideX,
} from '@lucide/angular';

type Tab = 'dashboard' | 'pipeline' | 'inventory' | 'edit' | 'reputation' | 'plantillas' | 'perfil' | 'asistente' | 'pdf_designer' | 'page_builder' | 'finanzas' | 'team';

/** Módulos ocultos temporalmente en el panel concesionaria */
const HIDDEN_MODULES = new Set(['plantillas']);

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
  imports: [RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent, CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, PageBuilderComponent, NotificationBellComponent, FinancesComponent, PanelColorPaletteComponent, AiAssistantComponent, RichTextEditorComponent, PanelUserMenuComponent, PanelSubscriptionLockComponent, AmountTipDirective, CrmTeamComponent, ImageCropperModalComponent, LucideSettings, LucideBot, LucideLayoutDashboard, LucideFunnel, LucideList, LucideSquarePen, LucideStarCheck, LucideFileText, LucideLandmark, LucideUsers, LucideGrid2x2, LucideLink, LucideCar, LucideGlobe, LucideTrash2, LucideVideo, LucideFolderOpen, LucideSave, LucideStar, LucideCamera, LucideSearch, LucideMapPin, LucideTriangleAlert, LucidePlus, LucideX, LucideDownload, LucideGripVertical, LucideImage, LucidePaperclip, LucideLightbulb, LucideSparkles],
  templateUrl: './panel-concesionaria.component.html',
  styleUrls: ['./panel-dashboard.css', './panel-concesionaria.component.css'],
})
export class PanelConcesionariaComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;
  readonly mexicoStates = MEXICO_STATES;

  isMobileMenuOpen = signal(false);
  tab = signal<Tab>('dashboard');
  dashboard = signal<ConcesionariaDashboard | null>(null);
  crmDashboard = signal<CrmDashboard | null>(null);
  todayInbox = signal<CrmTodayInbox | null>(null);
  deals = signal<CrmDeal[]>([]);
  templates = signal<MessageTemplate[]>([]);
  selectedDealId = signal<string | null>(null);
  promptDeliveryUploadDealId = signal<string | null>(null);
  promptShippingUploadDealId = signal<string | null>(null);
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
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.siteService.get('panel-concesionaria').subscribe(t => {
      this.panelTheme.set(t);
      this.themeService.applyPanel(t);
    });
    this.loadDashboard();
    this.loadCrmSummary();
    this.scheduleAiInsights();

    this.route.queryParams.subscribe(params => {
      if (params['deal']) {
        this.loadCrm();
        this.openDeal(params['deal']);
      }
    });

    this.auth.getMe().subscribe(res => {
      const u = res.user;
      if (u?.parent_id && u.permissions?.length) {
        if (!u.permissions.includes('dashboard')) {
          const visible = u.permissions.filter(p => !HIDDEN_MODULES.has(p));
          if (visible.length) this.tab.set(visible[0] as Tab);
        }
      }
      this.profileName = (u as any).dealer_name || u.name || '';
      this.profileLogoUrl = u.logo_url || '';
      this.profileDescription = (u as any).description || '';
      this.profilePhone = (u as any).phone || '';
      this.profileAddress = (u as any).address || '';
      this.profileMapEmbedUrl = (u as any).map_embed_url || '';
      if (this.profileMapEmbedUrl) {
        const embedUrl = this.toOsmEmbedUrl(this.profileMapEmbedUrl);
        if (embedUrl) {
          this.mapPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl));
          this.mapFoundLabel.set(this.profileAddress || 'Ubicación guardada');
        }
      }
      if (!this.mapSearchQuery && this.profileAddress) {
        this.mapSearchQuery = this.profileAddress;
      }
      this.publicSlug = (u as any).slug || '';
      this.panelAssistantEnabled = u.panel_assistant_enabled !== 0 && u.panel_assistant_enabled !== false;
      this.panelAssistantName = u.panel_assistant_name || 'VEGA';
      this.panelAssistantPosition = u.panel_assistant_position || 'bottom-right';
      this.panelAssistantBgColor = u.panel_assistant_bg_color || '#0f172a';
      this.panelAssistantBtnColor = u.panel_assistant_btn_color || '#4F46E5';
      this.panelAssistantTextColor = u.panel_assistant_text_color || '#FFFFFF';
      this.panelAssistantFont = u.panel_assistant_font || 'Spartan';
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
      videoUrl: '', whatsapp: '', status: 'draft' as AutoStatus,
    };
  }

  hasPerm(mod: string): boolean {
    if (HIDDEN_MODULES.has(mod)) return false;
    const user = this.auth.user();
    if (!user) return false;
    if (!user.parent_id) return true;
    return user.permissions?.includes(mod) || false;
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'dashboard') { this.loadDashboard(); this.loadCrmSummary(); }
    if (t === 'pipeline') this.loadCrm();
    if (t === 'inventory' || t === 'edit') this.loadInventory();
    if (t === 'reputation') this.loadReviews();
    if (t === 'plantillas') this.loadTemplates();
  }

  /** Solo métricas del dashboard (sin deals ni plantillas). */
  loadCrmSummary() {
    this.crmService.getDashboard().subscribe(d => this.crmDashboard.set(d));
    this.crmService.getToday().subscribe(t => this.todayInbox.set(t));
  }

  /** Carga diferida: insights IA tras pintar la UI. */
  private scheduleAiInsights() {
    const run = () => this.loadAiInsights();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 1200);
    }
  }

  loadDashboard() {
    this.concesionariaService.getDashboard().subscribe(d => this.dashboard.set(d));
  }

  loadCrm() {
    this.loadCrmSummary();
    this.loadDeals();
    if (!this.templates().length) {
      this.crmService.getTemplates().subscribe(t => this.templates.set(t));
    }
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
    if (isPaidDealBackwardMoveBlocked(deal, this.crmStages, stage)) {
      this.toast.warning('Los trámites ya pagados solo pueden avanzar, no retroceder en el embudo.', 'Solo hacia adelante');
      this.loadCrm();
      return;
    }
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
      next: () => {
        this.loadCrm();
        if (isShippedStage(stage, this.crmStages)) {
          this.selectedDealId.set(deal.id);
          this.promptShippingUploadDealId.set(deal.id);
        }
        if (isCompletedStage(stage, this.crmStages)) {
          this.selectedDealId.set(deal.id);
          this.promptDeliveryUploadDealId.set(deal.id);
        }
      },
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

  onDealDelete(deal: CrmDeal) {
    this.crmService.deleteDeal(deal.id).subscribe({
      next: () => {
        if (this.selectedDealId() === deal.id) this.selectedDealId.set(null);
        this.loadCrm();
        this.loadDashboard();
        this.toast.success('Eliminado del embudo');
      },
      error: (e) => this.toast.error(e.error?.error || 'No se pudo eliminar'),
    });
  }

  onDealDeleted() {
    this.selectedDealId.set(null);
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

  // Crop queue: files pending user crop
  cropQueue = signal<File[]>([]);
  cropCurrentFile = signal<File | null>(null);
  readonly GALLERY_ASPECT = 3 / 2; // 102×68px — misma proporción de la galería

  onCarImagesSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    (event.target as HTMLInputElement).value = '';
    if (!files.length) return;
    // Push all files into the queue; open first one
    this.cropQueue.set(files);
    this.cropCurrentFile.set(files[0]);
  }

  onCropConfirmed(result: CropResult) {
    const queue = this.cropQueue();
    const originalName = queue[0]?.name ?? 'photo.jpg';
    this.cropCurrentFile.set(null);

    const file = new File([result.blob], originalName, { type: 'image/jpeg' });
    this.isUploadingCarImages = true;

    this.uploadService.uploadFile(file).subscribe({
      next: (res: any) => {
        if (!this.form.images) this.form.images = [];
        this.form.images = [...this.form.images, res.url];
        if (this.form.images.length === 1) this.form.imageUrl = res.url;
        this.isUploadingCarImages = false;
        const remaining = queue.slice(1);
        this.cropQueue.set(remaining);
        if (remaining.length > 0) {
          this.cropCurrentFile.set(remaining[0]);
        } else {
          this.toast.success('Fotos subidas correctamente', '¡Éxito!');
        }
      },
      error: (err: any) => {
        this.isUploadingCarImages = false;
        const msg = err?.status === 413
          ? 'La imagen es muy pesada. Aleja un poco con el zoom e intenta de nuevo.'
          : (err?.error?.error || err?.statusText || 'Error desconocido');
        this.toast.error(`No se pudo subir la foto: ${msg}`, 'Error');
        const remaining = queue.slice(1);
        this.cropQueue.set(remaining);
        if (remaining.length > 0) this.cropCurrentFile.set(remaining[0]);
      },
    });
  }

  onCropCancelled() {
    const queue = this.cropQueue();
    const remaining = queue.slice(1);
    this.cropCurrentFile.set(null);
    this.cropQueue.set(remaining);
    if (remaining.length > 0) this.cropCurrentFile.set(remaining[0]);
  }

  // ── Drag & drop reordering ──
  dragIdx     = -1;
  dragOverIdx = -1;

  onImageDragStart(e: DragEvent, idx: number) {
    this.dragIdx = idx;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(idx));
  }

  onImageDragEnter(e: DragEvent, idx: number) {
    e.preventDefault();
    this.dragOverIdx = idx;
  }

  onImageDragLeave() {
    this.dragOverIdx = -1;
  }

  onImageDropItem(e: DragEvent, toIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    this.moveImage(this.dragIdx, toIdx);
  }

  onImageDrop(e: DragEvent) {
    e.preventDefault();
    this.dragIdx = -1;
    this.dragOverIdx = -1;
  }

  private moveImage(from: number, to: number) {
    if (from === to || from < 0 || !this.form.images) return;
    const imgs = [...this.form.images];
    const [item] = imgs.splice(from, 1);
    imgs.splice(to, 0, item);
    this.form.images = imgs;
    this.form.imageUrl = imgs[0];
    this.dragIdx = -1;
    this.dragOverIdx = -1;
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

  privateDocKind(fileName?: string | null): 'pdf' | 'image' | 'file' {
    const name = (fileName || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'pdf';
    if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return 'image';
    return 'file';
  }

  readonly reviewStarSlots = [1, 2, 3, 4, 5];

  stripEmojis(text: string): string {
    return (text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
  mapSearchQuery = '';
  mapSearching = false;
  mapSearchError = '';
  mapFoundLabel = signal('');
  mapPreviewUrl = signal<SafeResourceUrl | null>(null);
  isUploadingLogo = false;
  logoCropFile = signal<File | null>(null);

  get publicPageUrl(): string {
    return this.publicSlug ? `${window.location.origin}/concesionarias/${this.publicSlug}` : '';
  }

  /** URL corta con Open Graph para WhatsApp/redes (igual que en la página pública) */
  get publicShareUrl(): string {
    return this.publicSlug ? `${window.location.origin}/sc/${this.publicSlug}` : '';
  }

  copyPublicPageLink() {
    if (!this.publicSlug) {
      this.toast.warning('Guarda tu perfil con un slug público para compartir tu página.');
      return;
    }
    navigator.clipboard.writeText(this.publicShareUrl).then(
      () => this.toast.success('Enlace copiado al portapapeles'),
      () => this.toast.error('No se pudo copiar el enlace'),
    );
  }

  panelAssistantEnabled = true;
  panelAssistantName = 'VEGA';
  panelAssistantPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  panelAssistantBgColor = '#0f172a';
  panelAssistantBtnColor = '#4F46E5';
  panelAssistantTextColor = '#FFFFFF';
  panelAssistantFont = 'Spartan';
  panelAssistantPrompt = '';

  readonly assistantFontOptions = [
    { value: 'Spartan', label: 'Spartan (actual)' },
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
    this.saveAssistantConfig();
  }

  saveAssistantConfig() {
    this.auth.updateMe({
      panel_assistant_enabled: this.panelAssistantEnabled,
      panel_assistant_name: this.panelAssistantName,
      panel_assistant_position: this.panelAssistantPosition,
      panel_assistant_bg_color: this.panelAssistantBgColor,
      panel_assistant_btn_color: this.panelAssistantBtnColor,
      panel_assistant_text_color: this.panelAssistantTextColor,
      panel_assistant_font: this.panelAssistantFont,
      panel_assistant_prompt: this.panelAssistantPrompt || null,
    }).subscribe({
      next: () => this.toast.success('Configuración del asistente guardada', 'Asistente IA'),
      error: () => this.toast.error('No se pudo guardar el asistente'),
    });
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.logoCropFile.set(file);
    (event.target as HTMLInputElement).value = '';
  }

  onLogoCropConfirmed(result: { blob: Blob; previewUrl: string }) {
    const file = new File([result.blob], 'logo.jpg', { type: 'image/jpeg' });
    this.isUploadingLogo = true;
    this.logoCropFile.set(null);
    this.uploadService.uploadFile(file).subscribe({
      next: (res: any) => {
        this.profileLogoUrl = res.url;
        this.isUploadingLogo = false;
        this.saveProfile();
      },
      error: () => {
        this.isUploadingLogo = false;
        this.message.set('Error al subir la imagen');
      }
    });
  }

  onLogoCropCancelled() {
    this.logoCropFile.set(null);
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
    }).subscribe({
      next: () => this.toast.success('Tu información de perfil ha sido guardada.', 'Perfil actualizado'),
      error: () => {}
    });
  }

  /** Returns an embeddable URL for panel preview, or null if format is not recognized */
  private toOsmEmbedUrl(url: string): string | null {
    const s = url.trim();
    if (!s) return null;
    // Already an OSM embed
    if (s.includes('openstreetmap.org/export/embed')) return s;
    // Google Maps embed with output=embed (safe, no X-Frame-Options issue)
    if (s.includes('maps.google.com') && s.includes('output=embed')) return s;
    if (s.includes('maps/embed')) return s;
    // Google Maps URL with coordinates — convert to OSM
    const coordMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const delta = 0.008;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
    }
    return null;
  }

  searchAddress() {
    const q = this.mapSearchQuery.trim();
    if (!q) return;
    this.mapSearching = true;
    this.mapSearchError = '';
    this.mapFoundLabel.set('');
    // Simplify address: remove postal codes like "C.P. 12345" and take first 4 parts
    const simplified = q
      .replace(/C\.?P\.?\s*\d{5}/gi, '')
      .split(',').slice(0, 4).join(',').trim();
    const query = encodeURIComponent(simplified || q);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1&accept-language=es`;
    this.http.get<any[]>(url).subscribe({
      next: (results) => {
        this.mapSearching = false;
        if (results && results.length > 0) {
          const r = results[0];
          const lat = parseFloat(r.lat);
          const lng = parseFloat(r.lon);
          const delta = 0.008;
          const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
          this.profileMapEmbedUrl = osmUrl;
          this.mapPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(osmUrl));
          this.mapFoundLabel.set(r.display_name);
          if (!this.profileAddress) {
            this.profileAddress = r.display_name.split(',').slice(0, 3).join(',').trim();
          }
        } else {
          // Fallback: use Google Maps embed (no API key needed with output=embed)
          this.applyGoogleMapsEmbed(q);
        }
      },
      error: () => {
        this.mapSearching = false;
        // Fallback: use Google Maps embed
        this.applyGoogleMapsEmbed(q);
      }
    });
  }

  private applyGoogleMapsEmbed(address: string) {
    const googleUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=es`;
    this.profileMapEmbedUrl = googleUrl;
    this.mapPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(googleUrl));
    this.mapFoundLabel.set(address);
  }

  statusLabel = statusLabel;
}

function statusLabel(s: AutoStatus | string) {
  return ({ draft: 'Borrador', published: 'Publicado', baja: 'De baja' } as Record<string, string>)[s] || s;
}
