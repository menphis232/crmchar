import { Component, OnInit, OnDestroy, NgZone, signal, computed, effect, inject, DestroyRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { CrmService, GestoresService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { AiTraining, CrmDashboard, CrmDeal, CrmTodayInbox, CrmVerificationAlert, Gestor, GestorReview, GestorService, MessageTemplate, PageBuilderConfig, SiteSettings } from '../../models';
import { isDealPaymentLocked, isPaidDealBackwardMoveBlocked, isCompletedStage, isShippedStage, isLostStage, CrmStageConfig } from '../../shared/payment-stage.utils';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealsBoardComponent } from './crm-deals-board.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { CrmClientsDirectoryComponent } from './crm-clients-directory.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { ThemeSwitchComponent } from '../../shared/theme-switch.component';
import { CrmTeamComponent } from './crm-team.component';
import { CrmPeritosComponent } from './crm-peritos.component';
import { FinancesComponent } from './finances.component';
import { PageBuilderComponent } from './page-builder.component';
import { ToastService } from '../../core/toast.service';
import { SocketService } from '../../core/socket.service';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { ImageCropperModalComponent, CropResult } from '../../shared/image-cropper-modal.component';
import { hasServicePrice, serviceRequirements, serviceIncludes, serviceBonus } from '../../shared/gestor-service.utils';
import {
  QuoteCheckItem,
  checklistFromTexts,
  nextChecklistId,
  resetChecklistSeq,
} from '../../shared/quote-checklist.utils';
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
  LucideUserCheck,
  LucideWrench,
  LucideX,
  LucideGripVertical,
  LucideChevronUp,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideImage,
  LucideStar,
  LucideCar,
  LucideZap,
  LucideWallet,
  LucideGraduationCap,
  LucideActivity,
  LucideRefreshCw,
  LucideEye,
  LucideEyeOff,
} from '@lucide/angular';
import { PanelUserMenuComponent } from './panel-user-menu.component';
import { PanelSubscriptionLockComponent } from './panel-subscription-lock.component';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL, GESTOR_SHARE_TAGLINE } from '../../shared/brand.constants';
import { getGestorOgImageUrl, getGestorPanelPreviewImageUrl, getGestorShareSubtitle } from '../../shared/gestor-share.util';
import { MEXICO_STATES } from '../../shared/mexico-states';
import type { ClientPromoBanner } from '../../models';
import {
  CLIENT_PROMO_BANNER_DESKTOP_ASPECT,
  CLIENT_PROMO_BANNER_DESKTOP_SIZE_LABEL,
  CLIENT_PROMO_BANNER_MOBILE_ASPECT,
  CLIENT_PROMO_BANNER_MOBILE_SIZE_LABEL,
  GESTOR_BANNER_ASPECT,
  GESTOR_BANNER_SIZE_LABEL,
  GESTOR_GALLERY_ASPECT,
  GESTOR_GALLERY_MAX,
  GESTOR_GALLERY_OUTPUT,
  GESTOR_GALLERY_SIZE_LABEL,
  GESTOR_LOGO_ASPECT,
  GESTOR_LOGO_SIZE_LABEL,
  GESTOR_SERVICE_IMAGE_ASPECT,
  GESTOR_SERVICE_IMAGE_OUTPUT,
  GESTOR_SERVICE_IMAGE_SIZE_LABEL,
} from '../../shared/gestor-media.constants';

type GestorTab = 'dashboard' | 'pipeline' | 'clientes' | 'actividad' | 'servicios' | 'perfil' | 'asistente' | 'entrenar_ia' | 'plantillas' | 'pdf_designer' | 'team' | 'peritos' | 'finanzas' | 'page_builder' | 'automatizaciones';

type ClientActivityItem = {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactId: string;
  contactName?: string;
  lastSeenAt: string | null;
  hasLoggedIn: boolean;
  termsAccepted: boolean;
  online: boolean;
  accountCreatedAt?: string | null;
};

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

