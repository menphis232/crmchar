import { Component, OnInit, OnDestroy, signal, effect, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { CrmService, GestoresService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { CrmDashboard, CrmDeal, CrmTodayInbox, CrmVerificationAlert, Gestor, GestorReview, MessageTemplate, PageBuilderConfig, SiteSettings } from '../../models';
import { isDealPaymentLocked, isPaidDealBackwardMoveBlocked, isCompletedStage, isShippedStage, CrmStageConfig } from '../../shared/payment-stage.utils';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { CrmClientsDirectoryComponent } from './crm-clients-directory.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { CrmTeamComponent } from './crm-team.component';
import { FinancesComponent } from './finances.component';
import { PageBuilderComponent } from './page-builder.component';
import { ToastService } from '../../core/toast.service';
import { SocketService } from '../../core/socket.service';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { ImageCropperModalComponent, CropResult } from '../../shared/image-cropper-modal.component';
import { hasServicePrice, serviceRequirements } from '../../shared/gestor-service.utils';
import { googleEmbedFromAddress, googleEmbedFromCoords, toGoogleMapsEmbedUrl } from '../../shared/map-embed.utils';
import {
  LucideBot,
  LucideCamera,
  LucideClock,
  LucideCopy,
  LucideCreditCard,
  LucideFileText,
  LucideFunnel,
  LucideGlobe,
  LucideLandmark,
  LucideLayoutDashboard,
  LucideLightbulb,
  LucideLink,
  LucideMapPin,
  LucidePalette,
  LucidePlus,
  LucideSearch,
  LucideSettings,
  LucideSparkles,
  LucideSquarePen,
  LucideTriangleAlert,
  LucideUsers,
  LucideWrench,
  LucideX,
  LucideGripVertical,
  LucideImage,
  LucideStar,
  LucideCar,
  LucideZap,
  LucideWallet,
} from '@lucide/angular';
import { PanelUserMenuComponent } from './panel-user-menu.component';
import { PanelSubscriptionLockComponent } from './panel-subscription-lock.component';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL, GESTOR_SHARE_TAGLINE } from '../../shared/brand.constants';
import { getGestorOgImageUrl, getGestorPanelPreviewImageUrl, getGestorShareSubtitle } from '../../shared/gestor-share.util';
import { MEXICO_STATES } from '../../shared/mexico-states';
import {
  GESTOR_BANNER_ASPECT,
  GESTOR_BANNER_SIZE_LABEL,
  GESTOR_GALLERY_ASPECT,
  GESTOR_GALLERY_MAX,
  GESTOR_GALLERY_OUTPUT,
  GESTOR_GALLERY_SIZE_LABEL,
  GESTOR_LOGO_ASPECT,
  GESTOR_LOGO_SIZE_LABEL,
} from '../../shared/gestor-media.constants';

type GestorTab = 'dashboard' | 'pipeline' | 'clientes' | 'servicios' | 'perfil' | 'asistente' | 'plantillas' | 'pdf_designer' | 'team' | 'finanzas' | 'page_builder' | 'automatizaciones';

/** Constructor Web oculto hasta v2 */
const SHOW_PAGE_BUILDER = false;

const DEFAULT_AI_TIPS = [
  'Configura mensajes de bienvenida en WhatsApp con saludo, lista de requisitos y tiempo estimado; el primer contacto marca la confianza del cliente.',
  'Define un protocolo de 3 seguimientos (día 1, 3 y 7) para prospectos en espera; en trámites vehiculares muchas ventas se cierran en el segundo mensaje.',
  'Usa una plantilla de precalificación en el primer chat (documentación, adeudos, plazo) para cotizar más rápido y dar una experiencia más profesional.',
];

const AUTOMATION_VARIABLES = [
  { key: 'nombre', label: 'Nombre del cliente', example: 'María López' },
  { key: 'tramite', label: 'Título del trámite', example: 'Baja de placas' },
  { key: 'gestor', label: 'Tu nombre', example: 'Gestoría Pérez' },
] as const;

const DEFAULT_GESTOR_STAGES: CrmStageConfig[] = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'en_tramite', label: 'En trámite' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'completado', label: 'Completado' },
  { id: 'perdido', label: 'Perdido' },
];

