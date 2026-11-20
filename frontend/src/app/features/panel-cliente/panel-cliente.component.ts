import { Component, inject, OnInit, OnDestroy, signal, computed, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { DateOnlyMxPipe } from '../../shared/date-only-mx.pipe';
import { MxDateInputComponent } from '../../shared/mx-date-input.component';
import { DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router, ActivatedRoute, ParamMap } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { OneSignalService } from '../../core/onesignal.service';
import { UploadService, CHAT_ATTACHMENT_ACCEPT, KnowledgeService } from '../../core/api.service';
import { PanelUserMenuComponent } from '../panel/panel-user-menu.component';
import { ChangeCredentialsComponent } from '../panel/change-credentials.component';
import { ThemeSwitchComponent } from '../../shared/theme-switch.component';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { isShippedStage } from '../../shared/payment-stage.utils';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import { VehicleMmySelectComponent } from '../../shared/vehicle-mmy-select.component';
import { formatVehicleLabel } from '../../shared/mexico-vehicle-catalog';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { ClientPromoBannerDto, CrmContactVehicle, CrmContactVehicleDocument, KnowledgePost } from '../../models';
import {
  checkCirculationToday,
  getMexicoCityCalendar,
  ruleForPlate,
  vehicleDisplayName,
} from '../../shared/hoy-no-circula';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideBot,
  LucideCar,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClipboardList,
  LucideFileText,
  LucideFolderOpen,
  LucideHistory,
  LucideInbox,
  LucideKeyRound,
  LucideLayoutDashboard,
  LucideMapPin,
  LucideMessageCircle,
  LucidePaperclip,
  LucideSearch,
  LucidePencil,
  LucideTrash2,
  LucideUpload,
  LucideUser,
  LucideReceipt,
  LucideDownload,
  LucideEye,
  LucideLoader,
  LucideWallet,
  LucidePlus,
  LucideBriefcase,
  LucideStore,
  LucideBookOpen,
  LucideHeart,
  LucideShare2,
  LucidePlay,
  LucideBell,
} from '@lucide/angular';

interface PaginatedDeals {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ClientTab = 'dashboard' | 'tramites' | 'historial' | 'billetera' | 'facturas' | 'vehiculos' | 'ajustes' | 'conocimiento';

const CLIENT_TABS: ClientTab[] = [
  'dashboard', 'tramites', 'historial', 'billetera', 'facturas', 'vehiculos', 'ajustes', 'conocimiento',
];

@Component({
  selector: 'app-panel-cliente',
  host: {
    class: 'panel-datta',
    '[class.sidebar-collapsed]': 'sidebarCollapsed()',
  },
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, DateOnlyMxPipe, MxDateInputComponent, CurrencyPipe, NgTemplateOutlet, RouterLink,
    PanelUserMenuComponent, ChangeCredentialsComponent, ThemeSwitchComponent, AiAssistantComponent, VehicleMmySelectComponent,
    LucideLayoutDashboard, LucideClipboardList, LucideHistory, LucideWallet,
    LucideCar, LucideInbox, LucideMapPin, LucideArrowLeft, LucideArrowRight, LucideCheck,
    LucideMessageCircle, LucideFileText, LucidePaperclip, LucideKeyRound, LucideUser, LucideReceipt, LucideDownload, LucideEye,
    LucideSearch, LucideChevronLeft, LucideChevronRight, LucideUpload, LucideTrash2, LucidePencil, LucidePlus,
    LucideFolderOpen, LucideLoader, LucideBriefcase, LucideStore,
    LucideBookOpen, LucideHeart, LucideShare2, LucidePlay, LucideBell,
  ],
  templateUrl: './panel-cliente.component.html',
  styleUrls: ['../panel/panel-dashboard.css', '../panel/panel-dark-theme.css', '../panel/panel-datta.css', './panel-cliente.component.css'],
})
export class PanelClienteComponent implements OnInit, OnDestroy {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;
  /** Feed "Para ti" y Área de Conocimiento ocultos por ahora a pedido del negocio. */
  readonly showKnowledge = false;
  readonly walletCategories = [
    'INE / Identificación',
    'Licencia de conducir',
    'Tarjeta de circulación',
    'Factura / Comprobante',
    'Póliza de seguro',
    'Comprobante de domicilio',
    'Otro',
  ];
  readonly pageSize = 10;

  auth = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  uploadService = inject(UploadService);
  knowledgeService = inject(KnowledgeService);
  readonly chatAttachmentAccept = CHAT_ATTACHMENT_ACCEPT;
  toast = inject(ToastService);
  oneSignal = inject(OneSignalService);
  zone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  deliveryFiles = computed(() =>
    this.documents().filter(d => d.source === 'gestor_entrega' || d.doc_kind === 'entrega'),
  );

  shippingFiles = computed(() =>
    this.documents().filter(d => d.source === 'gestor_envio' || d.doc_kind === 'envio'),
  );

  clientUploadedDocs = computed(() =>
    this.documents().filter(d =>
      d.source !== 'gestor_entrega' && d.doc_kind !== 'entrega' &&
      d.source !== 'gestor_envio' && d.doc_kind !== 'envio',
    ),
  );

  activeTab = signal<ClientTab>('dashboard');
  clientPromoBanners = signal<ClientPromoBannerDto[]>([]);
  showClientPromoBanner = computed(() => this.clientPromoBanners().length > 0);