function emptyAiTraining(): AiTraining {
  return { about: '', coverage: '', hours: '', payments: '', rules: '', faqs: [] };
}

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
  host: {
    class: 'panel-datta',
    '[class.sidebar-collapsed]': 'sidebarCollapsed()',
  },
  standalone: true,
  imports: [
    RouterLink, FormsModule, DecimalPipe, DatePipe, CrmKanbanComponent, CrmDealPanelComponent,
    CrmTodayInboxComponent, CrmContactPanelComponent, CrmClientsDirectoryComponent, CrmDealsBoardComponent, PdfDesignerComponent, NotificationBellComponent, ThemeSwitchComponent, CrmTeamComponent, CrmPeritosComponent, FinancesComponent, PageBuilderComponent, PanelColorPaletteComponent, AiAssistantComponent, PanelUserMenuComponent, PanelSubscriptionLockComponent, ImageCropperModalComponent,
    LucideSettings, LucideLayoutDashboard, LucideFunnel, LucideWrench, LucideLandmark, LucideBot, LucideFileText, LucidePalette, LucideUsers, LucideUserCheck, LucideGlobe, LucideSparkles, LucideLightbulb, LucideLink, LucideCopy, LucideClock, LucideSquarePen, LucideCreditCard, LucideMapPin, LucidePlus, LucideCamera, LucideSearch, LucideTriangleAlert, LucideX, LucideGripVertical, LucideChevronUp, LucideChevronDown, LucideChevronLeft, LucideChevronRight, LucideImage, LucideStar, LucideCar, LucideZap, LucideWallet, LucideGraduationCap, LucideActivity, LucideRefreshCw, LucideEye, LucideEyeOff,
  ],
  templateUrl: './panel-gestor.component.html',
  styleUrls: ['./panel-dashboard.css', './panel-dark-theme.css', './panel-gestor.component.css', './panel-datta.css'],
})
export class PanelGestorComponent implements OnInit, OnDestroy {
  readonly showPageBuilder = SHOW_PAGE_BUILDER;
  readonly gestorLogoAspect = GESTOR_LOGO_ASPECT;
  readonly gestorLogoSizeLabel = GESTOR_LOGO_SIZE_LABEL;
  readonly gestorBannerAspect = GESTOR_BANNER_ASPECT;
  readonly gestorBannerSizeLabel = GESTOR_BANNER_SIZE_LABEL;
  readonly clientPromoDesktopAspect = CLIENT_PROMO_BANNER_DESKTOP_ASPECT;
  readonly clientPromoDesktopSizeLabel = CLIENT_PROMO_BANNER_DESKTOP_SIZE_LABEL;
  readonly clientPromoMobileAspect = CLIENT_PROMO_BANNER_MOBILE_ASPECT;
  readonly clientPromoMobileSizeLabel = CLIENT_PROMO_BANNER_MOBILE_SIZE_LABEL;
  readonly gestorGalleryAspect = GESTOR_GALLERY_ASPECT;
  readonly gestorGallerySizeLabel = GESTOR_GALLERY_SIZE_LABEL;
  readonly gestorGalleryMax = GESTOR_GALLERY_MAX;
  readonly gestorGalleryOutput = GESTOR_GALLERY_OUTPUT;
  readonly serviceImageAspect = GESTOR_SERVICE_IMAGE_ASPECT;
  readonly serviceImageOutput = GESTOR_SERVICE_IMAGE_OUTPUT;
  readonly serviceImageSizeLabel = GESTOR_SERVICE_IMAGE_SIZE_LABEL;
  serviceImageCropFile = signal<File | null>(null);
  isUploadingServiceImage = signal(false);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private socketService = inject(SocketService);
  private zone = inject(NgZone);
  private onCrmNotification = (payload: unknown) => {
    const notif = payload as { type?: string; ref_id?: string; title?: string; body?: string };
    this.zone.run(() => {
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
      if (notif.type === 'perito_update') {
        this.crmService.getDeals({
          q: this.searchQuery || undefined,
          stage: this.filterStage || undefined,
        }).subscribe(d => this.deals.set(d));
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
    });
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
  globalSearch = '';
  clientsSeedQuery = signal('');
  globalSearchOpen = signal(false);
  globalSearchLoading = signal(false);
  globalSearchContacts = signal<{ id: string; name: string; email?: string; phone?: string }[]>([]);
  globalSearchDeals = signal<{ id: string; title: string; contactName?: string; stage?: string }[]>([]);
  private globalSearchTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('globalSearchInput') globalSearchInput?: ElementRef<HTMLInputElement>;
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
  aiTraining: AiTraining = emptyAiTraining();
  savingAiTraining = signal(false);
  aiTestInput = '';
  aiTestHistory = signal<{ role: 'user' | 'model'; content: string }[]>([]);
  aiTesting = signal(false);
  chatAiAutoReplyEnabled = false;
  chatAiInactivityMinutes = 30;
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
  insuranceAlerts = signal<CrmVerificationAlert[]>([]);
  readonly activityPageSize = 10;
  clientActivity = signal<ClientActivityItem[]>([]);
  clientActivityTotals = signal<{ withAccess: number; online: number; everLoggedIn: number }>({
    withAccess: 0,
    online: 0,
    everLoggedIn: 0,
  });
  clientActivityLoading = signal(false);
  clientActivityError = signal('');
  activityPage = signal(1);
  activityTotalPages = computed(() => {
    const total = this.clientActivity().length;
    return Math.max(1, Math.ceil(total / this.activityPageSize));
  });
  pagedClientActivity = computed(() => {
    const page = Math.min(this.activityPage(), this.activityTotalPages());
    const start = (page - 1) * this.activityPageSize;
    return this.clientActivity().slice(start, start + this.activityPageSize);
  });
  activityRangeLabel = computed(() => {
    const total = this.clientActivity().length;
    if (!total) return '0 de 0';
    const page = Math.min(this.activityPage(), this.activityTotalPages());
    const start = (page - 1) * this.activityPageSize + 1;
    const end = Math.min(page * this.activityPageSize, total);
    return `${start}–${end} de ${total}`;
  });
  isAiLoading = signal(false);
  message = signal('');
  editingServiceId: string | null = null;
  serviceDetailModal = signal<GestorService | null>(null);
  serviceForm = { name: '', timeEstimate: '', price: null as number | null, imageUrl: '', isPublic: true };
  serviceDocs: QuoteCheckItem[] = [];
  serviceIncludesList: QuoteCheckItem[] = [];
  serviceBonusList: QuoteCheckItem[] = [];
  newTemplate = { name: '', content: '' };
  automations = signal<any[]>([]);
  newAutomation = { name: '', trigger_event: 'stage_change', trigger_stage: '', trigger_delay_days: 3, action_type: 'send_email', action_content: '' };
  readonly automationVariables = AUTOMATION_VARIABLES;
  isMobileMenuOpen = signal(false);
  sidebarCollapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('crm_sidebar_collapsed') === '1'
  );

  toggleSidebar() {
    // ≤991px: drawer móvil (misma hamburguesa izquierda)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991px)').matches) {
      this.isMobileMenuOpen.update((v) => !v);
      return;
    }
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    try {
      localStorage.setItem('crm_sidebar_collapsed', next ? '1' : '0');
    } catch { /* ignore */ }
  }

  crmStages: CrmStageConfig[] = [];

  showManualLeadForm = signal(false);
  savingManualLead = signal(false);
  clientAccessNotice = signal<{
    created: boolean;
    login: string;
    password?: string | null;
    emailed?: boolean;
    whatsappUrl?: string | null;
    contactId?: string | null;
  } | null>(null);
  regeneratingClientAccess = signal(false);
  manualLeadServices = signal<{ name: string; price: number | null; isPublic?: boolean }[]>([]);
  manualLeadError = signal<string | null>(null);
  manualLead = {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceName: '',
    location: '',
    title: '',
    message: '',
    estimatedValue: '' as string | number,
    quantity: 1 as string | number,
    stage: 'nuevo',
    vehicleId: '' as string,
    contactId: '' as string,
  };
  manualLeadVehicles = signal<Array<{
    id: string;
    plate: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
  }>>([]);

  get manualLeadQtyLabel(): string {
    const qty = Math.max(1, Math.min(50, Math.floor(Number(this.manualLead.quantity) || 1)));
    return qty > 1 ? `Crear ${qty} trámites` : 'Crear trámite';
  }

  get manualLeadTotalLabel(): string {
    const qty = Math.max(1, Math.min(50, Math.floor(Number(this.manualLead.quantity) || 1)));
    const unit = Number(this.manualLead.estimatedValue);
    if (!Number.isFinite(unit) || unit <= 0 || this.manualLead.estimatedValue === '') return '';
    const total = unit * qty;
    return qty > 1
      ? `$${unit.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} × ${qty} = $${total.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MXN`
      : `$${unit.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MXN`;
  }

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