@Component({
  selector: 'app-panel-gestor',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DecimalPipe, DatePipe, CrmKanbanComponent, CrmDealPanelComponent,
    CrmTodayInboxComponent, CrmContactPanelComponent, CrmClientsDirectoryComponent, PdfDesignerComponent, NotificationBellComponent, CrmTeamComponent, FinancesComponent, PageBuilderComponent, PanelColorPaletteComponent, AiAssistantComponent, PanelUserMenuComponent, PanelSubscriptionLockComponent, ImageCropperModalComponent,
    LucideSettings, LucideLayoutDashboard, LucideFunnel, LucideWrench, LucideLandmark, LucideBot, LucideFileText, LucidePalette, LucideUsers, LucideGlobe, LucideSparkles, LucideLightbulb, LucideLink, LucideCopy, LucideClock, LucideSquarePen, LucideCreditCard, LucideMapPin, LucidePlus, LucideCamera, LucideSearch, LucideTriangleAlert, LucideX, LucideGripVertical, LucideImage, LucideStar, LucideCar, LucideZap, LucideWallet,
  ],
  templateUrl: './panel-gestor.component.html',
  styleUrls: ['./panel-dashboard.css', './panel-gestor.component.css'],
})
export class PanelGestorComponent implements OnInit, OnDestroy {
  readonly showPageBuilder = SHOW_PAGE_BUILDER;
  readonly gestorLogoAspect = GESTOR_LOGO_ASPECT;
  readonly gestorLogoSizeLabel = GESTOR_LOGO_SIZE_LABEL;
  readonly gestorBannerAspect = GESTOR_BANNER_ASPECT;
  readonly gestorBannerSizeLabel = GESTOR_BANNER_SIZE_LABEL;
  readonly gestorGalleryAspect = GESTOR_GALLERY_ASPECT;
  readonly gestorGallerySizeLabel = GESTOR_GALLERY_SIZE_LABEL;
  readonly gestorGalleryMax = GESTOR_GALLERY_MAX;
  readonly gestorGalleryOutput = GESTOR_GALLERY_OUTPUT;
  private sanitizer = inject(DomSanitizer);
  private socketService = inject(SocketService);
  private onCrmNotification = (payload: unknown) => {
    const notif = payload as { type?: string; ref_id?: string; title?: string; body?: string };
    if (notif.type === 'nuevo_lead') {
      this.loadCrmSummary();
      if (this.tab() !== 'pipeline') {
        this.setTab('pipeline');
      }
      this.crmService.getDeals({
        q: this.searchQuery || undefined,
        stage: this.filterStage || undefined,
      }).subscribe(d => {
        this.deals.set(d);
        if (notif.ref_id) {
          this.openDeal(notif.ref_id);
        }
      });
      return;
    }
    if (notif.type === 'new_message') {
      this.loadCrmSummary();
      if (notif.ref_id) {
        this.crmService.getDeals({
          q: this.searchQuery || undefined,
          stage: this.filterStage || undefined,
        }).subscribe(d => this.deals.set(d));
        if (this.selectedDealId() !== notif.ref_id) {
          this.openDeal(notif.ref_id);
        }
      }
    }
  };

  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;
  readonly gestorShareTagline = GESTOR_SHARE_TAGLINE;
  readonly mexicoStates = MEXICO_STATES;

  tab = signal<GestorTab>('dashboard');
  profile = signal<Gestor | null>(null);
  panelTheme = signal<SiteSettings>({});
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
  bio = '';
  profileName = '';
  gestorState = '';
  gestorExperienceYears: number | '' = '';
  gestorTramitesCount: number | '' = '';
  publicSlug = '';
  googleAnalyticsId = '';
  stripePublicKey = '';
  stripeSecretKey = '';
  mpAccessToken = '';
  mpPublicKey = '';

  aiConfigs: { provider: string, key: string }[] = [{ provider: '', key: '' }];
  chatbotBgColor = '#000000';
  chatbotBtnColor = '#4F46E5';
  chatbotTextColor = '#FFFFFF';
  panelAssistantEnabled = true;
  panelAssistantName = 'VEGA';
  panelAssistantPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  panelAssistantBgColor = '#0f172a';
  panelAssistantBtnColor = '#4F46E5';
  panelAssistantTextColor = '#FFFFFF';
  panelAssistantFont = 'Spartan';
  panelAssistantPrompt = '';
  gestorPhone = '';
  gestorAddress = '';
  gestorMapEmbedUrl = '';
  mapSearchQuery = '';
  mapSearching = false;
  mapSearchError = '';
  mapFoundLabel = signal('');
  mapPreviewUrl = signal<SafeResourceUrl | null>(null);
  logoCropFile = signal<File | null>(null);
  aiInsights = signal<string[]>(DEFAULT_AI_TIPS);
  verificationAlerts = signal<CrmVerificationAlert[]>([]);
  isAiLoading = signal(false);
  message = signal('');
  newService = { name: '', timeEstimate: '', price: null as number | null, requiredDocumentsStr: '', includesStr: '', bonusStr: '' };
  newTemplate = { name: '', content: '' };
  automations = signal<any[]>([]);
  newAutomation = { name: '', trigger_event: 'stage_change', trigger_stage: '', trigger_delay_days: 3, action_type: 'send_email', action_content: '' };
  readonly automationVariables = AUTOMATION_VARIABLES;
  isMobileMenuOpen = signal(false);

  crmStages: CrmStageConfig[] = [];

  showManualLeadForm = signal(false);
  savingManualLead = signal(false);
  manualLeadServices = signal<{ name: string; price: number | null }[]>([]);
  manualLead = {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceName: '',
    location: '',
    title: '',
    message: '',
    estimatedValue: '' as string | number,
    stage: 'nuevo',
  };

  constructor(
    public auth: AuthService,
    private gestoresService: GestoresService,
    private crmService: CrmService,
    private siteService: SiteService,
    private themeService: ThemeService,
    private uploadService: UploadService,
    private http: HttpClient,
    private toast: ToastService,
    private route: ActivatedRoute
  ) {
    effect(() => {
      const settings = this.panelTheme();
      if (settings && Object.keys(settings).length > 0) {
        this.themeService.applyPanel(settings);
      }
    });
  }

