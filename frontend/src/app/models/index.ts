export interface PageBlock {
  id: string;
  type: 'hero' | 'text' | 'gallery' | 'services' | 'form' | 'stats' | 'reviews' | 'tracker';
  region?: 'main' | 'sidebar';
  data: any;
}

export interface PageBuilderConfig {
  theme: {
    primaryColor?: string;
    fontFamily?: string;
    buttonTextColor?: string;
  };
  blocks: PageBlock[];
}

export interface User {
  id: string;
  email: string;
  role: 'gestor' | 'concesionaria' | 'cliente' | 'admin';
  name: string;
  status?: 'active' | 'pending_payment' | 'deactivated' | string;
  payment_failed_count?: number;
  parent_id?: string;
  permissions?: string[];
  logo_url?: string;
  pdf_settings?: {
    layout: string[];
    primaryColor?: string;
    footerText?: string;
    logoUrl?: string | null;
  };
  google_analytics_id?: string;
  stripe_secret_key?: string;
  stripe_public_key?: string;
  stripe_price_id?: string;
  page_builder_config?: PageBuilderConfig;
  ai_provider?: 'gemini' | 'openai';
  ai_api_key?: string;
  chatbot_bg_color?: string;
  chatbot_btn_color?: string;
  chatbot_text_color?: string;
  panel_assistant_enabled?: boolean | number;
  panel_assistant_name?: string;
  panel_assistant_position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  panel_assistant_bg_color?: string;
  panel_assistant_btn_color?: string;
  panel_assistant_text_color?: string;
  panel_assistant_font?: string;
  panel_assistant_prompt?: string;
  slug?: string;
  description?: string;
  phone?: string;
  address?: string;
  map_embed_url?: string;
  crm_stages?: { id: string; label: string }[];
}

export type AutoStatus = 'draft' | 'published' | 'baja';

export interface Auto {
  id: string;
  userId?: string;
  make: string;
  model: string;
  year: number;
  price: number;
  specialPrice?: number | null;
  verified?: boolean;
  mileage: number;
  transmission?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string | null;
  dealerName?: string;
  dealerSlug?: string;
  dealerLogoUrl?: string | null;
  dealerPhone?: string | null;
  whatsapp?: string | null;
  status?: AutoStatus;
  active?: boolean;
  google_analytics_id?: string;
  page_builder_config?: PageBuilderConfig;
  createdAt?: string;
}

export interface AutoPrivateDocument {
  id: string;
  autoId: string;
  label: string;
  fileUrl: string;
  fileName?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface AutoInquiry {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  message: string;
  status: 'nuevo' | 'respondido';
  reply?: string;
  createdAt?: string;
  make?: string;
  model?: string;
  autoId?: string;
}

export interface DealerReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface ConcesionariaDashboard {
  published: number;
  draft: number;
  baja: number;
  inquiriesNew: number;
  rating: number;
  reviewCount: number;
}

export interface CustomBlock {
  type: 'banner' | 'notice' | 'html';
  text: string;
  visible: boolean;
}

export interface SiteSettings {
  pageKey?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  panelTitle?: string;
  welcomeMessage?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  sidebarBg?: string;
  cardBg?: string;
  fontFamily?: string;
  displayFont?: string;
  titleSize?: string;
  subtitleSize?: string;
  cardRadius?: string;
  customBlocks?: CustomBlock[];
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'gestor' | 'concesionaria';
  createdAt?: string;
  gestorId?: string;
  slug?: string;
  location?: string;
  state?: string;
  rating?: number;
  autosCount?: number;
}

export interface AdminStats {
  totals: {
    users: number;
    gestores: number;
    concesionarias: number;
    autosPublished: number;
    autosDraft: number;
    autosBaja: number;
    inquiries: number;
    dealerReviews: number;
  };
  topGestores: { name: string; rating: number; tramitesCount: number; state: string }[];
  topDealers: { name: string; autosCount: number; avgRating: number }[];
}

export interface AnalyticsConfig {
  connected: boolean;
  measurementId: string | null;
  propertyId: string | null;
  connectedEmail: string | null;
  googleClientId?: string | null;
  hasClientSecret?: boolean;
  oauthConfigured?: boolean;
  oauthRedirectUri?: string;
}

export interface GaProperty {
  propertyId: string;
  displayName: string;
  accountName: string;
}

export interface AnalyticsDashboard {
  connected: boolean;
  needsProperty?: boolean;
  periodDays?: number;
  overview?: { sessions: number; activeUsers: number; screenPageViews: number };
  devices?: { device: string; sessions: number; activeUsers: number }[];
  topPages?: { path: string; views: number }[];
  daily?: { date: string; sessions: number }[];
}

export interface Gestor {
  id: string;
  slug: string;
  name: string;
  location: string;
  state: string;
  bannerUrl?: string;
  photoUrl?: string;
  logoUrl?: string;
  rating: number;
  reviewCount?: number;
  tramitesCount: number;
  experienceYears?: number;
  bio?: string;
  whatsapp?: string;
  schedule?: string;
  phone?: string;
  address?: string;
  mapEmbedUrl?: string;
  galleryImages?: string[];
  google_analytics_id?: string;
  page_builder_config?: PageBuilderConfig;
  chatbot_bg_color?: string;
  chatbot_btn_color?: string;
  chatbot_text_color?: string;
  services?: GestorService[];
  reviews?: GestorReview[];
  solicitudes?: Solicitud[];
  publicUrl?: string;
}

export interface GestorService {
  id: string;
  name: string;
  timeEstimate: string;
  price: number | null;
  required_documents?: string[];
}

export interface GestorReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface Solicitud {
  id: string;
  clientName: string;
  serviceName: string;
  location?: string;
  status: 'nuevo' | 'en_proceso' | 'completado';
  createdAt?: string;
}

export interface StateFilter {
  state: string;
  count: number;
}

export interface MakeFilter {
  make: string;
  count: number;
}

export interface CrmContactsPage {
  contacts: CrmContact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  tramiteOptions: string[];
}

export interface CrmContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  source?: string;
  notes?: string;
  residenceState?: string;
  vehicleCount?: number;
  plates?: string;
  engomados?: string[];
  tramites?: string;
  dealCount?: number;
  createdAt?: string;
}