  clientPromoDesktopImage(b: ClientPromoBannerDto): string {
    return b.promoBannerImageDesktop || b.promoBannerImage || '';
  }
  clientPromoMobileImage(b: ClientPromoBannerDto): string {
    return b.promoBannerImageMobile || b.promoBannerImageDesktop || b.promoBannerImage || '';
  }
  clientPromoTitleBelow(b: ClientPromoBannerDto): boolean {
    return (b.promoBannerTitlePlacement || 'overlay') === 'below';
  }
  clientPromoHasText(b: ClientPromoBannerDto): boolean {
    return !!(b.promoBannerTitle || b.promoBannerSubtitle);
  }
  clientPromoTitleOverlayStyle(b: ClientPromoBannerDto): Record<string, string> {
    const sizeMap: Record<string, string> = {
      sm: '14px',
      md: '18px',
      lg: '24px',
      xl: '32px',
    };
    const subtitleSizeMap: Record<string, string> = {
      sm: '11px',
      md: '13px',
      lg: '15px',
      xl: '18px',
    };
    const sizeKey = b.promoBannerTitleSize || 'md';
    const align = b.promoBannerTitleAlign || 'center';
    const valign = b.promoBannerTitleVAlign || 'center';
    const color = b.promoBannerTitleColor || '#ffffff';
    const fontSize = sizeMap[sizeKey] || sizeMap['md'];
    const subtitleSize = subtitleSizeMap[sizeKey] || subtitleSizeMap['md'];
    const justify =
      align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    const items =
      valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center';
    return {
      '--promo-title-color': color,
      '--promo-title-size': fontSize,
      '--promo-subtitle-size': subtitleSize,
      color,
      webkitTextFillColor: color,
      fontSize,
      justifyContent: justify,
      alignItems: items,
      textAlign: align as 'left' | 'center' | 'right',
    };
  }
  isMobileMenuOpen = signal(false);
  credentialsOpen = signal(false);
  private isNarrowViewport = signal(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 991px)').matches
  );
  headerAvatarSize = computed(() => 104);
  sidebarCollapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('crm_cliente_sidebar_collapsed') === '1'
  );

  toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991px)').matches) {
      this.isMobileMenuOpen.update((v) => !v);
      return;
    }
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    try {
      localStorage.setItem('crm_cliente_sidebar_collapsed', next ? '1' : '0');
    } catch { /* ignore */ }
  }
  dealTab = signal<'chat' | 'docs' | 'factura'>('chat');
  /** Evita bucles al sincronizar tab/deal con la URL */
  private syncingFromUrl = false;
  /** Historial interno de pestañas para el botón «atrás» en móvil */
  private tabHistory: ClientTab[] = [];
  /** True si hay algo a lo que volver dentro del panel (móvil) */
  canGoBack = computed(() => !!this.selectedDeal() || this.activeTab() !== 'dashboard');

  stats = signal({ total: 0, active: 0, closed: 0 });
  recentDeals = signal<any[]>([]);
  tramitesList = signal<any[]>([]);
  historialList = signal<any[]>([]);
  tramitesMeta = signal({ total: 0, page: 1, totalPages: 1 });
  historialMeta = signal({ total: 0, page: 1, totalPages: 1 });
  tramitesSearch = '';
  historialSearch = '';
  tramitesLoading = signal(false);
  historialLoading = signal(false);
  dashboardLoading = signal(true);
  /** Feed reels estilo Instagram — solo dashboard */
  knowledgeFeedPosts = signal<KnowledgePost[]>([]);
  knowledgeFeedLoading = signal(false);
  knowledgeFeedLoadingMore = signal(false);
  knowledgeFeedHasMore = signal(false);
  private knowledgeFeedPage = 1;
  readonly knowledgeFeedPageSize = 5;
  @ViewChild('knowledgeReelsBox') knowledgeReelsBox?: ElementRef<HTMLDivElement>;

  /** Grid paginado — solo tab Área de Conocimiento */
  knowledgePosts = signal<KnowledgePost[]>([]);
  knowledgeLoading = signal(false);
  knowledgeMeta = signal({ page: 1, total: 0, totalPages: 1, limit: 10 });
  readonly knowledgePageSize = 10;

  selectedDeal = signal<any>(null);
  documents = signal<any[]>([]);
  dealInvoice = signal<any>(null);
  allInvoices = signal<any[]>([]);
  invoicesLoading = signal(false);
  downloadingInvoiceId = signal<string | null>(null);
  viewingInvoiceId = signal<string | null>(null);
  uploadingDocType = signal<string | null>(null);
  walletPickerFor = signal<string | null>(null);

  walletDocs = signal<any[]>([]);
  walletLoading = signal(false);
  uploadingWallet = signal(false);
  walletForm = { label: '', category: 'Otro', notes: '', vehicleId: '' };
  associatingWalletDocId = signal<string | null>(null);
  associateVehicleId = '';

  avatarUploading = signal(false);
  pushActivating = signal(false);
  profileName = '';
  profilePhone = '';
  profileType: '' | 'fisica' | 'moral' = '';
  profileSaving = signal(false);

  vehicles = signal<CrmContactVehicle[]>([]);
  vehiclesLoading = signal(false);
  showAddVehicleForm = signal(false);
  isAddingVehicle = signal(false);
  /** Vehículo en modo edición; null = solo lectura. */
  editingVehicleId = signal<string | null>(null);
  newPlate = '';
  newMake = '';
  newModel = '';
  newYear: number | null = null;
  newVehicleState = '';
  newEngomado = '';
  newInsuranceExpiry = '';
  newTenencia = '';
  newVerificationHologram = '';
  newNextVerificationDate = '';
  readonly hologramOptions = [
    { value: '00', label: '00' },
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: 'exento', label: 'Exento' },
  ];
  readonly mexicoStates = MEXICO_STATES;
  readonly formatVehicleLabel = formatVehicleLabel;
  readonly engomadoColors = [
    { value: 'amarillo', label: 'Amarillo' },
    { value: 'rosa', label: 'Rosa' },
    { value: 'rojo', label: 'Rojo' },
    { value: 'verde', label: 'Verde' },
    { value: 'azul', label: 'Azul' },
  ];
  readonly tenenciaOptions = [
    { value: 'si', label: 'Sí, pagada' },
    { value: 'no', label: 'No pagada' },
    { value: 'pendiente', label: 'Pendiente' },
  ];
  readonly currentYear = new Date().getFullYear();

  tenenciaLabel(value?: string | null): string {
    return this.tenenciaOptions.find(o => o.value === value)?.label || '';
  }

  engomadoLabel(value?: string | null): string {
    return this.engomadoColors.find(o => o.value === value)?.label || '';
  }

  hologramLabel(value?: string | null): string {
    if (!value) return '';
    return this.hologramOptions.find(o => o.value === value)?.label || String(value);
  }

  isEditingVehicle(v: CrmContactVehicle): boolean {
    return this.editingVehicleId() === v.id;
  }

  startEditVehicle(v: CrmContactVehicle) {
    this.editingVehicleId.set(v.id);
  }

  doneEditVehicle() {
    this.editingVehicleId.set(null);
  }

  vehicleFact(value?: string | number | null): string {
    if (value == null || value === '') return '—';
    return String(value);
  }

  messages = signal<any[]>([]);
  newMessage = '';
  socket!: Socket;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  chatLoading = signal(false);
  uploadingFile = signal(false);

  totalDeals = computed(() => this.stats().total);
  activeDeals = computed(() => this.stats().active);
  completedDeals = computed(() => this.stats().closed);

  /** Resumen Hoy No Circula por vehículo registrado (CDMX / ZM). */
  vehicleCirculation = computed(() => {
    return this.vehicles().map(v => {
      const rule = ruleForPlate(v.plate);
      const check = checkCirculationToday(v.plate, v.verificationHologram);
      return {
        vehicle: v,
        displayName: vehicleDisplayName(v),
        rule,
        color: rule?.color || v.engomadoColor || null,
        colorLabel: rule?.colorLabel || (v.engomadoColor ? String(v.engomadoColor) : '—'),
        weekdayLabel: rule?.weekdayLabel || '—',
        verification1: rule?.verification1 || '—',
        verification2: rule?.verification2 || '—',
        blockedToday: check.blockedToday,
        reason: check.reason,
      };
    });
  });

  blockedVehiclesToday = computed(() => this.vehicleCirculation().filter(x => x.blockedToday));

  todayMexicoLabel = computed(() => getMexicoCityCalendar().weekdayLabel);

  firstName(): string {
    const full = (this.auth.user()?.name || 'Usuario').trim();
    return full.split(/\s+/)[0] || 'Usuario';
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

  private narrowViewportMq: MediaQueryList | null = null;
  private onNarrowViewportChange = (e: MediaQueryListEvent | MediaQueryList) => {
    this.isNarrowViewport.set(!!e.matches);
  };

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.narrowViewportMq = window.matchMedia('(max-width: 991px)');
      this.isNarrowViewport.set(this.narrowViewportMq.matches);
      this.narrowViewportMq.addEventListener('change', this.onNarrowViewportChange);
    }
    this.route.queryParamMap.subscribe(params => this.applyRouteState(params));
    this.auth.getMe().subscribe({
      next: () => this.syncProfileForm(),
      error: () => this.syncProfileForm(),
    });
    this.syncProfileForm();
    this.loadDashboard();
    this.loadInvoices();
    this.loadWallet();
    this.loadVehicles();
    this.loadClientPromoBanner();
    void this.oneSignal.refreshPermissionState();
    this.socket = io(environment.apiUrl.replace('/api', ''));

    const user = this.auth.user();
    if (user) this.socket.emit('identify', user.id);
    this.socket.on('connect', () => {
      const u = this.auth.user();
      if (u) this.socket.emit('identify', u.id);
    });
    this.presenceTimer = setInterval(() => {
      if (this.socket?.connected) this.socket.emit('presence_ping');
    }, 45000);

    this.socket.on('receive_message', (msg: any) => {
      this.zone.run(() => {
        const deal = this.selectedDeal();
        const msgDealId = msg.dealId || msg.deal_id;
        if (deal && msgDealId === deal.id) {
          this.messages.update(msgs => {
            if (msgs.some(m => m.id === msg.id)) return msgs;
            return [...msgs, msg];
          });
          this.scrollToBottom();
        }
      });
    });

    this.socket.on('notification', (notif: any) => {
      this.zone.run(() => {
        this.toast.info(notif.body, notif.title, () => {
          if (notif.ref_id) {
            this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
              params: { status: 'all', page: '1', limit: '100' },
            }).subscribe(res => {
              const d = res.items.find(x => x.id === notif.ref_id);
              if (d) this.openDeal(d);
            });
          }
        });
      });
    });
  }

  ngOnDestroy() {
    this.narrowViewportMq?.removeEventListener('change', this.onNarrowViewportChange);
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
    if (this.socket) this.socket.disconnect();
  }

  private loadClientPromoBanner() {
    this.http.get<{ banners?: ClientPromoBannerDto[] }>(`${environment.apiUrl}/client/promo-banners`).subscribe({
      next: (res) => {
        const list = (res?.banners || []).filter((b) => {
          if (b.promoBannerEnabled === false) return false;
          return !!(
            b.promoBannerImageDesktop
            || b.promoBannerImageMobile
            || b.promoBannerImage
            || b.promoBannerTitle
          );
        });
        this.clientPromoBanners.set(list);
      },
      error: () => this.clientPromoBanners.set([]),
    });
  }

  /** Aplica la pestaña y deja rastro en el historial del navegador. */
  setTab(tab: ClientTab) {
    this.applyTab(tab);
    if (!this.selectedDeal()) {
      this.syncUrl({ tab, deal: null });
    } else {
      this.syncUrl({ tab });
    }
  }

  /**
   * Volver dentro del panel (móvil): cierra el trámite abierto
   * o regresa a la pestaña anterior. No sale al sitio público.
   */
  goBack() {
    if (this.selectedDeal()) {
      this.closeDeal();
      const previous = this.tabHistory.pop();
      if (previous && previous !== this.activeTab()) {
        this.applyTab(previous, { recordHistory: false });
        this.syncUrl({ tab: previous, deal: null });
      }
      return;
    }
    const previous = this.tabHistory.pop();
    if (previous && previous !== this.activeTab()) {
      this.applyTab(previous, { recordHistory: false });
      this.syncUrl({ tab: previous, deal: null });
      return;
    }
    if (this.activeTab() !== 'dashboard') {
      this.applyTab('dashboard', { recordHistory: false });
      this.syncUrl({ tab: 'dashboard', deal: null });
    }
  }

  /** Logo / home: siempre dentro del panel. */
  goHome() {
    if (this.selectedDeal()) {
      const deal = this.selectedDeal();
      if (deal) this.socket?.emit('leave_deal', deal.id);
      this.selectedDeal.set(null);
      this.messages.set([]);
      this.documents.set([]);
      this.dealInvoice.set(null);
    }
    this.tabHistory = [];
    this.applyTab('dashboard', { recordHistory: false });
    this.syncUrl({ tab: 'dashboard', deal: null });
  }

  private applyTab(tab: ClientTab, opts: { recordHistory?: boolean } = {}) {
    const prev = this.activeTab();
    if (opts.recordHistory !== false && !this.syncingFromUrl && prev !== tab) {
      this.tabHistory.push(prev);
      if (this.tabHistory.length > 30) this.tabHistory.shift();
    }
    this.activeTab.set(tab);
    this.isMobileMenuOpen.set(false);
    if (tab === 'tramites' && !this.selectedDeal()) this.loadTramites(1);
    if (tab === 'historial') this.loadHistorial(1);
    if (tab === 'billetera') {
      this.loadWallet();
      if (!this.vehicles().length) this.loadVehicles();
    }
    if (tab === 'vehiculos') this.loadVehicles();
    if (!this.showKnowledge) return;
    if (tab === 'conocimiento') {
      this.loadKnowledgePage(1);
    }
    if (tab === 'dashboard' && !this.knowledgeFeedPosts().length) {
      this.loadKnowledgeFeed(true);
    }
  }

  private parseTab(value: string | null): ClientTab {
    if (value === 'conocimiento' && !this.showKnowledge) return 'dashboard';
    if (value && CLIENT_TABS.includes(value as ClientTab)) return value as ClientTab;
    return 'dashboard';
  }

  private applyRouteState(params: ParamMap) {
    const tab = this.parseTab(params.get('tab'));
    const dealId = params.get('deal');

    this.syncingFromUrl = true;
    try {
      if (dealId) {
        if (this.selectedDeal()?.id !== dealId) {
          this.loadDealById(dealId);
        } else {
          this.applyTab(tab === 'dashboard' ? 'tramites' : tab);
        }
        return;
      }

      if (this.selectedDeal()) {
        const deal = this.selectedDeal();
        if (deal) this.socket?.emit('leave_deal', deal.id);
        this.selectedDeal.set(null);
        this.messages.set([]);
        this.documents.set([]);
        this.dealInvoice.set(null);
      }
      this.applyTab(tab);
    } finally {
      this.syncingFromUrl = false;
    }
  }

  private syncUrl(opts: { tab?: ClientTab; deal?: string | null }) {
    if (this.syncingFromUrl) return;
    const tab = opts.tab ?? this.activeTab();
    const deal = opts.deal !== undefined
      ? opts.deal
      : (this.selectedDeal()?.id as string | undefined) ?? null;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: tab !== 'dashboard' ? tab : null,
        deal: deal || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private loadDealById(dealId: string) {
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: { status: 'all', page: '1', limit: '100' },
    }).subscribe({
      next: res => {
        const deal = res.items.find(x => x.id === dealId);
        if (deal) {
          this.openDeal(deal, { skipUrlSync: true });
        } else {
          this.applyTab(this.parseTab(this.route.snapshot.queryParamMap.get('tab')));
        }
      },
      error: () => this.applyTab('tramites'),
    });
  }

  loadKnowledgeFeed(reset = false) {
    if (reset) {
      this.knowledgeFeedPage = 1;
      this.knowledgeFeedHasMore.set(false);
      if (!this.knowledgeFeedPosts().length) this.knowledgeFeedLoading.set(true);
    } else {
      if (this.knowledgeFeedLoadingMore() || !this.knowledgeFeedHasMore()) return;
      this.knowledgeFeedLoadingMore.set(true);
    }

    const page = reset ? 1 : this.knowledgeFeedPage + 1;
    this.knowledgeService.feed(page, this.knowledgeFeedPageSize).subscribe({
      next: res => {
        if (reset) {
          this.knowledgeFeedPosts.set(res.items);
        } else {
          const existing = new Set(this.knowledgeFeedPosts().map(p => p.id));
          const merged = [...this.knowledgeFeedPosts(), ...res.items.filter(p => !existing.has(p.id))];
          this.knowledgeFeedPosts.set(merged);
        }
        this.knowledgeFeedPage = res.page;
        this.knowledgeFeedHasMore.set(res.hasMore);
        this.knowledgeFeedLoading.set(false);
        this.knowledgeFeedLoadingMore.set(false);
      },
      error: () => {
        if (reset) this.knowledgeFeedPosts.set([]);
        this.knowledgeFeedLoading.set(false);
        this.knowledgeFeedLoadingMore.set(false);
      },
    });
  }

  onKnowledgeReelsScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.loadKnowledgeFeed(false);
    }
  }

  loadKnowledgePage(page: number) {
    this.knowledgeLoading.set(true);
    this.knowledgeService.feed(page, this.knowledgePageSize).subscribe({
      next: res => {
        this.knowledgePosts.set(res.items);
        this.knowledgeMeta.set({
          page: res.page,
          total: res.total,
          totalPages: Math.max(1, Math.ceil(res.total / res.limit)),
          limit: res.limit,
        });
        this.knowledgeLoading.set(false);
      },
      error: () => {
        this.knowledgePosts.set([]);
        this.knowledgeLoading.set(false);
      },
    });
  }

  coverFor(post: KnowledgePost): string {
    if (post.coverUrl) return post.coverUrl;
    const yt = this.youtubeId(post.externalUrl || '');
    if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    return '';
  }

  youtubeId(url: string): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|v=)([\w-]{11})/);
    return m?.[1] || null;
  }

  openKnowledge(post: KnowledgePost) {
    if (post.type === 'article') {
      this.router.navigate(['/panel/cliente/conocimiento', post.id]);
      return;
    }
    const url = post.externalUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }

  plainSnippet(html: string | undefined, max = 70): string {
    const text = (html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  toggleLike(post: KnowledgePost, event?: Event) {
    event?.stopPropagation();
    this.knowledgeService.toggleLike(post.id).subscribe({
      next: res => {
        const patch = (list: KnowledgePost[]) =>
          list.map(p => p.id === post.id
            ? { ...p, likedByMe: res.likedByMe, likesCount: res.likesCount }
            : p);
        this.knowledgePosts.update(patch);
        this.knowledgeFeedPosts.update(patch);
      },
      error: () => this.toast.error('No se pudo guardar el me gusta', 'Error'),
    });
  }

  shareWhatsApp(post: KnowledgePost, event?: Event) {
    event?.stopPropagation();
    const link = post.type === 'article'
      ? `${window.location.origin}/panel/cliente/conocimiento/${post.id}`
      : (post.externalUrl || `${window.location.origin}/panel/cliente`);
    const snippet = this.plainSnippet(post.body, 120);
    const text = `${post.title}${snippet ? '\n' + snippet : ''}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  typeLabel(type: KnowledgePost['type']) {
    if (type === 'video') return 'Video';
    if (type === 'article') return 'Artículo';
    return 'Link';
  }

  loadVehicles(opts: { quiet?: boolean } = {}) {
    const quiet = !!opts.quiet && this.vehicles().length > 0;
    if (!quiet) this.vehiclesLoading.set(true);
    this.http.get<CrmContactVehicle[]>(`${environment.apiUrl}/client/vehicles`).subscribe({
      next: list => {
        this.vehicles.set(list);
        this.vehiclesLoading.set(false);
      },
      error: () => {
        this.vehiclesLoading.set(false);
        this.toast.error('No se pudieron cargar tus vehículos', 'Error');
      },
    });
  }

  private patchClientVehicleDocuments(
    vehicleId: string,
    updater: (docs: CrmContactVehicleDocument[]) => CrmContactVehicleDocument[],
  ) {
    this.vehicles.update((list) =>
      list.map((v) => (v.id === vehicleId ? { ...v, documents: updater(v.documents || []) } : v)),
    );
  }

  addVehicle() {
    if (!this.newPlate.trim()) {
      this.toast.warning('Indica la placa del vehículo', 'Datos incompletos');
      return;
    }
    if (!this.newMake || !this.newModel || !this.newYear) {
      this.toast.warning('Selecciona marca, submarca y año', 'Datos incompletos');
      return;
    }
    this.isAddingVehicle.set(true);
    this.http.post<CrmContactVehicle>(`${environment.apiUrl}/client/vehicles`, {
      plate: this.newPlate.trim(),
      make: this.newMake,
      model: this.newModel,
      year: this.newYear,
      state: this.newVehicleState || undefined,
      engomadoColor: this.newEngomado || undefined,
      insuranceExpiry: this.newInsuranceExpiry || undefined,
      tenenciaStatus: this.newTenencia || undefined,
      verificationHologram: this.newVerificationHologram || undefined,
      nextVerificationDate: this.newNextVerificationDate || undefined,
    }).subscribe({
      next: () => {
        this.isAddingVehicle.set(false);
        this.resetNewVehicleForm();
        this.showAddVehicleForm.set(false);
        this.loadVehicles({ quiet: true });
        this.toast.success('Vehículo registrado', 'Listo');
      },
      error: (e) => {
        this.isAddingVehicle.set(false);
        this.toast.error(e.error?.error || 'No se pudo agregar el vehículo', 'Error');
      },
    });
  }

  openAddVehicleForm() {
    this.showAddVehicleForm.set(true);
  }

  cancelAddVehicleForm() {
    this.showAddVehicleForm.set(false);
    this.resetNewVehicleForm();
  }

  private resetNewVehicleForm() {
    this.newPlate = '';
    this.newMake = '';
    this.newModel = '';
    this.newYear = null;
    this.newVehicleState = '';
    this.newEngomado = '';
    this.newInsuranceExpiry = '';
    this.newTenencia = '';
    this.newVerificationHologram = '';
    this.newNextVerificationDate = '';
  }

  isInsuranceExpired(date: string | null | undefined): boolean {
    if (!date) return false;
    const d = String(date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return d < ymd;
  }

  updateClientVehicle(v: CrmContactVehicle, field: string, value: string | number | null) {
    const payload: Record<string, string | number | null> = { [field]: value };
    this.vehicles.update((list) =>
      list.map((item) => (item.id === v.id ? { ...item, [field]: value } as CrmContactVehicle : item)),
    );
    this.http.patch<CrmContactVehicle>(`${environment.apiUrl}/client/vehicles/${v.id}`, payload).subscribe({
      next: (updated) => {
        if (!updated?.id) return;
        this.vehicles.update((list) =>
          list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        );
      },
      error: () => {
        this.loadVehicles({ quiet: true });
        this.toast.error('No se pudo actualizar el vehículo', 'Error');
      },
    });
  }

  removeVehicle(v: CrmContactVehicle) {
    if (!confirm('¿Eliminar este vehículo de tu perfil?')) return;
    this.http.delete(`${environment.apiUrl}/client/vehicles/${v.id}`).subscribe({
      next: () => {
        if (this.editingVehicleId() === v.id) this.editingVehicleId.set(null);
        this.vehicles.update((list) => list.filter((item) => item.id !== v.id));
        this.toast.success('Vehículo eliminado', 'Listo');
      },
      error: () => this.toast.error('No se pudo eliminar el vehículo', 'Error'),
    });
  }

  vehicleDocLabels: Record<string, string> = {};
  uploadingVehicleDocId = signal<string | null>(null);
  downloadingVehicleDocId = signal<string | null>(null);

  vehicleDocTitle(doc: CrmContactVehicleDocument): string {
    return doc.label?.trim() || doc.fileName || 'Documento';
  }

  onVehicleDocSelected(v: CrmContactVehicle, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Usa una foto (JPG, PNG, WebP) o un PDF.', 'Formato no válido');
      input.value = '';
      return;
    }

    this.uploadingVehicleDocId.set(v.id);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: res => {
        const label = (this.vehicleDocLabels[v.id] || '').trim() || file.name.replace(/\.[^.]+$/, '');
        this.http.post<CrmContactVehicleDocument>(`${environment.apiUrl}/client/vehicles/${v.id}/documents`, {
          fileName: file.name,
          fileUrl: res.url,
          label,
        }).subscribe({
          next: (doc) => {
            this.uploadingVehicleDocId.set(null);
            this.vehicleDocLabels[v.id] = '';
            input.value = '';
            if (doc?.id) {
              this.patchClientVehicleDocuments(v.id, (docs) => [...docs, doc]);
            } else {
              this.loadVehicles({ quiet: true });
            }
            this.toast.success('Documento guardado en el vehículo.', 'Listo');
          },
          error: (e) => {
            this.uploadingVehicleDocId.set(null);
            input.value = '';
            this.toast.error(e.error?.error || 'No se pudo guardar el documento.', 'Error');
          },
        });
      },
      error: (e) => {
        this.uploadingVehicleDocId.set(null);
        input.value = '';
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
      },
    });
  }

  deleteVehicleDoc(doc: CrmContactVehicleDocument) {
    if (!confirm('¿Eliminar este documento del vehículo?')) return;
    this.http.delete(`${environment.apiUrl}/client/vehicle-documents/${doc.id}`).subscribe({
      next: () => {
        const vehicleId =
          doc.vehicleId ||
          this.vehicles().find((v) => (v.documents || []).some((d) => d.id === doc.id))?.id;
        if (vehicleId) {
          this.patchClientVehicleDocuments(vehicleId, (docs) => docs.filter((d) => d.id !== doc.id));
        } else {
          this.loadVehicles({ quiet: true });
        }
        this.toast.success('Documento eliminado.', 'Listo');
      },
      error: () => this.toast.error('No se pudo eliminar.', 'Error'),
    });
  }

  downloadVehicleDoc(doc: CrmContactVehicleDocument) {
    const url = this.previewFileUrl(doc.fileUrl);
    const baseName = this.vehicleDocTitle(doc).replace(/[<>:"/\\|?*]+/g, '_').trim() || 'documento';
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(baseName);
    const ext = hasExt
      ? ''
      : this.isPdfUrl(doc.fileUrl)
        ? '.pdf'
        : (doc.fileUrl.match(/\.(jpe?g|png|webp|gif)($|\?)/i)?.[0] || '');

    this.downloadingVehicleDocId.set(doc.id);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseName}${ext}`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        this.downloadingVehicleDocId.set(null);
      },
      error: () => {
        this.downloadingVehicleDocId.set(null);
        window.open(url, '_blank', 'noopener,noreferrer');
        this.toast.info('Se abrió el documento en una nueva pestaña.', 'Descarga');
      },
    });
  }

  activatePush(): void {
    if (this.pushActivating()) return;
    const user = this.auth.user();
    this.pushActivating.set(true);
    this.zone.runOutsideAngular(() => {
      void this.oneSignal.activatePushFromClick(user?.id, user?.role).then(result => {
        this.zone.run(() => {
          if (result.ok) {
            this.toast.success('Notificaciones activadas', 'Listo');
            return;
          }
          this.toast.error(result.error || 'No se pudo activar', 'Notificaciones');
          void this.oneSignal.refreshPermissionState();
        });
      }).finally(() => {
        this.zone.run(() => this.pushActivating.set(false));
      });
    });
  }

  syncProfileForm() {
    const u = this.auth.user();
    this.profileName = u?.name || '';
    this.profilePhone = u?.phone || '';
    const pt = String(u?.profile_type || '').toLowerCase();
    this.profileType = pt === 'fisica' || pt === 'moral' ? pt : '';
  }

  saveProfile() {
    const name = this.profileName.trim();
    if (!name) {
      this.toast.warning('Escribe tu nombre.', 'Datos incompletos');
      return;
    }
    this.profileSaving.set(true);
    this.auth.updateMe({
      name,
      phone: this.profilePhone.trim() || null,
      profile_type: this.profileType || null,
    }).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.syncProfileForm();
        this.toast.success('Perfil actualizado', 'Listo');
      },
      error: (e) => {
        this.profileSaving.set(false);
        this.toast.error(e.error?.error || 'No se pudo guardar el perfil', 'Error');
      },
    });
  }

  uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('Usa una imagen (JPG, PNG, WebP).', 'Formato no válido');
      input.value = '';
      return;
    }
    this.avatarUploading.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: ({ url }) => {
        this.auth.updateMe({ avatar_url: url }).subscribe({
          next: () => {
            this.avatarUploading.set(false);
            this.toast.success('Foto de perfil actualizada', 'Listo');
          },
          error: () => {
            this.avatarUploading.set(false);
            this.toast.error('No se pudo guardar la foto', 'Error');
          },
        });
      },
      error: (e) => {
        this.avatarUploading.set(false);
        this.toast.error(e.error?.error || 'Error al subir la imagen', 'Error');
      },
    });
    input.value = '';
  }

  removeAvatar() {
    if (!confirm('¿Quitar tu foto de perfil?')) return;
    this.avatarUploading.set(true);
    this.auth.updateMe({ avatar_url: null }).subscribe({
      next: () => {
        this.avatarUploading.set(false);
        this.toast.success('Foto de perfil eliminada', 'Listo');
      },
      error: () => {
        this.avatarUploading.set(false);
        this.toast.error('No se pudo quitar la foto', 'Error');
      },
    });
  }

  loadDashboard() {
    this.dashboardLoading.set(true);
    if (this.showKnowledge) this.loadKnowledgeFeed(true);
    this.http.get<{ total: number; active: number; closed: number }>(`${environment.apiUrl}/client/deals/stats`).subscribe({
      next: stats => {
        this.stats.set(stats);
        this.dashboardLoading.set(false);
      },
      error: () => this.dashboardLoading.set(false),
    });
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: { status: 'all', page: '1', limit: '4' },
    }).subscribe({
      next: res => this.recentDeals.set(res.items),
    });
  }

  loadTramites(page = 1) {
    this.tramitesLoading.set(true);
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: {
        status: 'active',
        page: String(page),
        limit: String(this.pageSize),
        ...(this.tramitesSearch.trim() ? { q: this.tramitesSearch.trim() } : {}),
      },
    }).subscribe({
      next: res => {
        this.tramitesList.set(res.items);
        this.tramitesMeta.set({ total: res.total, page: res.page, totalPages: res.totalPages });
        this.tramitesLoading.set(false);
      },
      error: () => this.tramitesLoading.set(false),
    });
  }

  loadHistorial(page = 1) {
    this.historialLoading.set(true);
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: {
        status: 'closed',
        page: String(page),
        limit: String(this.pageSize),
        ...(this.historialSearch.trim() ? { q: this.historialSearch.trim() } : {}),
      },
    }).subscribe({
      next: res => {
        this.historialList.set(res.items);
        this.historialMeta.set({ total: res.total, page: res.page, totalPages: res.totalPages });
        this.historialLoading.set(false);
      },
      error: () => this.historialLoading.set(false),
    });
  }

  searchTramites() {
    this.loadTramites(1);
  }

  searchHistorial() {
    this.loadHistorial(1);
  }

  loadWallet() {
    this.walletLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/wallet`).subscribe({
      next: docs => {
        this.walletDocs.set(docs);
        this.walletLoading.set(false);
      },
      error: () => this.walletLoading.set(false),
    });
  }

  onWalletFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.walletForm.label.trim()) {
      this.toast.warning('Escribe un nombre para el documento antes de subir.', 'Datos incompletos');
      input.value = '';
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Usa una foto (JPG, PNG, WebP) o un PDF.', 'Formato no válido');
      input.value = '';
      return;
    }
    this.uploadingWallet.set(true);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: res => {
        const label = this.walletForm.label.trim();
        const vehicleId = this.walletForm.vehicleId?.trim();
        const save$ = vehicleId
          ? this.http.post<CrmContactVehicleDocument>(`${environment.apiUrl}/client/vehicles/${vehicleId}/documents`, {
              fileName: file.name,
              fileUrl: res.url,
              label,
            })
          : this.http.post<any>(`${environment.apiUrl}/client/wallet`, {
              label,
              category: this.walletForm.category,
              fileUrl: res.url,
              notes: this.walletForm.notes.trim() || null,
            });

        save$.subscribe({
          next: () => {
            this.walletForm = { label: '', category: 'Otro', notes: '', vehicleId: '' };
            this.uploadingWallet.set(false);
            input.value = '';
            this.loadWallet();
            this.toast.success(
              vehicleId ? 'Documento guardado y asociado al vehículo.' : 'Documento guardado en tu billetera.',
              'Listo',
            );
          },
          error: () => {
            this.uploadingWallet.set(false);
            this.toast.error('No se pudo guardar el documento.', 'Error');
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.uploadingWallet.set(false);
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  deleteWalletDoc(doc: { id: string; source?: string }) {
    if (!confirm('¿Eliminar este documento?')) return;
    const url = doc.source === 'vehicle'
      ? `${environment.apiUrl}/client/vehicle-documents/${doc.id}`
      : `${environment.apiUrl}/client/wallet/${doc.id}`;
    this.http.delete(url).subscribe({
      next: () => {
        this.loadWallet();
        this.toast.success('Documento eliminado.', 'Listo');
      },
      error: () => this.toast.error('No se pudo eliminar.', 'Error'),
    });
  }

  startAssociateWalletDoc(doc: { id: string; source?: string }) {
    if (doc.source === 'vehicle') return;
    if (!this.vehicles().length) {
      this.toast.warning('Registra un vehículo en Mis Vehículos para asociar documentos.', 'Sin vehículos');
      return;
    }
    this.associatingWalletDocId.set(doc.id);
    this.associateVehicleId = this.vehicles()[0]?.id || '';
  }

  cancelAssociateWalletDoc() {
    this.associatingWalletDocId.set(null);
    this.associateVehicleId = '';
  }

  associateWalletDoc(doc: { id: string }) {
    if (!this.associateVehicleId) {
      this.toast.warning('Selecciona un vehículo.', 'Datos incompletos');
      return;
    }
    this.http.post(`${environment.apiUrl}/client/wallet/${doc.id}/associate`, {
      vehicleId: this.associateVehicleId,
    }).subscribe({
      next: () => {
        this.cancelAssociateWalletDoc();
        this.loadWallet();
        this.toast.success('Documento asociado al vehículo.', 'Listo');
      },
      error: (e) => this.toast.error(e.error?.error || 'No se pudo asociar.', 'Error'),
    });
  }

  walletVehicleLabel(doc: { vehicleName?: string | null; vehiclePlate?: string | null }): string {
    if (!doc.vehiclePlate) return '';
    return doc.vehicleName ? `${doc.vehicleName}` : doc.vehiclePlate;
  }

  downloadingWalletId = signal<string | null>(null);

  downloadWalletDoc(doc: { id: string; label?: string; file_url: string }) {
    const url = this.previewFileUrl(doc.file_url);
    const baseName = (doc.label || 'documento').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'documento';
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(baseName);
    const ext = hasExt
      ? ''
      : this.isPdfUrl(doc.file_url)
        ? '.pdf'
        : (doc.file_url.match(/\.(jpe?g|png|webp|gif)($|\?)/i)?.[0] || '');

    this.downloadingWalletId.set(doc.id);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseName}${ext}`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        this.downloadingWalletId.set(null);
      },
      error: () => {
        this.downloadingWalletId.set(null);
        window.open(url, '_blank', 'noopener,noreferrer');
        this.toast.info('Se abrió el documento en una nueva pestaña.', 'Descarga');
      },
    });
  }

  loadInvoices() {
    this.invoicesLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/invoices`).subscribe({
      next: res => {
        this.allInvoices.set(res);
        this.invoicesLoading.set(false);
      },
      error: () => this.invoicesLoading.set(false),
    });
  }

  openDeal(deal: any, opts: { skipUrlSync?: boolean } = {}) {
    if (!opts.skipUrlSync && !this.syncingFromUrl) {
      const prev = this.activeTab();
      if (prev !== 'tramites') {
        this.tabHistory.push(prev);
        if (this.tabHistory.length > 30) this.tabHistory.shift();
      }
    }
    this.selectedDeal.set(deal);
    this.activeTab.set('tramites');
    this.isMobileMenuOpen.set(false);
    this.dealTab.set(deal.payment_status === 'paid' && deal.invoice_id ? 'factura' : 'chat');
    this.dealInvoice.set(deal.invoice_id ? {
      id: deal.invoice_id,
      invoice_number: deal.invoice_number,
      amount: deal.invoice_amount,
      pdf_url: deal.invoice_pdf_url,
      created_at: deal.invoice_date,
    } : null);
    this.chatLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/messages`).subscribe({
      next: res => {
        this.messages.set(res);
        this.socket.emit('join_deal', deal.id);
        this.chatLoading.set(false);
        this.scrollToBottom();
      },
      error: () => this.chatLoading.set(false),
    });
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/documents`).subscribe({
      next: docs => {
        this.documents.set(docs);
        if (this.isShippedDeal(deal) || this.isTerminalStage(deal)) {
          this.dealTab.set('docs');
        }
      },
    });
    if (!this.walletDocs().length) {
      this.loadWallet();
    }
    if (deal.payment_status === 'paid' && !deal.invoice_id) {
      this.http.get<any>(`${environment.apiUrl}/client/deals/${deal.id}/invoice`).subscribe({
        next: inv => this.dealInvoice.set(inv),
        error: () => this.dealInvoice.set(null),
      });
    }
    if (!opts.skipUrlSync) {
      this.syncUrl({ tab: 'tramites', deal: deal.id });
    }
  }

  closeDeal() {
    const deal = this.selectedDeal();
    if (deal) this.socket.emit('leave_deal', deal.id);
    this.selectedDeal.set(null);
    this.messages.set([]);
    this.documents.set([]);
    this.dealInvoice.set(null);
    this.syncUrl({ tab: this.activeTab(), deal: null });
  }

  downloadInvoice(invoiceId: string, invoiceNumber?: string) {
    this.downloadingInvoiceId.set(invoiceId);
    this.http.get(`${environment.apiUrl}/client/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceNumber || 'factura'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingInvoiceId.set(null);
      },
      error: () => {
        this.downloadingInvoiceId.set(null);
        this.toast.error('No se pudo descargar el comprobante.', 'Error');
      },
    });
  }

  viewInvoice(invoiceId: string) {
    if (this.viewingInvoiceId()) return;
    this.viewingInvoiceId.set(invoiceId);
    this.http.get(`${environment.apiUrl}/client/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    }).subscribe({
      next: blob => {
        const pdfBlob = blob.type === 'application/pdf'
          ? blob
          : new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        const win = window.open(url, '_blank', 'noopener');
        if (!win) {
          this.toast.warning('Permite ventanas emergentes para ver el comprobante.');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.viewingInvoiceId.set(null);
      },
      error: () => {
        this.viewingInvoiceId.set(null);
        this.toast.error('No se pudo abrir el comprobante.', 'Error');
      },
    });
  }

  dealServiceImage(deal: any): string {
    return String(deal?.service_image_url || deal?.serviceImageUrl || '').trim();
  }

  isPaid(deal: any): boolean {
    return deal?.payment_status === 'paid';
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const dealId = this.selectedDeal()?.id;
    if (!dealId) return;
    const txt = this.newMessage;
    this.newMessage = '';

    this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, { message: txt }).subscribe(saved => {
      this.messages.update(msgs => {
        if (!msgs.find(m => m.id === saved.id)) {
          return [...msgs, { dealId, ...saved }];
        }
        return msgs;
      });
      this.scrollToBottom();
      this.socket.emit('send_message', { dealId, ...saved });
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingFile.set(true);
    this.uploadService.uploadChatAttachment(file).subscribe({
      next: res => {
        const dealId = this.selectedDeal()?.id;
        if (!dealId) return;
        this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, {
          message: `Documento adjunto: ${file.name}`,
          fileUrl: res.url,
        }).subscribe(saved => {
          this.messages.update(msgs => {
            if (!msgs.find(m => m.id === saved.id)) {
              return [...msgs, { dealId, ...saved }];
            }
            return msgs;
          });
          this.scrollToBottom();
          this.socket.emit('send_message', { dealId, ...saved });
          this.uploadingFile.set(false);
          input.value = '';
        });
      },
      error: (e) => {
        this.uploadingFile.set(false);
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  onDocSelected(docType: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Usa una foto (JPG, PNG, WebP) o un PDF.', 'Formato no válido');
      input.value = '';
      return;
    }

    this.uploadingDocType.set(docType);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);

    upload$.subscribe({
      next: res => {
        this.registerDealDocument(docType, res.url, () => { input.value = ''; });
      },
      error: (e) => {
        this.uploadingDocType.set(null);
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  isShippedDeal(deal: any): boolean {
    if (!deal?.stage) return false;
    if (deal.pipeline_stages?.length) return isShippedStage(deal.stage, deal.pipeline_stages);
    return isShippedStage(deal.stage, {});
  }

  getDocStatus(docType: string) {
    return this.clientUploadedDocs().find(d => d.document_type === docType);
  }

  previewFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
  }

  safePreviewUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.previewFileUrl(url));
  }

  walletPdfPreviewUrl(url: string) {
    const fileUrl = this.previewFileUrl(url);
    const hash = 'toolbar=0&navpanes=0&scrollbar=0&view=FitH';
    const previewUrl = fileUrl.includes('#') ? fileUrl : `${fileUrl}#${hash}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl);
  }

  isPdfUrl(url: string): boolean {
    return /\.pdf($|\?)/i.test(url || '');
  }

  isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|webp|gif)($|\?)/i.test(url || '') || /^data:image\//i.test(url || '');
  }

  hasWalletOptions(): boolean {
    return this.walletDocs().length > 0;
  }

  walletDocsForType(docType: string) {
    const all = this.walletDocs();
    const matched = all.filter(w => this.walletMatchesRequiredDoc(docType, w));
    const rest = all.filter(w => !matched.some(m => m.id === w.id));
    return [...matched, ...rest];
  }

  isWalletDocSuggested(docType: string, walletDoc: any): boolean {
    return this.walletMatchesRequiredDoc(docType, walletDoc);
  }

  toggleWalletPicker(docType: string) {
    this.walletPickerFor.update(current => (current === docType ? null : docType));
  }

  useWalletDoc(docType: string, walletDoc: any) {
    this.registerDealDocument(docType, walletDoc.file_url);
  }

  private registerDealDocument(docType: string, fileUrl: string, onDone?: () => void) {
    const dealId = this.selectedDeal()?.id;
    if (!dealId) return;
    this.uploadingDocType.set(docType);
    this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/documents`, {
      documentType: docType,
      fileUrl,
    }).subscribe({
      next: newDoc => {
        this.documents.update(docs => [newDoc, ...docs.filter(d => d.document_type !== docType)]);
        this.uploadingDocType.set(null);
        this.walletPickerFor.set(null);
        this.toast.success('Documento vinculado al trámite.', 'Listo');
        onDone?.();
      },
      error: () => {
        this.uploadingDocType.set(null);
        this.toast.error('No se pudo registrar el documento.', 'Error');
      },
    });
  }

  private walletMatchesRequiredDoc(docType: string, walletDoc: any): boolean {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dt = norm(docType);
    const blob = norm(`${walletDoc.label || ''} ${walletDoc.category || ''}`);

    if (blob.includes(dt) || dt.includes(norm(walletDoc.label || ''))) return true;

    const rules: [string[], string[]][] = [
      [['ine', 'identificacion', 'credencial', 'ife'], ['ine', 'identificacion', 'identific']],
      [['circulacion', 'tarjeta de circulacion'], ['circulacion', 'tarjeta']],
      [['factura', 'comprobante'], ['factura', 'comprobante']],
      [['licencia', 'conducir'], ['licencia', 'conducir']],
      [['seguro', 'poliza'], ['seguro', 'poliza']],
      [['domicilio'], ['domicilio']],
      [['curp'], ['curp', 'identificacion']],
      [['rfc'], ['rfc', 'fiscal']],
    ];

    for (const [docKeys, walletKeys] of rules) {
      if (docKeys.some(k => dt.includes(k)) && walletKeys.some(k => blob.includes(k))) {
        return true;
      }
    }

    const words = dt.split(/\W+/).filter(w => w.length > 3);
    return words.some(w => blob.includes(w));
  }

  pipelineStages(deal: any): { id: string; label: string }[] {
    const stages = deal?.pipeline_stages?.length
      ? deal.pipeline_stages
      : [
          { id: 'nuevo', label: 'Nuevo' },
          { id: 'contactado', label: 'Contactado' },
          { id: 'en_tramite', label: 'En trámite' },
          { id: 'documentacion', label: 'Documentación' },
          { id: 'completado', label: 'Completado' },
          { id: 'perdido', label: 'Perdido' },
        ];
    return stages.filter((s: { id: string; label: string }) => !this.isHiddenClientStage(s));
  }

  private isHiddenClientStage(stage: { id?: string; label?: string }): boolean {
    const normalize = (v?: string) =>
      (v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    const id = normalize(stage?.id);
    const label = normalize(stage?.label);
    const hidden = ['lead', 'resena'];
    return hidden.includes(id) || hidden.includes(label);
  }

  stageIndex(deal: any): number {
    if (!deal?.stage) return 0;
    const idx = this.pipelineStages(deal).findIndex(s => s.id === deal.stage);
    return idx >= 0 ? idx : 0;
  }

  isTerminalStage(deal: any): boolean {
    return !!deal?.is_closed;
  }

  stageLabel(deal: any): string {
    const match = this.pipelineStages(deal).find(s => s.id === deal?.stage);
    if (match?.label) return match.label;

    const raw = String(deal?.stage || '').trim();
    if (!raw) return '—';

    const defaults: Record<string, string> = {
      nuevo: 'Nuevo',
      contactado: 'Contactado',
      en_tramite: 'En trámite',
      documentacion: 'Documentación',
      completado: 'Completado',
      perdido: 'Cancelado',
      lead_nuevo: 'Nuevo',
    };
    if (defaults[raw]) return defaults[raw];
    if (/^etapa_/i.test(raw)) return 'En proceso';

    return raw
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  stageClass(deal: any): string {
    if (deal?.is_closed && (deal?.stage === 'perdido' || /perdid|cancel|rechaz/i.test(String(deal?.stage || '')))) {
      return 'badge-lost';
    }
    if (this.isTerminalStage(deal)) return 'badge-done';
    const idx = this.stageIndex(deal);
    if (idx === 0) return 'badge-new';
    return 'badge-progress';
  }

  stageProgress(deal: any): number {
    const stages = this.pipelineStages(deal);
    if (!stages.length) return 0;
    if (this.isTerminalStage(deal) && deal?.stage === 'perdido') return 0;
    const idx = this.stageIndex(deal);
    return Math.round(((idx + 1) / stages.length) * 100);
  }

  initials(name?: string) {
    if (!name) return 'CL';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  logout() {
    this.auth.logout();
  }

  scrollToBottom() {
    setTimeout(() => {
      const box = document.getElementById('chat-box');
      if (box) box.scrollTop = box.scrollHeight;
    }, 100);
  }
}