  ngOnInit() {
    this.siteService.get('panel-gestor').subscribe(t => {
      this.panelTheme.set(t);
    });
    this.loadProfile();
    this.loadGestorReviews();
    this.gestorReviewForm.reviewDate = this.todayInputDate();
    this.loadCrmSummary();
    this.loadVerificationAlerts();
    this.scheduleAiInsights();

    this.route.queryParams.subscribe(params => {
      if (params['deal']) {
        this.loadCrm();
        this.openDeal(params['deal']);
      }
    });

    const user = this.auth.user();
    if (user?.parent_id && user?.permissions && user.permissions.length > 0) {
      if (!user.permissions.includes('dashboard')) {
        this.tab.set(user.permissions[0] as GestorTab);
      }
    }

    if (user?.logo_url) {
      this.profileLogoUrl = user.logo_url;
    }

    if (user) {
      this.socketService.connect(user.id, user.parent_id || user.id);
      this.socketService.off('notification', this.onCrmNotification);
      this.socketService.on('notification', this.onCrmNotification);
    }
  }

  ngOnDestroy() {
    this.socketService.off('notification', this.onCrmNotification);
  }

  hasPerm(mod: string): boolean {
    const user = this.auth.user();
    if (!user) return false;
    if (!user.parent_id) return true; // Boss has all permissions
    return user.permissions?.includes(mod) || false;
  }

  setTab(t: GestorTab) {
    this.tab.set(t);
    if (t === 'dashboard') {
      this.loadCrmSummary();
      this.loadVerificationAlerts();
    }
    if (t === 'pipeline') {
      this.loadCrm();
      if (!this.deals().length) this.loadDeals();
    }
    if (t === 'clientes') this.loadVerificationAlerts();
    if (t === 'plantillas') this.loadTemplates();
    if (t === 'automatizaciones') {
      this.syncCrmStagesFromDashboard();
      this.loadAutomations();
    }
  }

  loadCrmSummary() {
    this.crmService.getDashboard().subscribe(d => {
      this.crmDashboard.set(d);
      if (this.tab() === 'automatizaciones' || !this.crmStages.length) {
        this.syncCrmStagesFromDashboard();
      }
    });
    this.crmService.getToday().subscribe(t => this.todayInbox.set(t));
  }

  loadVerificationAlerts() {
    this.crmService.getVerificationAlerts().subscribe({
      next: (alerts) => this.verificationAlerts.set(alerts),
      error: () => this.verificationAlerts.set([]),
    });
  }

  openClientContact(contactId: string) {
    this.selectedDealId.set(null);
    this.selectedContactId.set(contactId);
  }