export interface CrmContactVehicle {
  id: string;
  contactId: string;
  plate: string;
  state?: string;
  engomadoColor?: string;
  vehicleNotes?: string;
  verificationMonth?: number | null;
  verificationStatus?: 'due' | 'soon' | 'overdue' | 'ok' | 'unknown';
  verificationLabel?: string;
  createdAt?: string;
}

export interface CrmVerificationAlert extends CrmContactVehicle {
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface CrmDeal {
  id: string;
  dealType: 'tramite' | 'venta_auto';
  title: string;
  stage: string;
  estimatedValue: number;
  internalNotes?: string;
  lostReason?: string;
  firstResponseAt?: string;
  contactId?: string;
  refType?: string;
  refId?: string;
  autoId?: string;
  stageChangedAt?: string;
  createdAt?: string;
  paymentStatus?: 'unpaid' | 'paid';
  paymentSessionId?: string;
  contact?: CrmContact;
  clientMessage?: string;
  clientReply?: string;
  make?: string;
  model?: string;
  daysInStage?: number;
  activities?: CrmActivity[];
  tasks?: CrmTask[];

  // Financial fields (Phase 3.1)
  downPayment?: number;
  tradeInValue?: number;
  termMonths?: number;
  trackingCode?: string;
}

export interface CrmQuoteItem {
  description: string;
  price: number;
}

export interface CrmQuote {
  id: string;
  deal_id: string;
  user_id: string;
  items: CrmQuoteItem[];
  total: number;
  valid_until: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  pdf_url?: string;
  created_at?: string;
}

export interface CrmDocument {
  id: string;
  deal_id: string;
  file_name: string;
  file_url: string;
  notes?: string | null;
  doc_kind?: 'attachment' | 'cotizacion';
  created_at?: string;
}

export interface CrmTask {
  id: string;
  dealId: string;
  title: string;
  dueAt: string;
  completed: boolean;
  createdAt?: string;
  dealTitle?: string;
  contactName?: string;
}

export interface CrmTodayInbox {
  overdueTasks: CrmTask[];
  todayTasks: CrmTask[];
  stalledDeals: CrmDeal[];
  uncontactedDeals: CrmDeal[];
}

export interface CrmContact360 {
  contact: CrmContact;
  deals: CrmDeal[];
  activities: (CrmActivity & { dealTitle?: string; dealId?: string })[];
  tasks: CrmTask[];
  vehicles: CrmContactVehicle[];
}

export const LOST_REASONS = [
  'Precio alto',
  'Eligió otro proveedor',
  'No respondió',
  'No califica / canceló',
  'Otro',
] as const;

export interface CrmActivity {
  id: string;
  activityType: 'note' | 'stage_change' | 'message';
  content: string;
  createdAt?: string;
}

export interface CrmDashboard {
  totals: {
    total: number;
    active: number;
    won: number;
    lost: number;
    stalled: number;
    pipelineValue: number;
    newThisWeek: number;
    conversionRate: number;
    uncontacted: number;
    tasksOverdue: number;
    tasksDueToday: number;
    avgFirstResponseHours: number | null;
  };
  byStage: Record<string, number>;
  stages: string[];
  stageLabels: Record<string, string>;
  lostReasons?: string[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  templateCategory: 'tramite' | 'venta';
}

export const TRAMITE_STAGES = ['nuevo', 'contactado', 'en_tramite', 'documentacion', 'completado', 'perdido'] as const;
export const VENTA_STAGES = ['lead_nuevo', 'contactado', 'interesado', 'visita', 'negociacion', 'vendido', 'perdido'] as const;

export interface FinTransaction {
  id: string;
  user_id: string;
  deal_id?: string;
  deal_title?: string;
  vehicle_label?: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  referencia?: string;
  category: string;
  payment_method?: string;
  date: string;
  created_at?: string;
}

export interface FinTransactionsPage {
  items: FinTransaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FinFilterOptions {
  deals: { id: string; title: string }[];
  methods: string[];
}

export interface FinDashboard {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  projectedIncome: number;
  byMethod?: Record<string, number>;
}

export interface FinPaymentConfig {
  methods: string[];
}

export const FIN_ALL_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: '💵', color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', icon: '🏦', color: '#3b82f6' },
  { id: 'mercadopago', label: 'MercadoPago', icon: '💳', color: '#a855f7' },
  { id: 'stripe', label: 'Stripe', icon: '⚡', color: '#6366f1' },
] as const;

export interface DealerProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  description?: string;
  phone?: string;
  address?: string;
  mapEmbedUrl?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: DealerReview[];
  autosCount?: number;
  hasAi: boolean;
  chatbot_bg_color?: string;
  chatbot_btn_color?: string;
  chatbot_text_color?: string;
}

export interface BillingSummary {
  hasSubscription: boolean;
  status: string;
  stripeSubscriptionStatus?: string | null;
  paymentFailedCount?: number;
  planAmount: number | null;
  planCurrency: string;
  planInterval: string | null;
  lastPaymentDate: string | null;
  nextInvoiceDate: string | null;
  accessUntilDate?: string | null;
  cancelAtPeriodEnd: boolean;
  canCancel?: boolean;
  canReactivate?: boolean;
  canResubscribe?: boolean;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

export interface BillingPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}