    this.route.queryParams.pipe(
      map(params => String(params['deal'] || '')),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dealId => {
      if (!dealId) return;
      this.loadDeals();
      if (!this.templates().length) {
        this.crmService.getTemplates().subscribe(t => this.templates.set(t));
      }
      this.openDeal(dealId);
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
    // El panel del trámite/contacto es overlay: al salir de esa vista hay que cerrarlo.
    this.selectedDealId.set(null);
    this.selectedContactId.set(null);
    if (t === 'dashboard') {
      this.loadCrmSummary();
      this.loadVerificationAlerts();
    }
    if (t === 'pipeline') this.loadCrm();
    if (t === 'clientes') this.loadVerificationAlerts();
    if (t === 'actividad') this.loadClientActivity();
    if (t === 'plantillas') this.loadTemplates();
    if (t === 'automatizaciones') {
      this.syncCrmStagesFromDashboard();
      this.loadAutomations();
    }
  }

  loadClientActivity() {
    this.clientActivityLoading.set(true);
    this.clientActivityError.set('');
    this.crmService.getClientActivity().subscribe({
      next: (res) => {
        this.clientActivity.set(res.items || []);
        this.clientActivityTotals.set(res.totals || { withAccess: 0, online: 0, everLoggedIn: 0 });
        this.activityPage.set(1);
        this.clientActivityLoading.set(false);
      },
      error: (e) => {
        this.clientActivityLoading.set(false);
        this.clientActivityError.set(e.error?.error || 'No se pudo cargar la actividad');
      },
    });
  }

  setActivityPage(page: number) {
    const max = this.activityTotalPages();
    this.activityPage.set(Math.min(max, Math.max(1, page)));
  }

  formatLastSeen(value: string | null | undefined): string {
    if (!value) return 'Nunca';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Nunca';
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  activityContactHint(row: ClientActivityItem): string {
    const phone = String(row.phone || '').trim();
    if (phone) return phone;
    const email = String(row.email || '').trim();
    if (!email) return '—';
    // Oculta correos internos de acceso al panel.
    if (email.endsWith('@clientes.tramitesmx.local') || email.startsWith('cliente.')) {
      return '—';
    }
    return email;
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
    this.crmService.getInsuranceAlerts().subscribe({
      next: (alerts) => this.insuranceAlerts.set(alerts),
      error: () => this.insuranceAlerts.set([]),
    });
  }

  openClientContact(contactId: string) {
    this.selectedDealId.set(null);
    this.selectedContactId.set(contactId);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  impersonatingContactId = signal<string | null>(null);

  enterClientPanel(contactId: string) {
    if (!contactId || !this.canManageClientPromoBanner() || this.impersonatingContactId()) return;
    this.impersonatingContactId.set(contactId);
    this.crmService.impersonateContact(contactId).subscribe({
      next: (res) => {
        this.impersonatingContactId.set(null);
        this.auth.startImpersonation(res.token, res.user);
      },
      error: (err) => {
        this.impersonatingContactId.set(null);
        this.toast.error(err?.error?.error || 'No se pudo abrir el panel del cliente');
      },
    });
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
        this.gestorPublicRating = data.rating ?? '';
        this.gestorPublicReviewCount = data.reviewCount ?? '';
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

  syncGoogleReviews() {
    if (!this.googlePlaceId.trim()) {
      this.toast.error('Guarda primero el Place ID de Google.');
      return;
    }
    this.syncingGoogleReviews.set(true);
    // Persistir Place ID y luego forzar sync
    this.gestoresService.updateProfile({ googlePlaceId: this.googlePlaceId.trim() }).subscribe({
      next: (p) => {
        this.googleMapsUrl = p.googleMapsUrl || null;
        this.gestoresService.syncGoogleReviews().subscribe({
          next: (res) => {
            this.syncingGoogleReviews.set(false);
            if (res.googleRating != null) {
              this.gestorReviewsRating.set(res.googleRating);
              this.gestorPublicRating = res.googleRating;
            }
            if (res.googleReviewCount != null) {
              this.gestorReviewsCount.set(res.googleReviewCount);
              this.gestorPublicReviewCount = res.googleReviewCount;
            }
            this.googleMapsUrl = res.googleMapsUrl || this.googleMapsUrl;
            this.toast.success(`Google: ${res.googleReviewCount ?? 0} reseñas sincronizadas.`);
            this.loadGestorReviews();
          },
          error: (err) => {
            this.syncingGoogleReviews.set(false);
            this.toast.error(err.error?.error || 'No se pudo sincronizar con Google.');
          },
        });
      },
      error: () => {
        this.syncingGoogleReviews.set(false);
        this.toast.error('No se pudo guardar el Place ID.');
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

  deleteAllGestorReviews() {
    if (!confirm('¿Quitar TODAS las reseñas manuales de la ficha? El promedio/cantidad de Google (bloque ESTRELLAS) se mantiene.')) return;
    this.gestoresService.deleteAllReviews().subscribe({
      next: (res) => {
        this.gestorReviews.set([]);
        this.gestorReviewsRating.set(res.rating);
        this.gestorReviewsCount.set(res.reviewCount);
        this.resetGestorReviewForm();
        this.toast.success('Reseñas manuales eliminadas.');
      },
      error: (err) => this.toast.error(err.error?.error || 'No se pudieron eliminar.'),
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
      this.googlePlaceId = p.googlePlaceId || '';
      this.googleMapsUrl = p.googleMapsUrl || null;
      this.googleReviewsEmbed = p.googleReviewsEmbed || '';
      this.gestorPublicRating = p.googleRating ?? p.rating ?? '';
      this.gestorPublicReviewCount = p.googleReviewCount ?? p.reviewCount ?? '';
      this.gestorReviewsRating.set(Number(p.googleRating ?? p.rating) || 0);
      this.gestorReviewsCount.set(Number(p.googleReviewCount ?? p.reviewCount) || 0);
      this.canManageClientPromoBanner.set(!!p.canManageClientPromoBanner);
      if (p.canManageClientPromoBanner) this.loadClientPromoBanner();
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
      const training = res.user.ai_training;
      this.aiTraining = {
        ...emptyAiTraining(),
        ...(training || {}),
        faqs: (training?.faqs || []).map(f => ({ ...f })),
      };
      this.chatAiAutoReplyEnabled = res.user.chat_ai_auto_reply_enabled === 1 || res.user.chat_ai_auto_reply_enabled === true;
      this.chatAiInactivityMinutes = Number(res.user.chat_ai_inactivity_minutes) || 30;
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
    // Solo pedir motivo si la etapa es pérdida real (no id `perdido` reutilizado mid-embudo)
    if (isLostStage(stage, this.crmStages)) {
      this.deals.update(list => list.map(d => (d.id === deal.id ? { ...d, stage } : d)));
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
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openManualLeadForm() {
    this.manualLeadError.set(null);
    this.manualLead = {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      serviceName: '',
      location: '',
      title: '',
      message: '',
      estimatedValue: '',
      quantity: 1,
      stage: 'nuevo',
      vehicleId: '',
      contactId: '',
    };
    this.manualLeadVehicles.set([]);
    this.prepareManualLeadServices();
    this.showManualLeadForm.set(true);
  }

  openManualLeadFromContact(contact: {
    name: string;
    email?: string;
    phone?: string;
    contactId?: string;
    vehicles?: Array<{ id: string; plate: string; make?: string | null; model?: string | null; year?: number | null }>;
  }) {
    this.selectedContactId.set(null);
    this.manualLeadError.set(null);
    const vehicles = contact.vehicles || [];
    this.manualLeadVehicles.set(vehicles);
    this.manualLead = {
      clientName: contact.name || '',
      clientEmail: contact.email || '',
      clientPhone: contact.phone || '',
      serviceName: '',
      location: '',
      title: '',
      message: '',
      estimatedValue: '',
      quantity: 1,
      stage: 'nuevo',
      vehicleId: vehicles.length === 1 ? vehicles[0].id : '',
      contactId: contact.contactId || '',
    };
    this.prepareManualLeadServices();
    this.showManualLeadForm.set(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  manualLeadVehicleLabel(v: {
    plate: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
  }): string {
    const mmy = [v.make, v.model, v.year].filter((x) => x != null && x !== '').join(' ');
    return mmy ? `${v.plate} · ${mmy}` : v.plate;
  }

  private prepareManualLeadServices() {
    const mapSvc = (s: { name: string; price?: number | null; isPublic?: boolean }) => ({
      name: s.name,
      price: s.price ?? null,
      isPublic: s.isPublic !== false,
    });
    const services = this.profile()?.services?.map(mapSvc) ?? [];
    if (services.length) {
      this.manualLeadServices.set(services);
    } else {
      this.gestoresService.getMyProfile().subscribe(p => {
        this.profile.set(p);
        this.manualLeadServices.set(p.services?.map(mapSvc) ?? []);
      });
    }
  }

  closeManualLeadForm() {
    this.showManualLeadForm.set(false);
    this.manualLeadError.set(null);
  }

  copyClientAccess() {
    const access = this.clientAccessNotice();
    if (!access) return;
    const lines = [`Usuario: ${access.login}`];
    if (access.password) lines.push(`Contraseña: ${access.password}`);
    lines.push('Portal: https://central.tramitesvehicularesdemexico.com/login/cliente');
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Clave copiada'),
      () => this.toast.warning('No se pudo copiar. Anótala de la ventana.'),
    );
  }

  regenerateClientAccess() {
    const access = this.clientAccessNotice();
    const contactId = access?.contactId;
    if (!contactId) return;
    this.regeneratingClientAccess.set(true);
    this.crmService.createContactClientAccess(contactId, true).subscribe({
      next: (next) => {
        this.regeneratingClientAccess.set(false);
        this.clientAccessNotice.set({ ...next, contactId });
        this.toast.success('Clave nueva lista para enviar');
      },
      error: (e) => {
        this.regeneratingClientAccess.set(false);
        this.toast.error(e.error?.error || 'No se pudo generar una clave nueva');
      },
    });
  }

  onManualLeadServiceChange() {
    const service = this.manualLeadServices().find(s => s.name === this.manualLead.serviceName);
    if (!service) return;
    this.manualLead.title = service.name;
    if (service.price) this.manualLead.estimatedValue = service.price;
  }

  saveManualLead() {
    this.manualLeadError.set(null);
    if (!this.manualLead.clientName.trim()) {
      const msg = 'El nombre del cliente es obligatorio';
      this.manualLeadError.set(msg);
      this.toast.warning(msg);
      return;
    }
    const qty = Math.max(1, Math.min(50, Math.floor(Number(this.manualLead.quantity) || 1)));
    this.manualLead.quantity = qty;

    const unitRaw = this.manualLead.estimatedValue === '' ? NaN : Number(this.manualLead.estimatedValue);
    const estimatedValue = Number.isFinite(unitRaw) && unitRaw >= 0 ? unitRaw : undefined;
    if (qty > 1 && (estimatedValue === undefined || estimatedValue <= 0)) {
      const msg = 'Indica el precio unitario: se usará en cada trámite para poder registrar el pago.';
      this.manualLeadError.set(msg);
      this.toast.warning(msg);
      return;
    }
    this.savingManualLead.set(true);
    const baseTitle = this.manualLead.title.trim() || this.manualLead.serviceName.trim() || 'Trámite manual';
    const payloadBase = {
      clientName: this.manualLead.clientName.trim(),
      clientEmail: this.manualLead.clientEmail.trim() || undefined,
      clientPhone: this.manualLead.clientPhone.trim() || undefined,
      serviceName: this.manualLead.serviceName || undefined,
      location: this.manualLead.location.trim() || undefined,
      message: this.manualLead.message.trim() || undefined,
      estimatedValue,
      stage: this.manualLead.stage || 'nuevo',
      vehicleId: this.manualLead.vehicleId || undefined,
      contactId: this.manualLead.contactId || undefined,
    };

    const createOne = (index: number) => {
      const title = qty > 1 ? `${baseTitle} (${index}/${qty})` : baseTitle;
      // Misma copia del payload por trámite (precio unitario independiente en cada uno).
      return this.crmService.createDeal({ ...payloadBase, estimatedValue, title });
    };

    const run = async () => {
      let firstAccess: {
        created: boolean;
        login: string;
        password?: string | null;
        emailed?: boolean;
        whatsappUrl?: string | null;
      } | null = null;
      let contactId: string | null = this.manualLead.contactId || null;
      let lastDealId: string | null = null;

      for (let i = 1; i <= qty; i++) {
        const deal = await new Promise<any>((resolve, reject) => {
          createOne(i).subscribe({ next: resolve, error: reject });
        });
        lastDealId = deal.id;
        contactId = deal.contactId || deal.contact?.id || contactId;
        const access = deal.clientAccess;
        if (access?.login && !firstAccess) firstAccess = access;
      }

      this.savingManualLead.set(false);
      this.manualLeadError.set(null);
      this.showManualLeadForm.set(false);
      if (firstAccess?.login) {
        this.clientAccessNotice.set({ ...firstAccess, contactId });
      }
      if (qty > 1) {
        this.toast.success(`${qty} trámites creados para ${payloadBase.clientName}.`);
      } else if (firstAccess?.password) {
        this.toast.success('Trámite creado. Ya tienes la clave del cliente.');
      } else if (firstAccess?.login) {
        this.toast.success('Trámite creado. Este cliente ya tenía usuario.');
      } else if (!payloadBase.clientPhone && !payloadBase.clientEmail) {
        this.toast.success('Trámite registrado. Sin teléfono ni correo no se creó usuario.');
      } else {
        this.toast.success('Trámite registrado');
      }
      this.loadCrm();
      if (lastDealId) this.openDeal(lastDealId);
    };

    run().catch((e) => {
      this.savingManualLead.set(false);
      const msg = e?.error?.error || e?.message || 'Error al crear trámite';
      this.manualLeadError.set(msg);
      this.toast.error(msg);
    });
  }

  onDealUpdated() {
    this.loadDeals();
  }

  onDealDelete(deal: CrmDeal) {
    this.crmService.deleteDeal(deal.id).subscribe({
      next: () => {
        if (this.selectedDealId() === deal.id) this.selectedDealId.set(null);
        this.loadDeals();
        this.loadCrmSummary();
        this.toast.success('Eliminado del embudo');
      },
      error: (e) => this.toast.error(e.error?.error || 'No se pudo eliminar'),
    });
  }

  onDealDeleted() {
    this.selectedDealId.set(null);
    this.loadDeals();
    this.loadCrmSummary();
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
  canManageClientPromoBanner = signal(false);
  clientPromoBanners = signal<ClientPromoBanner[]>([]);
  selectedClientPromoBannerId = signal<string | null>(null);
  clientPromoAudienceClientLabels = signal<Record<string, string>>({});
  clientPromoAudienceSearch = '';
  clientPromoAudienceSearchResults = signal<{ id: string; name: string; email: string; phone?: string }[]>([]);
  clientPromoAudienceSearching = false;
  clientPromoTitleSizeOptions: Array<{ value: 'sm' | 'md' | 'lg' | 'xl'; label: string }> = [
    { value: 'sm', label: 'Pequeño' },
    { value: 'md', label: 'Mediano' },
    { value: 'lg', label: 'Grande' },
    { value: 'xl', label: 'Muy grande' },
  ];
  clientPromoCropTarget = signal<'desktop' | 'mobile' | null>(null);
  clientPromoCropFile = signal<File | null>(null);
  isUploadingClientPromoBanner = false;
  isSavingClientPromoBanner = false;
  selectedClientPromoBanner = computed(() => {
    const id = this.selectedClientPromoBannerId();
    return this.clientPromoBanners().find((b) => b.id === id) || null;
  });
  gestorGalleryImages: string[] = [];
  gestorReviews = signal<GestorReview[]>([]);
  gestorReviewsRating = signal(0);
  gestorReviewsCount = signal(0);
  gestorPublicRating: number | '' = '';
  gestorPublicReviewCount: number | '' = '';
  gestorReviewForm = { author: '', rating: 5, comment: '', reviewDate: '' };
  editingReviewId: string | null = null;
  reviewStarSlots = [1, 2, 3, 4, 5];
  googlePlaceId = '';
  googleMapsUrl: string | null = null;
  googleReviewsEmbed = '';
  syncingGoogleReviews = signal(false);
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

  private newClientPromoBanner(partial: Partial<ClientPromoBanner> = {}): ClientPromoBanner {
    const base: ClientPromoBanner = {
      id: crypto.randomUUID(),
      enabled: true,
      imageDesktop: '',
      imageMobile: '',
      link: '',
      title: '',
      subtitle: '',
      titleColor: '#ffffff',
      titleSize: 'md',
      titleAlign: 'center',
      titleVAlign: 'center',
      titlePlacement: 'overlay',
      alt: '',
      sortOrder: this.clientPromoBanners().length,
      audienceMode: 'all',
      audienceUserIds: [],
      audienceStates: [],
      audienceServiceNames: [],
      audiencePurchased: 'any',
      ...partial,
    };
    return {
      ...base,
      title: base.title || '',
      subtitle: base.subtitle || '',
      titleColor: base.titleColor || '#ffffff',
      titleSize: base.titleSize || 'md',
      titleAlign: base.titleAlign || 'center',
      titleVAlign: base.titleVAlign || 'center',
      titlePlacement: base.titlePlacement || 'overlay',
      audienceMode: base.audienceMode || 'all',
      audiencePurchased: base.audiencePurchased || 'any',
      audienceUserIds: Array.isArray(base.audienceUserIds) ? base.audienceUserIds : [],
      audienceStates: Array.isArray(base.audienceStates) ? base.audienceStates : [],
      audienceServiceNames: Array.isArray(base.audienceServiceNames) ? base.audienceServiceNames : [],
    };
  }

  patchSelectedClientPromoBanner(patch: Partial<ClientPromoBanner>) {
    const id = this.selectedClientPromoBannerId();
    if (!id) return;
    this.clientPromoBanners.update((list) =>
      list.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  loadClientPromoBanner() {
    this.gestoresService.getClientPromoBanner().subscribe({
      next: (b) => {
        this.canManageClientPromoBanner.set(!!b.canManage);
        if (!b.canManage) return;
        const banners = (b.banners || [])
          .map((row, i) => this.newClientPromoBanner({
            ...row,
            sortOrder: row.sortOrder ?? i,
            audienceStates: Array.isArray(row.audienceStates) ? row.audienceStates : [],
            audienceServiceNames: Array.isArray(row.audienceServiceNames) ? row.audienceServiceNames : [],
            audienceUserIds: Array.isArray(row.audienceUserIds) ? row.audienceUserIds : [],
          }))
          .sort((a, c) => (a.sortOrder - c.sortOrder) || a.title.localeCompare(c.title));
        this.clientPromoBanners.set(banners.map((row, i) => ({ ...row, sortOrder: i })));
        if (!this.selectedClientPromoBannerId() && banners.length) {
          this.selectedClientPromoBannerId.set(banners[0].id);
        }
        this.hydrateClientPromoAudienceLabels(banners);
      },
      error: () => this.canManageClientPromoBanner.set(false),
    });
  }

  clientPromoServiceOptions(): string[] {
    const fromProfile = (this.profile()?.services || [])
      .map((s) => String(s.name || '').trim())
      .filter(Boolean);
    const fromBanners = this.clientPromoBanners()
      .flatMap((b) => b.audienceServiceNames || []);
    return [...new Set([...fromProfile, ...fromBanners])].sort((a, b) => a.localeCompare(b, 'es'));
  }

  isClientPromoAudienceServiceSelected(name: string): boolean {
    const banner = this.selectedClientPromoBanner();
    return !!banner?.audienceServiceNames?.includes(name);
  }

  toggleClientPromoAudienceService(name: string) {
    const banner = this.selectedClientPromoBanner();
    if (!banner) return;
    const current = Array.isArray(banner.audienceServiceNames) ? banner.audienceServiceNames : [];
    const has = current.includes(name);
    const audienceServiceNames = has
      ? current.filter((s) => s !== name)
      : [...current, name];
    this.patchSelectedClientPromoBanner({
      audienceMode: 'filtered',
      audienceServiceNames,
    });
  }

  private hydrateClientPromoAudienceLabels(banners: ClientPromoBanner[]) {
    const ids = [...new Set(banners.flatMap((b) => b.audienceUserIds || []))];
    if (!ids.length) return;
    this.gestoresService.searchClientPromoAudienceClients('', 40).subscribe({
      next: (res) => {
        const map: Record<string, string> = { ...this.clientPromoAudienceClientLabels() };
        for (const u of res.items || []) {
          map[u.id] = u.name || u.email || u.id;
        }
        this.clientPromoAudienceClientLabels.set(map);
      },
    });
  }

  selectClientPromoBanner(id: string) {
    this.selectedClientPromoBannerId.set(id);
  }

  moveClientPromoBanner(id: string, direction: -1 | 1) {
    const list = [...this.clientPromoBanners()];
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[next];
    list[next] = tmp;
    this.clientPromoBanners.set(list.map((b, i) => ({ ...b, sortOrder: i })));
    this.saveClientPromoBanner();
  }

  addClientPromoBanner() {
    const banner = this.newClientPromoBanner({ title: `Banner ${this.clientPromoBanners().length + 1}` });
    this.clientPromoBanners.update((list) => [...list, banner]);
    this.selectedClientPromoBannerId.set(banner.id);
  }

  removeSelectedClientPromoBanner() {
    const id = this.selectedClientPromoBannerId();
    if (!id) return;
    const next = this.clientPromoBanners().filter((b) => b.id !== id);
    this.clientPromoBanners.set(next.map((b, i) => ({ ...b, sortOrder: i })));
    this.selectedClientPromoBannerId.set(next[0]?.id || null);
    this.saveClientPromoBanner();
  }

  onClientPromoBannerSelected(event: Event, target: 'desktop' | 'mobile') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.selectedClientPromoBanner()) return;
    this.clientPromoCropTarget.set(target);
    this.clientPromoCropFile.set(file);
    input.value = '';
  }

  onClientPromoCropConfirmed(result: { blob: Blob; previewUrl: string }) {
    const target = this.clientPromoCropTarget();
    const selected = this.selectedClientPromoBanner();
    if (!target || !selected) return;
    const fileName = target === 'mobile' ? 'promo-banner-mobile.jpg' : 'promo-banner-desktop.jpg';
    const file = new File([result.blob], fileName, { type: 'image/jpeg' });
    this.clientPromoCropFile.set(null);
    this.clientPromoCropTarget.set(null);
    this.isUploadingClientPromoBanner = true;
    this.uploadService.uploadFile(file).subscribe({
      next: (res) => {
        if (target === 'mobile') {
          this.patchSelectedClientPromoBanner({ imageMobile: res.url });
        } else {
          const patch: Partial<ClientPromoBanner> = { imageDesktop: res.url };
          if (!selected.imageMobile) patch.imageMobile = res.url;
          this.patchSelectedClientPromoBanner(patch);
        }
        this.isUploadingClientPromoBanner = false;
        this.saveClientPromoBanner();
      },
      error: () => {
        this.isUploadingClientPromoBanner = false;
        this.toast.error('No se pudo subir la imagen del banner');
      },
    });
  }

  onClientPromoCropCancelled() {
    this.clientPromoCropFile.set(null);
    this.clientPromoCropTarget.set(null);
  }

  clearClientPromoBannerImage(target: 'desktop' | 'mobile' | 'all' = 'all') {
    if (!this.selectedClientPromoBanner()) return;
    const patch: Partial<ClientPromoBanner> = {};
    if (target === 'desktop' || target === 'all') patch.imageDesktop = '';
    if (target === 'mobile' || target === 'all') patch.imageMobile = '';
    this.patchSelectedClientPromoBanner(patch);
    this.saveClientPromoBanner();
  }

  isClientPromoAudienceStateSelected(state: string): boolean {
    const banner = this.selectedClientPromoBanner();
    return !!banner?.audienceStates?.includes(state);
  }

  toggleClientPromoAudienceState(state: string) {
    const banner = this.selectedClientPromoBanner();
    if (!banner) return;
    const current = Array.isArray(banner.audienceStates) ? banner.audienceStates : [];
    const has = current.includes(state);
    const audienceStates = has
      ? current.filter((s) => s !== state)
      : [...current, state];
    this.patchSelectedClientPromoBanner({
      audienceMode: 'filtered',
      audienceStates,
    });
  }

  searchClientPromoAudienceClients() {
    if (!this.canManageClientPromoBanner()) return;
    this.clientPromoAudienceSearching = true;
    this.gestoresService.searchClientPromoAudienceClients(this.clientPromoAudienceSearch, 20).subscribe({
      next: (res) => {
        this.clientPromoAudienceSearchResults.set(res.items || []);
        this.clientPromoAudienceSearching = false;
        const map = { ...this.clientPromoAudienceClientLabels() };
        for (const u of res.items || []) map[u.id] = u.name || u.email || u.id;
        this.clientPromoAudienceClientLabels.set(map);
      },
      error: () => {
        this.clientPromoAudienceSearching = false;
        this.toast.error('No se pudo buscar clientes');
      },
    });
  }

  addClientPromoAudienceUser(user: { id: string; name: string; email: string }) {
    const banner = this.selectedClientPromoBanner();
    if (!banner || banner.audienceUserIds.includes(user.id)) return;
    this.patchSelectedClientPromoBanner({
      audienceMode: 'filtered',
      audienceUserIds: [...banner.audienceUserIds, user.id],
    });
    this.clientPromoAudienceClientLabels.update((m) => ({
      ...m,
      [user.id]: user.name || user.email || user.id,
    }));
  }

  removeClientPromoAudienceUser(userId: string) {
    const banner = this.selectedClientPromoBanner();
    if (!banner) return;
    this.patchSelectedClientPromoBanner({
      audienceUserIds: banner.audienceUserIds.filter((id) => id !== userId),
    });
  }

  audienceSummary(banner: ClientPromoBanner): string {
    if (banner.audienceMode !== 'filtered') return 'Todos los clientes';
    const parts: string[] = [];
    if (banner.audienceUserIds.length) parts.push(`${banner.audienceUserIds.length} usuario(s)`);
    if (banner.audienceStates.length) parts.push(banner.audienceStates.join(', '));
    if (banner.audienceServiceNames?.length) {
      parts.push(
        banner.audienceServiceNames.length <= 2
          ? banner.audienceServiceNames.join(', ')
          : `${banner.audienceServiceNames.length} servicios`,
      );
    }
    if (banner.audiencePurchased === 'yes') parts.push('con pago');
    if (banner.audiencePurchased === 'no') parts.push('sin pago');
    return parts.length ? parts.join(' · ') : 'Filtro vacío (= todos)';
  }

  saveClientPromoBanner() {
    if (!this.canManageClientPromoBanner()) return;
    this.isSavingClientPromoBanner = true;
    const banners = this.clientPromoBanners().map((b, i) => ({ ...b, sortOrder: i }));
    this.gestoresService.updateClientPromoBanner({ banners }).subscribe({
      next: (res) => {
        this.isSavingClientPromoBanner = false;
        this.clientPromoBanners.set(res.banners || banners);
        this.toast.success('Banners del panel cliente guardados');
      },
      error: (e) => {
        this.isSavingClientPromoBanner = false;
        this.toast.error(e.error?.error || 'No se pudo guardar el banner');
      },
    });
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

    const publicRating = this.gestorPublicRating === '' ? undefined : Number(this.gestorPublicRating);
    const publicReviewCount = this.gestorPublicReviewCount === '' ? undefined : Number(this.gestorPublicReviewCount);

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
      googlePlaceId: this.googlePlaceId.trim() || null,
      googleReviewsEmbed: this.googleReviewsEmbed.trim() || null,
      rating: publicRating != null && !Number.isNaN(publicRating) ? publicRating : undefined,
      reviewCount: publicReviewCount != null && !Number.isNaN(publicReviewCount) ? publicReviewCount : undefined,
    }).subscribe({
      next: p => {
        this.publicSlug = p.slug || '';
        this.googlePlaceId = p.googlePlaceId || this.googlePlaceId;
        this.googleMapsUrl = p.googleMapsUrl || this.googleMapsUrl;
        this.googleReviewsEmbed = p.googleReviewsEmbed ?? this.googleReviewsEmbed;
        this.gestorPublicRating = p.googleRating ?? p.rating ?? this.gestorPublicRating;
        this.gestorPublicReviewCount = p.googleReviewCount ?? p.reviewCount ?? this.gestorPublicReviewCount;
        this.gestorReviewsRating.set(Number(p.googleRating ?? p.rating) || 0);
        this.gestorReviewsCount.set(Number(p.googleReviewCount ?? p.reviewCount) || 0);
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
      chat_ai_auto_reply_enabled: this.chatAiAutoReplyEnabled,
      chat_ai_inactivity_minutes: this.chatAiInactivityMinutes,
    }).subscribe({
      next: () => this.toast.success('Configuración del asistente guardada', 'Asistente IA'),
      error: () => this.toast.error('No se pudo guardar el asistente'),
    });
  }

  get aiTrainingProgress(): { done: number; total: number } {
    const t = this.aiTraining;
    const checks = [t.about, t.coverage, t.hours, t.payments, t.rules].map(v => !!v.trim());
    checks.push(t.faqs.some(f => f.q.trim() && f.a.trim()));
    return { done: checks.filter(Boolean).length, total: checks.length };
  }

  addAiFaq() {
    if (this.aiTraining.faqs.length >= 25) return;
    this.aiTraining.faqs = [...this.aiTraining.faqs, { q: '', a: '' }];
  }

  removeAiFaq(index: number) {
    this.aiTraining.faqs = this.aiTraining.faqs.filter((_, i) => i !== index);
  }

  saveAiTraining() {
    this.savingAiTraining.set(true);
    this.auth.updateMe({ ai_training: this.aiTraining }).subscribe({
      next: () => {
        this.savingAiTraining.set(false);
        this.toast.success('Tu IA ya usa este conocimiento.', 'Entrenamiento guardado');
      },
      error: () => {
        this.savingAiTraining.set(false);
        this.toast.error('No se pudo guardar el entrenamiento. Intenta de nuevo.');
      },
    });
  }

  sendAiTest() {
    const text = this.aiTestInput.trim();
    if (!text || this.aiTesting() || !this.publicSlug) return;
    const history = this.aiTestHistory();
    this.aiTestInput = '';
    this.aiTestHistory.set([...history, { role: 'user', content: text }]);
    this.aiTesting.set(true);
    this.http.post<{ reply: string }>(`${environment.apiUrl}/gestores/${this.publicSlug}/chat`, {
      message: text,
      history,
    }).subscribe({
      next: (res) => {
        this.aiTestHistory.update(h => [...h, { role: 'model', content: res.reply }]);
        this.aiTesting.set(false);
      },
      error: (err) => {
        this.aiTestHistory.update(h => [...h, { role: 'model', content: err.error?.error || 'El asistente no respondió. Revisa que la IA esté configurada.' }]);
        this.aiTesting.set(false);
      },
    });
  }

  resetAiTest() {
    this.aiTestHistory.set([]);
    this.aiTestInput = '';
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

  addServiceChecklistItem(section: 'docs' | 'includes' | 'bonus') {
    const item: QuoteCheckItem = { id: nextChecklistId(section), text: '', checked: true };
    if (section === 'docs') this.serviceDocs = [...this.serviceDocs, item];
    if (section === 'includes') this.serviceIncludesList = [...this.serviceIncludesList, item];
    if (section === 'bonus') this.serviceBonusList = [...this.serviceBonusList, item];
  }

  removeServiceChecklistItem(section: 'docs' | 'includes' | 'bonus', itemId: string) {
    if (section === 'docs') this.serviceDocs = this.serviceDocs.filter(i => i.id !== itemId);
    if (section === 'includes') this.serviceIncludesList = this.serviceIncludesList.filter(i => i.id !== itemId);
    if (section === 'bonus') this.serviceBonusList = this.serviceBonusList.filter(i => i.id !== itemId);
  }

  private checklistTexts(items: QuoteCheckItem[]): string[] {
    return items.map(i => i.text.trim()).filter(Boolean);
  }

  private resetServiceForm() {
    resetChecklistSeq();
    this.editingServiceId = null;
    this.serviceForm = { name: '', timeEstimate: '', price: null, imageUrl: '', isPublic: true };
    this.serviceDocs = [];
    this.serviceIncludesList = [];
    this.serviceBonusList = [];
  }

  isServicePublic(s: GestorService): boolean {
    return s.isPublic !== false;
  }

  toggleServiceVisibility(s: GestorService, event?: Event) {
    event?.stopPropagation();
    const next = !this.isServicePublic(s);
    this.gestoresService.setServiceVisibility(s.id, next).subscribe({
      next: (res) => {
        const profile = this.profile();
        if (profile?.services) {
          this.profile.set({
            ...profile,
            services: profile.services.map((svc) =>
              svc.id === s.id ? { ...svc, isPublic: res.isPublic } : svc,
            ),
          });
        }
        this.toast.success(res.isPublic ? 'Servicio público: visible en tu ficha' : 'Servicio privado: solo lo asignas desde el panel');
      },
      error: (err) => this.toast.error(err.error?.error || 'No se pudo cambiar la visibilidad'),
    });
  }

  startEditService(s: GestorService) {
    resetChecklistSeq();
    this.editingServiceId = s.id;
    this.serviceForm = {
      name: s.name,
      timeEstimate: s.timeEstimate,
      price: s.price,
      imageUrl: s.imageUrl || '',
      isPublic: this.isServicePublic(s),
    };
    this.serviceDocs = checklistFromTexts(serviceRequirements(s));
    this.serviceIncludesList = checklistFromTexts(serviceIncludes(s));
    this.serviceBonusList = checklistFromTexts(serviceBonus(s));
    this.message.set('Editando servicio — requisitos, qué incluye y bonus abajo');
    setTimeout(() => this.message.set(''), 4000);
    setTimeout(() => {
      document.getElementById('service-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  cancelEditService() {
    this.resetServiceForm();
  }

  scrollToServiceForm() {
    setTimeout(() => {
      document.getElementById('service-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  openServiceDetail(s: GestorService) {
    this.serviceDetailModal.set(s);
  }

  closeServiceDetail() {
    this.serviceDetailModal.set(null);
  }

  saveService() {
    if (!this.serviceForm.name || !this.serviceForm.timeEstimate) return;
    const docs = this.checklistTexts(this.serviceDocs);
    const includes = this.checklistTexts(this.serviceIncludesList);
    const bonus = this.checklistTexts(this.serviceBonusList);
    const payload: {
      name: string;
      timeEstimate: string;
      price: number | null;
      imageUrl: string | null;
      isPublic: boolean;
      required_documents?: string[];
      includes?: string[];
      bonus?: string[];
    } = {
      name: this.serviceForm.name,
      timeEstimate: this.serviceForm.timeEstimate,
      price: this.serviceForm.price,
      imageUrl: this.serviceForm.imageUrl || null,
      isPublic: this.serviceForm.isPublic !== false,
    };
    if (docs.length > 0) payload.required_documents = docs;
    if (includes.length > 0) payload.includes = includes;
    if (bonus.length > 0) payload.bonus = bonus;

    const onSuccess = (msg: string) => {
      this.resetServiceForm();
      this.loadProfile();
      this.message.set(msg);
    };

    if (this.editingServiceId) {
      this.gestoresService.updateService(this.editingServiceId, payload).subscribe({
        next: () => onSuccess('Servicio actualizado'),
      });
    } else {
      this.gestoresService.addService(payload).subscribe({
        next: () => onSuccess('Servicio agregado'),
      });
    }
  }

  addService() {
    this.saveService();
  }

  onServiceImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('Elige una imagen (JPG, PNG o WebP).');
      return;
    }
    this.serviceImageCropFile.set(file);
  }

  onServiceImageCropConfirmed(result: CropResult) {
    const file = new File([result.blob], 'servicio.jpg', { type: 'image/jpeg' });
    this.serviceImageCropFile.set(null);
    this.isUploadingServiceImage.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: (res: { url: string }) => {
        this.serviceForm.imageUrl = res.url;
        this.isUploadingServiceImage.set(false);
      },
      error: () => {
        this.isUploadingServiceImage.set(false);
        this.toast.error('No se pudo subir la foto. Intenta de nuevo.');
      },
    });
  }

  onServiceImageCropCancelled() {
    this.serviceImageCropFile.set(null);
  }

  removeServiceImage() {
    this.serviceForm.imageUrl = '';
  }

  onServiceDragStart(event: DragEvent, idx: number) {
    event.dataTransfer?.setData('text/plain', String(idx));
    event.dataTransfer!.effectAllowed = 'move';
    // Diferir el estado visual: cambiar la clase en dragstart cancela el drag nativo en Chrome.
    setTimeout(() => {
      this.serviceDragIdx = idx;
    });
  }

  onServiceDragOver(event: DragEvent, idx: number) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.serviceDragOverIdx !== idx) this.serviceDragOverIdx = idx;
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
    const fromRaw = event.dataTransfer?.getData('text/plain');
    const fromIdx = fromRaw !== undefined && fromRaw !== '' ? Number(fromRaw) : this.serviceDragIdx;
    if (Number.isNaN(fromIdx) || fromIdx < 0 || fromIdx === toIdx) {
      this.resetServiceDragState();
      return;
    }
    this.moveServiceInList(fromIdx, toIdx);
    this.resetServiceDragState();
  }

  moveServiceByButton(fromIdx: number, direction: -1 | 1) {
    const toIdx = fromIdx + direction;
    const profile = this.profile();
    if (!profile?.services?.length) return;
    if (toIdx < 0 || toIdx >= profile.services.length) return;
    this.moveServiceInList(fromIdx, toIdx);
  }

  resetServiceDragState() {
    this.serviceDragIdx = -1;
    this.serviceDragOverIdx = -1;
  }

  private serviceOrderSeq = 0;

  private moveServiceInList(fromIdx: number, toIdx: number) {
    const profile = this.profile();
    if (!profile?.services?.length) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= profile.services.length || toIdx >= profile.services.length) return;
    const services = [...profile.services];
    const [moved] = services.splice(fromIdx, 1);
    services.splice(toIdx, 0, moved);
    this.profile.set({ ...profile, services });
    this.persistServiceOrder(services);
  }

  private persistServiceOrder(services: { id: string }[]) {
    const order = services.map(s => s.id);
    const seq = ++this.serviceOrderSeq;
    this.serviceOrderSaving = true;
    this.gestoresService.reorderServices(order).subscribe({
      next: (res) => {
        // Ignorar respuestas viejas si el usuario movió otra vez mientras guardaba.
        if (seq !== this.serviceOrderSeq) return;
        const profile = this.profile();
        if (profile) this.profile.set({ ...profile, services: res.services });
        this.serviceOrderSaving = false;
        this.toast.success('Orden de servicios guardado.');
      },
      error: (err) => {
        if (seq !== this.serviceOrderSeq) return;
        this.serviceOrderSaving = false;
        this.toast.error(err.error?.error || 'No se pudo guardar el orden.');
        this.loadProfile();
      },
    });
  }

  readonly hasServicePrice = hasServicePrice;
  readonly serviceRequirements = serviceRequirements;
  readonly serviceIncludes = serviceIncludes;
  readonly serviceBonus = serviceBonus;

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

  firstName(): string {
    const full = (this.profile()?.name || this.auth.user()?.name || 'Gestor').trim();
    return full.split(/\s+/)[0] || 'Gestor';
  }

  todayLabel(): string {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Mexico_City',
    }).format(new Date());
  }

  greetingLabel(): string {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'America/Mexico_City',
      }).format(new Date()),
    );
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalSearchHotkey(ev: KeyboardEvent) {
    if (!(ev.ctrlKey || ev.metaKey) || (ev.key !== 'k' && ev.key !== 'K')) return;
    const target = ev.target as HTMLElement | null;
    if (target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
    ev.preventDefault();
    this.focusGlobalSearch();
  }

  focusGlobalSearch() {
    const el = this.globalSearchInput?.nativeElement;
    if (!el) return;
    el.focus();
    el.select();
  }

  onGlobalSearchInput() {
    const q = this.globalSearch.trim();
    if (this.globalSearchTimer) clearTimeout(this.globalSearchTimer);
    if (!q) {
      this.clearGlobalSearchResults();
      return;
    }
    this.globalSearchTimer = setTimeout(() => this.fetchGlobalSearch(q), 280);
  }

  private clearGlobalSearchResults() {
    this.globalSearchOpen.set(false);
    this.globalSearchLoading.set(false);
    this.globalSearchContacts.set([]);
    this.globalSearchDeals.set([]);
  }

  private fetchGlobalSearch(q: string) {
    this.globalSearchLoading.set(true);
    this.globalSearchOpen.set(true);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending <= 0) this.globalSearchLoading.set(false);
    };

    this.crmService.getContacts({ q, page: 1, limit: 8 }).subscribe({
      next: (res) => {
        this.globalSearchContacts.set(
          (res.contacts || []).map((c) => ({
            id: c.id,
            name: c.name || 'Sin nombre',
            email: c.email || undefined,
            phone: c.phone || undefined,
          })),
        );
        done();
      },
      error: () => {
        this.globalSearchContacts.set([]);
        done();
      },
    });

    this.crmService.getDeals({ q }).subscribe({
      next: (deals) => {
        this.globalSearchDeals.set(
          (deals || []).slice(0, 8).map((d) => ({
            id: d.id,
            title: d.title || 'Trámite',
            contactName: d.contact?.name || undefined,
            stage: d.stage,
          })),
        );
        done();
      },
      error: () => {
        this.globalSearchDeals.set([]);
        done();
      },
    });
  }

  runGlobalSearch() {
    const q = this.globalSearch.trim();
    if (!q) {
      this.focusGlobalSearch();
      return;
    }
    this.searchQuery = q;
    this.clientsSeedQuery.set(q);
    this.isMobileMenuOpen.set(false);
    this.globalSearchLoading.set(true);
    this.globalSearchOpen.set(true);

    let contactsDone = false;
    let dealsDone = false;
    let contacts: { id: string; name: string; email?: string; phone?: string }[] = [];
    let deals: { id: string; title: string; contactName?: string; stage?: string }[] = [];

    const finish = () => {
      if (!contactsDone || !dealsDone) return;
      this.globalSearchLoading.set(false);
      this.globalSearchContacts.set(contacts);
      this.globalSearchDeals.set(deals);

      const hasContacts = contacts.length > 0;
      const hasDeals = deals.length > 0;

      if (!hasContacts && !hasDeals) {
        this.toast.info('No se encontraron clientes ni trámites con esa búsqueda');
        return;
      }
      // Solo clientes → Contactos; solo trámites o ambos → Pipeline + dropdown
      if (hasContacts && !hasDeals && this.hasPerm('clientes')) {
        this.globalSearchOpen.set(false);
        if (this.tab() !== 'clientes') this.setTab('clientes');
        return;
      }
      if (hasDeals && this.hasPerm('pipeline')) {
        if (this.tab() === 'pipeline') this.loadDeals();
        else this.setTab('pipeline');
      }
    };

    this.crmService.getContacts({ q, page: 1, limit: 8 }).subscribe({
      next: (res) => {
        contacts = (res.contacts || []).map((c) => ({
          id: c.id,
          name: c.name || 'Sin nombre',
          email: c.email || undefined,
          phone: c.phone || undefined,
        }));
        contactsDone = true;
        finish();
      },
      error: () => {
        contacts = [];
        contactsDone = true;
        finish();
      },
    });

    this.crmService.getDeals({ q }).subscribe({
      next: (rows) => {
        deals = (rows || []).slice(0, 8).map((d) => ({
          id: d.id,
          title: d.title || 'Trámite',
          contactName: d.contact?.name || undefined,
          stage: d.stage,
        }));
        dealsDone = true;
        finish();
      },
      error: () => {
        deals = [];
        dealsDone = true;
        finish();
      },
    });
  }

  pickGlobalContact(contactId: string) {
    this.globalSearchOpen.set(false);
    this.clientsSeedQuery.set(this.globalSearch.trim());
    if (this.hasPerm('clientes') && this.tab() !== 'clientes') {
      this.setTab('clientes');
    }
    this.openClientContact(contactId);
  }

  pickGlobalDeal(dealId: string) {
    this.globalSearchOpen.set(false);
    this.searchQuery = this.globalSearch.trim();
    if (this.hasPerm('pipeline')) {
      if (this.tab() !== 'pipeline') this.setTab('pipeline');
      else this.loadDeals();
      this.openDeal(dealId);
    }
  }

  @HostListener('document:click', ['$event'])
  onGlobalSearchClickOutside(ev: MouseEvent) {
    const root = (ev.target as HTMLElement | null)?.closest?.('.mon-top-search');
    if (!root) this.globalSearchOpen.set(false);
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