  private scheduleAiInsights() {
    const run = () => this.loadAiInsights();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 1200);
    }
  }

  loadCrm() {
    this.loadCrmSummary();
    this.loadDeals();
    if (!this.templates().length) {
      this.crmService.getTemplates().subscribe(t => this.templates.set(t));
    }
  }

  loadGestorReviews() {
    this.gestoresService.getMyReviews().subscribe({
      next: (data) => {
        this.gestorReviews.set(data.reviews);
        this.gestorReviewsRating.set(data.rating);
        this.gestorReviewsCount.set(data.reviewCount);
        const profile = this.profile();
        if (profile) {
          this.profile.set({ ...profile, rating: data.rating, reviewCount: data.reviewCount, reviews: data.reviews });
        }
      },
      error: () => {
        this.gestorReviews.set([]);
        this.gestorReviewsRating.set(0);
        this.gestorReviewsCount.set(0);
      },
    });
  }

  resetGestorReviewForm() {
    this.editingReviewId = null;
    this.gestorReviewForm = { author: '', rating: 5, comment: '', reviewDate: this.todayInputDate() };
  }

  private todayInputDate(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private reviewDateInput(createdAt?: string): string {
    if (!createdAt) return this.todayInputDate();
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return this.todayInputDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  editGestorReview(review: GestorReview) {
    this.editingReviewId = review.id;
    this.gestorReviewForm = {
      author: review.author,
      rating: review.rating,
      comment: review.comment,
      reviewDate: this.reviewDateInput(review.createdAt),
    };
  }

  saveGestorReview() {
    const { author, rating, comment, reviewDate } = this.gestorReviewForm;
    if (!author.trim() || !comment.trim()) {
      this.toast.error('Completa autor y comentario.');
      return;
    }
    if (!reviewDate) {
      this.toast.error('Selecciona la fecha de la reseña.');
      return;
    }

    const payload = {
      author: author.trim(),
      rating: Number(rating),
      comment: comment.trim(),
      reviewDate,
    };
    const editing = this.editingReviewId;
    const req = editing
      ? this.gestoresService.updateReview(editing, payload)
      : this.gestoresService.createReview(payload);

    req.subscribe({
      next: (res) => {
        this.gestorReviewsRating.set(res.rating);
        this.gestorReviewsCount.set(res.reviewCount);
        this.loadGestorReviews();
        this.resetGestorReviewForm();
        this.toast.success(editing ? 'Reseña actualizada.' : 'Reseña publicada en tu ficha.');
      },
      error: (err) => this.toast.error(err.error?.error || 'No se pudo guardar la reseña.'),
    });
  }

  deleteGestorReview(id: string) {
    if (!confirm('¿Eliminar esta reseña de tu ficha pública?')) return;
    this.gestoresService.deleteReview(id).subscribe({
      next: (res) => {
        this.gestorReviewsRating.set(res.rating);
        this.gestorReviewsCount.set(res.reviewCount);
        this.loadGestorReviews();
        if (this.editingReviewId === id) this.resetGestorReviewForm();
        this.toast.success('Reseña eliminada.');
      },
      error: (err) => this.toast.error(err.error?.error || 'No se pudo eliminar.'),
    });
  }

  loadProfile() {
    this.gestoresService.getMyProfile().subscribe(p => {
      this.profile.set(p);
      this.bio = p.bio || '';
      this.profileName = p.name || '';
      this.gestorState = p.state || p.location || '';
      this.gestorExperienceYears = p.experienceYears ?? '';
      this.gestorTramitesCount = p.tramitesCount ?? '';
      this.publicSlug = p.slug || '';
      this.gestorPhone = p.phone || p.whatsapp || '';
      this.gestorAddress = p.address || '';
      this.gestorMapEmbedUrl = p.mapEmbedUrl || '';
      this.mapSearchQuery = p.address || '';
      this.gestorGalleryImages = [...(p.galleryImages || [])].slice(0, this.gestorGalleryMax);
      this.profileBannerUrl = p.bannerUrl || '';
      const embed = toGoogleMapsEmbedUrl(this.gestorMapEmbedUrl, this.gestorAddress);
      this.mapPreviewUrl.set(embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null);
    });
    this.auth.getMe().subscribe(res => {
      this.profileLogoUrl = res.user.logo_url || '';
      this.googleAnalyticsId = res.user.google_analytics_id || '';
      this.stripeSecretKey = res.user.stripe_secret_key || '';
      this.stripePublicKey = res.user.stripe_public_key || '';
      this.mpAccessToken = res.user.mp_access_token || '';
      this.mpPublicKey = res.user.mp_public_key || '';
      
      const rawApiKey = res.user.ai_api_key || '';
      try {
        if (rawApiKey.trim().startsWith('[')) {
          this.aiConfigs = JSON.parse(rawApiKey);
        } else {
          const keys = rawApiKey.split(',').map(k => k.trim()).filter(Boolean);
          if (keys.length > 0) {
            this.aiConfigs = keys.map(k => ({ provider: res.user.ai_provider || '', key: k }));
          } else {
            this.aiConfigs = [{ provider: res.user.ai_provider || '', key: '' }];
          }
        }
      } catch (e) {
        this.aiConfigs = [{ provider: res.user.ai_provider || '', key: rawApiKey }];
      }
      if (this.aiConfigs.length === 0) {
        this.aiConfigs = [{ provider: '', key: '' }];
      }
      this.chatbotBgColor = res.user.chatbot_bg_color || '#000000';
      this.chatbotBtnColor = res.user.chatbot_btn_color || '#4F46E5';
      this.chatbotTextColor = res.user.chatbot_text_color || '#FFFFFF';
      this.panelAssistantEnabled = res.user.panel_assistant_enabled !== 0 && res.user.panel_assistant_enabled !== false;
      this.panelAssistantName = res.user.panel_assistant_name || 'VEGA';
      this.panelAssistantPosition = res.user.panel_assistant_position || 'bottom-right';
      this.panelAssistantBgColor = res.user.panel_assistant_bg_color || '#0f172a';
      this.panelAssistantBtnColor = res.user.panel_assistant_btn_color || '#4F46E5';
      this.panelAssistantTextColor = res.user.panel_assistant_text_color || '#FFFFFF';
      this.panelAssistantFont = res.user.panel_assistant_font || 'Spartan';
      this.panelAssistantPrompt = res.user.panel_assistant_prompt || '';
      this.crmStages = Array.isArray(res.user.crm_stages) && res.user.crm_stages.length > 0
        ? [...res.user.crm_stages]
        : [...DEFAULT_GESTOR_STAGES];
    });
  }

  get publicPageUrl(): string {
    return this.publicSlug ? `${window.location.origin}/gestores/${this.publicSlug}` : '';
  }

  get publicShareUrl(): string {
    return this.publicSlug ? `${window.location.origin}/sg/${this.publicSlug}` : '';
  }

  get publicShareOgImageUrl(): string | null {
    const p = this.profile();
    if (!p?.slug) return null;
    return getGestorOgImageUrl({
      slug: p.slug,
      logoUrl: this.profileLogoUrl || p.logoUrl,
      photoUrl: p.photoUrl,
      bannerUrl: p.bannerUrl,
    });
  }

  get panelSharePreviewImageUrl(): string | null {
    const p = this.profile();
    if (!p) return null;
    return getGestorPanelPreviewImageUrl(p, this.profileLogoUrl || p.logoUrl);
  }

  onSharePreviewImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const og = this.publicShareOgImageUrl;
    if (!og || img.dataset['fallback'] === '1') return;
    img.dataset['fallback'] = '1';
    img.src = `${og}?t=${Date.now()}`;
  }

  get gestorShareSubtitle(): string {
    const p = this.profile();
    return p ? getGestorShareSubtitle(p) : '';
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

  syncCrmStagesFromDashboard() {
    const dash = this.crmDashboard();
    if (dash?.stages?.length) {
      const prev = new Map(this.crmStages.map(s => [s.id, s]));
      this.crmStages = dash.stages.map(id => {
        const existing = prev.get(id);
        return {
          id,
          label: dash.stageLabels[id] || existing?.label || id,
          isPayment: existing?.isPayment,
        };
      });
      return;
    }
    if (!this.crmStages.length) {
      this.crmStages = [...DEFAULT_GESTOR_STAGES];
    }
  }


  loadAiInsights() {
    const today = new Date().toDateString();
    const cacheKey = 'crm_ai_insights_v2';
    const cacheDateKey = 'crm_ai_insights_date_v2';
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

  onStageChange({ deal, stage, fromDrag }: { deal: CrmDeal; stage: string; fromDrag?: boolean }) {
    if (isDealPaymentLocked(deal, this.crmStages) && stage !== deal.stage) {
      this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      this.loadDeals();
      return;
    }
    if (isPaidDealBackwardMoveBlocked(deal, this.crmStages, stage)) {
      this.toast.warning('Los trámites ya pagados solo pueden avanzar, no retroceder en el embudo.', 'Solo hacia adelante');
      this.loadDeals();
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
        this.loadDeals();
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
        this.toast.error('No se pudo mover la tarjeta');
        this.loadDeals();
      },
    });
  }

  onStagesChange(stages: CrmStageConfig[]) {
    this.auth.updateMe({ crm_stages: stages }).subscribe({
      next: () => {
        this.toast.success('Etapas guardadas');
        this.crmStages = [...stages];
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

  openManualLeadForm() {
    this.manualLead = {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      serviceName: '',
      location: '',
      title: '',
      message: '',
      estimatedValue: '',
      stage: 'nuevo',
    };
    const services = this.profile()?.services?.map(s => ({ name: s.name, price: s.price })) ?? [];
    if (services.length) {
      this.manualLeadServices.set(services);
    } else {
      this.gestoresService.getMyProfile().subscribe(p => {
        this.profile.set(p);
        this.manualLeadServices.set(p.services?.map(s => ({ name: s.name, price: s.price })) ?? []);
      });
    }
    this.showManualLeadForm.set(true);
  }

  closeManualLeadForm() {
    this.showManualLeadForm.set(false);
  }

  onManualLeadServiceChange() {
    const service = this.manualLeadServices().find(s => s.name === this.manualLead.serviceName);
    if (!service) return;
    this.manualLead.title = service.name;
    if (service.price) this.manualLead.estimatedValue = service.price;
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
      serviceName: this.manualLead.serviceName || undefined,
      location: this.manualLead.location.trim() || undefined,
      title: this.manualLead.title.trim() || undefined,
      message: this.manualLead.message.trim() || undefined,
      estimatedValue,
      stage: this.manualLead.stage || 'nuevo',
    }).subscribe({
      next: (deal) => {
        this.savingManualLead.set(false);
        this.showManualLeadForm.set(false);
        this.toast.success('Trámite registrado');
        this.loadCrm();
        this.openDeal(deal.id);
      },
      error: (e) => {
        this.savingManualLead.set(false);
        this.toast.error(e.error?.error || 'Error al crear trámite');
      },
    });
  }

  onDealUpdated() {
    this.loadDeals();
  }

  copyLink() {
    if (!this.publicShareUrl) {
      this.toast.warning('Guarda tu perfil con un slug público para compartir tu página.');
      return;
    }
    navigator.clipboard.writeText(this.publicShareUrl).then(
      () => this.toast.success('Enlace copiado al portapapeles'),
      () => this.toast.error('No se pudo copiar el enlace'),
    );
  }

  // Profile logo & banner
  profileLogoUrl = '';
  profileBannerUrl = '';
  isUploadingLogo = false;
  isUploadingBanner = false;
  bannerCropFile = signal<File | null>(null);
  gestorGalleryImages: string[] = [];
  gestorReviews = signal<GestorReview[]>([]);
  gestorReviewsRating = signal(0);
  gestorReviewsCount = signal(0);
  gestorReviewForm = { author: '', rating: 5, comment: '', reviewDate: '' };
  editingReviewId: string | null = null;
  reviewStarSlots = [1, 2, 3, 4, 5];
  isUploadingGallery = false;
  galleryCropQueue = signal<File[]>([]);
  galleryCropCurrentFile = signal<File | null>(null);
  galleryDragIdx = -1;
  galleryDragOverIdx = -1;
  serviceDragIdx = -1;
  serviceDragOverIdx = -1;
  private serviceOrderSaving = false;

  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoCropFile.set(file);
    (event.target as HTMLInputElement).value = '';
  }

  onLogoCropConfirmed(result: { blob: Blob; previewUrl: string }) {
    const file = new File([result.blob], 'logo.jpg', { type: 'image/jpeg' });
    this.isUploadingLogo = true;
    this.logoCropFile.set(null);
    this.uploadService.uploadFile(file).subscribe({
      next: (res: { url: string }) => {
        this.profileLogoUrl = res.url;
        this.isUploadingLogo = false;
        this.saveProfile();
      },
      error: () => {
        this.isUploadingLogo = false;
        this.message.set('Error al subir la imagen');
      },
    });
  }

  onLogoCropCancelled() {
    this.logoCropFile.set(null);
  }

  onBannerSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.bannerCropFile.set(file);
    (event.target as HTMLInputElement).value = '';
  }

  onBannerCropConfirmed(result: { blob: Blob; previewUrl: string }) {
    const file = new File([result.blob], 'banner.jpg', { type: 'image/jpeg' });
    this.isUploadingBanner = true;
    this.bannerCropFile.set(null);
    this.uploadService.uploadFile(file).subscribe({
      next: (res: { url: string }) => {
        this.profileBannerUrl = res.url;
        this.isUploadingBanner = false;
        this.saveProfile();
      },
      error: () => {
        this.isUploadingBanner = false;
        this.message.set('Error al subir el banner');
      },
    });
  }

  onBannerCropCancelled() {
    this.bannerCropFile.set(null);
  }

  clearBanner() {
    this.profileBannerUrl = '';
    this.saveProfile();
  }

  private toOptionalCount(value: number | ''): number | undefined {
    if (value === '') return undefined;
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) return undefined;
    return Math.floor(n);
  }

  saveProfile() {
    const name = this.profileName.trim();
    const location = this.gestorState.trim();
    const prevSlug = this.publicSlug;

    this.gestoresService.updateProfile({
      bio: this.bio,
      name: name || undefined,
      location: location || undefined,
      state: location || undefined,
      experienceYears: this.toOptionalCount(this.gestorExperienceYears),
      tramitesCount: this.toOptionalCount(this.gestorTramitesCount),
      phone: this.gestorPhone || undefined,
      whatsapp: this.gestorPhone || undefined,
      address: this.gestorAddress || undefined,
      mapEmbedUrl: toGoogleMapsEmbedUrl(this.gestorMapEmbedUrl, this.gestorAddress) || undefined,
      photoUrl: this.profileLogoUrl || undefined,
      bannerUrl: this.profileBannerUrl || undefined,
      galleryImages: this.gestorGalleryImages.slice(0, this.gestorGalleryMax),
    }).subscribe({
      next: p => {
        this.publicSlug = p.slug || '';
        this.profile.set({ ...this.profile()!, ...p, slug: p.slug || '', name: name || p.name });
        this.auth.getMe().subscribe({
          next: (res) => {
            const syncedBuilder = this.syncPageBuilderWithProfile(
              res.user.page_builder_config,
              name || p.name,
              location || p.location || '',
              this.bio,
            );
            this.auth.updateMe({
              name: name || undefined,
              logo_url: this.profileLogoUrl,
              google_analytics_id: this.googleAnalyticsId,
              stripe_secret_key: this.stripeSecretKey,
              stripe_public_key: this.stripePublicKey,
              mp_access_token: this.mpAccessToken,
              mp_public_key: this.mpPublicKey,
              ...(syncedBuilder ? { page_builder_config: syncedBuilder } : {}),
            }).subscribe({
              next: () => {
                const slugChanged = !!p.slug && p.slug !== prevSlug;
                const msg = slugChanged
                  ? 'Perfil guardado. Tu nombre y enlace público se actualizaron.'
                  : 'Tu información de perfil ha sido guardada.';
                this.toast.success(msg, 'Perfil actualizado');
              },
              error: () => this.toast.error('No se pudo guardar el perfil'),
            });
          },
          error: () => this.toast.error('No se pudo guardar el perfil'),
        });
      },
      error: () => this.toast.error('No se pudo guardar el perfil'),
    });
  }

  private syncPageBuilderWithProfile(
    config: PageBuilderConfig | null | undefined,
    name: string,
    location: string,
    bio: string,
  ): PageBuilderConfig | null | undefined {
    if (!config?.blocks?.length) return config;

    const trimmedBio = bio.trim();
    let blocks = config.blocks.map(block => {
      if (block.type === 'hero') {
        return {
          ...block,
          data: {
            ...block.data,
            title: name,
            subtitle: location || block.data.subtitle,
          },
        };
      }
      if (block.type === 'text' && trimmedBio) {
        return { ...block, data: { ...block.data, content: trimmedBio } };
      }
      return block;
    });

    if (trimmedBio && !blocks.some(b => b.type === 'text')) {
      const heroIdx = blocks.findIndex(b => b.type === 'hero');
      const insertAt = heroIdx >= 0 ? heroIdx + 1 : 0;
      blocks = [
        ...blocks.slice(0, insertAt),
        {
          id: `block-bio-${Date.now()}`,
          type: 'text',
          region: 'main',
          data: { content: trimmedBio },
        },
        ...blocks.slice(insertAt),
      ];
    }

    return { ...config, blocks };
  }

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

  readonly chatbotColorFields: ColorPaletteFieldDef[] = [
    { key: 'chatbotBg', label: 'Chatbot público · Fondo' },
    { key: 'chatbotBtn', label: 'Chatbot público · Botón' },
    { key: 'chatbotText', label: 'Chatbot público · Texto' },
  ];

  readonly assistantColorFields: ColorPaletteFieldDef[] = [
    { key: 'bg', label: 'Asistente panel · Fondo' },
    { key: 'btn', label: 'Asistente panel · Botón' },
    { key: 'text', label: 'Asistente panel · Texto' },
  ];

  get chatbotColors(): Record<string, string> {
    return {
      chatbotBg: this.chatbotBgColor,
      chatbotBtn: this.chatbotBtnColor,
      chatbotText: this.chatbotTextColor,
    };
  }

  get assistantColors(): Record<string, string> {
    return {
      bg: this.panelAssistantBgColor,
      btn: this.panelAssistantBtnColor,
      text: this.panelAssistantTextColor,
    };
  }

  applyChatbotColors(map: Record<string, string>) {
    if (map['chatbotBg']) this.chatbotBgColor = map['chatbotBg'];
    if (map['chatbotBtn']) this.chatbotBtnColor = map['chatbotBtn'];
    if (map['chatbotText']) this.chatbotTextColor = map['chatbotText'];
  }

  applyAssistantColors(map: Record<string, string>) {
    if (map['bg']) this.panelAssistantBgColor = map['bg'];
    if (map['btn']) this.panelAssistantBtnColor = map['btn'];
    if (map['text']) this.panelAssistantTextColor = map['text'];
  }

  saveAssistantConfig() {
    this.auth.updateMe({
      chatbot_bg_color: this.chatbotBgColor,
      chatbot_btn_color: this.chatbotBtnColor,
      chatbot_text_color: this.chatbotTextColor,
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

  private applyGoogleMapsEmbed(address: string) {
    const googleUrl = googleEmbedFromAddress(address);
    this.gestorMapEmbedUrl = googleUrl;
    this.mapPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(googleUrl));
    this.mapFoundLabel.set(address);
    if (!this.gestorAddress) {
      this.gestorAddress = address;
    }
  }

  searchAddress() {
    const q = this.mapSearchQuery.trim();
    if (!q) return;
    this.mapSearching = true;
    this.mapSearchError = '';
    this.mapFoundLabel.set('');
    const simplified = q
      .replace(/C\.?P\.?\s*\d{5}/gi, '')
      .split(',').slice(0, 4).join(',').trim();
    const query = encodeURIComponent(simplified || q);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1&accept-language=es`;
    this.http.get<{ lat: string; lon: string; display_name: string }[]>(url).subscribe({
      next: (results) => {
        this.mapSearching = false;
        if (results?.length) {
          const r = results[0];
          const lat = parseFloat(r.lat);
          const lng = parseFloat(r.lon);
          const googleUrl = googleEmbedFromCoords(lat, lng);
          this.gestorMapEmbedUrl = googleUrl;
          this.mapPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(googleUrl));
          this.mapFoundLabel.set(r.display_name);
          if (!this.gestorAddress) {
            this.gestorAddress = r.display_name.split(',').slice(0, 3).join(',').trim();
          }
        } else {
          this.applyGoogleMapsEmbed(q);
        }
      },
      error: () => {
        this.mapSearching = false;
        this.applyGoogleMapsEmbed(q);
      },
    });
  }

  onGalleryImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []) as File[];
    input.value = '';
    if (!files.length) return;
    const room = this.gestorGalleryMax - this.gestorGalleryImages.length;
    if (room <= 0) {
      this.toast.warning(`Máximo ${this.gestorGalleryMax} imágenes en la galería.`);
      return;
    }
    const batch = files.slice(0, room);
    if (batch.length < files.length) {
      this.toast.warning(`Solo se procesarán ${batch.length} foto(s); límite ${this.gestorGalleryMax}.`);
    }
    this.galleryCropQueue.set(batch);
    this.galleryCropCurrentFile.set(batch[0]);
  }

  onGalleryCropConfirmed(result: CropResult) {
    const queue = this.galleryCropQueue();
    const originalName = queue[0]?.name ?? 'gallery.jpg';
    this.galleryCropCurrentFile.set(null);
    const file = new File([result.blob], originalName, { type: 'image/jpeg' });
    this.isUploadingGallery = true;
    this.uploadService.uploadFile(file).subscribe({
      next: (res: { url: string }) => {
        this.gestorGalleryImages = [...this.gestorGalleryImages, res.url];
        this.isUploadingGallery = false;
        const remaining = queue.slice(1);
        this.galleryCropQueue.set(remaining);
        if (remaining.length > 0) {
          this.galleryCropCurrentFile.set(remaining[0]);
        } else {
          this.toast.success('Imágenes listas. Recuerda guardar tu perfil.', 'Galería');
        }
      },
      error: () => {
        this.isUploadingGallery = false;
        this.toast.error('No se pudo subir la imagen');
        const remaining = queue.slice(1);
        this.galleryCropQueue.set(remaining);
        if (remaining.length > 0) this.galleryCropCurrentFile.set(remaining[0]);
      },
    });
  }

  onGalleryCropCancelled() {
    const queue = this.galleryCropQueue();
    const remaining = queue.slice(1);
    this.galleryCropCurrentFile.set(null);
    this.galleryCropQueue.set(remaining);
    if (remaining.length > 0) this.galleryCropCurrentFile.set(remaining[0]);
  }

  removeGalleryImage(index: number) {
    this.gestorGalleryImages = this.gestorGalleryImages.filter((_, i) => i !== index);
  }

  onGalleryDragStart(e: DragEvent, idx: number) {
    this.galleryDragIdx = idx;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(idx));
  }

  onGalleryDragEnter(e: DragEvent, idx: number) {
    e.preventDefault();
    this.galleryDragOverIdx = idx;
  }

  onGalleryDragLeave() {
    this.galleryDragOverIdx = -1;
  }

  onGalleryDropItem(e: DragEvent, toIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    this.moveGalleryImage(this.galleryDragIdx, toIdx);
    this.galleryDragIdx = -1;
    this.galleryDragOverIdx = -1;
  }

  onGalleryDrop(e: DragEvent) {
    e.preventDefault();
    if (this.galleryDragIdx >= 0) {
      this.galleryDragIdx = -1;
      this.galleryDragOverIdx = -1;
    }
  }

  private moveGalleryImage(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const imgs = [...this.gestorGalleryImages];
    const [item] = imgs.splice(from, 1);
    imgs.splice(to, 0, item);
    this.gestorGalleryImages = imgs;
  }

  savePageBuilderConfig(config: unknown) {
    this.auth.updateMe({ page_builder_config: config }).subscribe(() => {
      this.message.set('Diseño de página guardado exitosamente');
      setTimeout(() => this.message.set(''), 3000);
    });
  }

  addAiConfig() {
    this.aiConfigs.push({ provider: '', key: '' });
  }

  removeAiConfig(index: number) {
    this.aiConfigs.splice(index, 1);
    if (this.aiConfigs.length === 0) {
      this.addAiConfig();
    }
  }

  addService() {
    if (!this.newService.name || !this.newService.timeEstimate) return;
    const docs = this.newService.requiredDocumentsStr.split(',').map(s => s.trim()).filter(Boolean);
    const includes = this.newService.includesStr.split(',').map(s => s.trim()).filter(Boolean);
    const bonus = this.newService.bonusStr.split(',').map(s => s.trim()).filter(Boolean);
    const payload: any = {
      name: this.newService.name,
      timeEstimate: this.newService.timeEstimate,
      price: this.newService.price,
    };
    if (docs.length > 0) payload.required_documents = docs;
    if (includes.length > 0) payload.includes = includes;
    if (bonus.length > 0) payload.bonus = bonus;
    
    this.gestoresService.addService(payload).subscribe({
      next: () => {
        this.newService = { name: '', timeEstimate: '', price: null, requiredDocumentsStr: '', includesStr: '', bonusStr: '' };
        this.loadProfile();
        this.message.set('Servicio agregado');
      },
    });
  }

  onServiceDragStart(event: DragEvent, idx: number) {
    this.serviceDragIdx = idx;
    event.dataTransfer?.setData('text/plain', String(idx));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onServiceDragEnter(event: DragEvent, idx: number) {
    event.preventDefault();
    this.serviceDragOverIdx = idx;
  }

  onServiceDragLeave() {
    this.serviceDragOverIdx = -1;
  }

  onServiceDrop(event: DragEvent) {
    event.preventDefault();
    this.resetServiceDragState();
  }

  onServiceDropItem(event: DragEvent, toIdx: number) {
    event.preventDefault();
    event.stopPropagation();
    if (this.serviceDragIdx < 0 || this.serviceDragIdx === toIdx) {
      this.resetServiceDragState();
      return;
    }
    this.moveServiceInList(this.serviceDragIdx, toIdx);
    this.resetServiceDragState();
  }

  private resetServiceDragState() {
    this.serviceDragIdx = -1;
    this.serviceDragOverIdx = -1;
  }

  private moveServiceInList(fromIdx: number, toIdx: number) {
    const profile = this.profile();
    if (!profile?.services?.length) return;
    const services = [...profile.services];
    const [moved] = services.splice(fromIdx, 1);
    services.splice(toIdx, 0, moved);
    this.profile.set({ ...profile, services });
    this.persistServiceOrder(services);
  }

  private persistServiceOrder(services: { id: string }[]) {
    if (this.serviceOrderSaving) return;
    this.serviceOrderSaving = true;
    const order = services.map(s => s.id);
    this.gestoresService.reorderServices(order).subscribe({
      next: (res) => {
        const profile = this.profile();
        if (profile) this.profile.set({ ...profile, services: res.services });
        this.serviceOrderSaving = false;
      },
      error: (err) => {
        this.serviceOrderSaving = false;
        this.toast.error(err.error?.error || 'No se pudo guardar el orden.');
        this.loadProfile();
      },
    });
  }

  readonly hasServicePrice = hasServicePrice;
  readonly serviceRequirements = serviceRequirements;

  deleteService(id: string) {
    if (!confirm('¿Eliminar este servicio?')) return;
    this.gestoresService.deleteService(id).subscribe(() => this.loadProfile());
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

  stripEmojis(text: string): string {
    return (text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  initials(name?: string) {
    return (name || 'GL').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // --- AUTOMATIONS ---
  loadAutomations() {
    this.http.get<any[]>(`${environment.apiUrl}/crm/automations`).subscribe(data => this.automations.set(data));
  }

  addAutomation() {
    if (!this.newAutomation.name || !this.newAutomation.trigger_stage || !this.newAutomation.action_content) {
      alert('Por favor completa todos los campos de la regla.');
      return;
    }
    this.http.post(`${environment.apiUrl}/crm/automations`, this.newAutomation).subscribe(() => {
      this.message.set('Automatización creada exitosamente');
      this.newAutomation = { name: '', trigger_event: 'stage_change', trigger_stage: '', trigger_delay_days: 3, action_type: 'send_email', action_content: '' };
      this.loadAutomations();
      setTimeout(() => this.message.set(''), 3000);
    });
  }

  deleteAutomation(id: string) {
    if (!confirm('¿Eliminar esta automatización?')) return;
    this.http.delete(`${environment.apiUrl}/crm/automations/${id}`).subscribe(() => this.loadAutomations());
  }

  insertAutomationVariable(key: string, textarea: HTMLTextAreaElement) {
    const token = `{{${key}}}`;
    const current = this.newAutomation.action_content || '';
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    this.newAutomation.action_content = current.slice(0, start) + token + current.slice(end);
    setTimeout(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  automationStageLabel(stageId: string): string {
    const fromStages = this.crmStages.find(s => s.id === stageId)?.label;
    if (fromStages) return fromStages;
    const fromDashboard = this.crmDashboard()?.stageLabels?.[stageId];
    if (fromDashboard) return fromDashboard;
    return stageId;
  }

  automationPreview(): string {
    const raw = this.newAutomation.action_content || '';
    if (!raw.trim()) return 'Escribe un mensaje y verás aquí cómo lo recibirá tu cliente.';
    return AUTOMATION_VARIABLES.reduce(
      (text, v) => text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.example),
      raw,
    );
  }
}
