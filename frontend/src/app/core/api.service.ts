import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  AdminStats, Auto, AutoInquiry, AutoPrivateDocument, AutoStatus, ConcesionariaDashboard, DealerProfile,
  CrmContact, CrmContact360, CrmContactVehicle, CrmContactVehicleDocument, CrmContactsPage, CrmVerificationAlert, CrmDashboard, CrmDeal, CrmTeamMember, CrmTeamPerformance, CrmTodayInbox, CrmTask, CrmDocument, DealerReview, Gestor, GestorReview, MakeFilter, ManagedUser,
  PeritoAccount, PeritoAssignOption, PeritoDeal, PeritoDealDetail, PeritoOverviewItem, PeritoPerformance,
  MessageTemplate, SiteSettings, StateFilter, SupportMessage, SupportThread, FinTransaction, FinDashboard, BillingSummary, BillingInvoice, BillingPaymentMethod
} from '../models';
import { resolveThemeFont } from '../shared/theme-fonts';

@Injectable({ providedIn: 'root' })
export class GestoresService {
  private base = `${environment.apiUrl}/gestores`;
  constructor(private http: HttpClient) {}

  list(filters?: { state?: string; minRating?: number }) {
    let params = new HttpParams();
    if (filters?.state) params = params.set('state', filters.state);
    if (filters?.minRating) params = params.set('minRating', filters.minRating);
    return this.http.get<Gestor[]>(this.base, { params });
  }

  getStates() { return this.http.get<StateFilter[]>(`${this.base}/filters/states`); }
  getBySlug(slug: string) { return this.http.get<Gestor>(`${this.base}/${slug}`); }
  getMyProfile() { return this.http.get<Gestor>(`${this.base}/me/profile`); }
  updateProfile(data: Partial<Gestor>) { return this.http.put<Gestor>(`${this.base}/me/profile`, data); }
  addService(data: { name: string; timeEstimate: string; price: number; required_documents?: string[] }) { return this.http.post(`${this.base}/me/services`, data); }
  reorderServices(order: string[]) {
    return this.http.put<{ ok: boolean; services: import('../models').GestorService[] }>(`${this.base}/me/services/order`, { order });
  }
  deleteService(id: string) { return this.http.delete(`${this.base}/me/services/${id}`); }
  getMyReviews() {
    return this.http.get<{ reviews: GestorReview[]; rating: number; reviewCount: number }>(`${this.base}/me/reviews`);
  }
  createReview(data: { author: string; rating: number; comment: string; reviewDate?: string }) {
    return this.http.post<{ review: GestorReview; rating: number; reviewCount: number }>(`${this.base}/me/reviews`, data);
  }
  updateReview(id: string, data: { author: string; rating: number; comment: string; reviewDate?: string }) {
    return this.http.put<{ review: GestorReview; rating: number; reviewCount: number }>(`${this.base}/me/reviews/${id}`, data);
  }
  deleteReview(id: string) {
    return this.http.delete<{ ok: boolean; rating: number; reviewCount: number }>(`${this.base}/me/reviews/${id}`);
  }
  updateSolicitud(id: string, status: string) { return this.http.patch(`${this.base}/me/solicitudes/${id}`, { status }); }
  createSolicitud(gestorId: string, data: { clientName: string; serviceName: string; location?: string; clientEmail?: string; clientPhone?: string; customData?: any; }) {
    return this.http.post(`${this.base}/${gestorId}/solicitudes`, data);
  }
  trackSolicitud(slugOrId: string, code: string) {
    return this.http.get<{ title: string; stage: string; updatedAt: string, stages?: { id: string, label: string }[] }>(`${this.base}/${slugOrId}/track/${code}`);
  }
  getReviewContext(dealId: string) {
    return this.http.get<{ title: string; gestorName: string; gestorId: string }>(`${this.base}/review-context/${dealId}`);
  }
  submitReview(dealId: string, data: { rating: number; comment: string; authorName: string }) {
    return this.http.post<{ success: boolean }>(`${this.base}/review/${dealId}`, data);
  }
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private base = `${environment.apiUrl}/crm`;
  constructor(private http: HttpClient) {}

  getDashboard() { return this.http.get<CrmDashboard>(`${this.base}/dashboard`); }

  request<T = any>(method: string, endpoint: string, body?: any) {
    return this.http.request<T>(method, `${this.base}${endpoint}`, { body });
  }

  getToday() { return this.http.get<CrmTodayInbox>(`${this.base}/today`); }
  getDeals(filters?: { q?: string; stage?: string; assignedTo?: string }) {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.stage) params = params.set('stage', filters.stage);
    if (filters?.assignedTo) params = params.set('assignedTo', filters.assignedTo);
    return this.http.get<CrmDeal[]>(`${this.base}/deals`, { params });
  }
  getTeam() { return this.http.get<CrmTeamMember[]>(`${this.base}/team`); }
  getTeamPerformance() { return this.http.get<CrmTeamPerformance[]>(`${this.base}/team/performance`); }
  createDeal(data: {
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    title?: string;
    autoId?: string;
    serviceName?: string;
    location?: string;
    message?: string;
    estimatedValue?: number;
    stage?: string;
  }) {
    return this.http.post<CrmDeal>(`${this.base}/deals`, data);
  }
  getDeal(id: string) { return this.http.get<CrmDeal>(`${this.base}/deals/${id}`); }
  updateDeal(id: string, data: { stage?: string; internalNotes?: string; estimatedValue?: number; lostReason?: string; assignedTo?: string | null; peritoId?: string | null }) {
    return this.http.patch<CrmDeal>(`${this.base}/deals/${id}`, data);
  }
  getPeritos() { return this.http.get<PeritoAccount[]>(`${this.base}/peritos`); }
  createPerito(data: { name: string; email: string; password: string }) {
    return this.http.post<{ id: string }>(`${this.base}/peritos`, data);
  }
  updatePerito(id: string, data: { name?: string; password?: string }) {
    return this.http.put<{ ok: boolean }>(`${this.base}/peritos/${id}`, data);
  }
  deletePerito(id: string) { return this.http.delete<{ ok: boolean }>(`${this.base}/peritos/${id}`); }
  getPeritosForAssign() { return this.http.get<PeritoAssignOption[]>(`${this.base}/peritos/list-assign`); }
  getPeritoPerformance() { return this.http.get<PeritoPerformance[]>(`${this.base}/peritos/performance`); }
  getPeritoOverview() { return this.http.get<PeritoOverviewItem[]>(`${this.base}/peritos/overview`); }
  registerManualPayment(dealId: string, data: { amount: number; paymentMethod: string; notes?: string }) {
    return this.http.post<CrmDeal>(`${this.base}/deals/${dealId}/register-payment`, data);
  }
  addActivity(dealId: string, content: string, activityType = 'note') {
    return this.http.post(`${this.base}/deals/${dealId}/activities`, { content, activityType });
  }
  replyDeal(dealId: string, reply: string) {
    return this.http.post(`${this.base}/deals/${dealId}/reply`, { reply });
  }
  getContacts(params?: {
    page?: number;
    limit?: number;
    q?: string;
    tramite?: string;
    engomado?: string;
    estado?: string;
  }) {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.tramite) httpParams = httpParams.set('tramite', params.tramite);
    if (params?.engomado) httpParams = httpParams.set('engomado', params.engomado);
    if (params?.estado) httpParams = httpParams.set('estado', params.estado);
    return this.http.get<CrmContactsPage>(`${this.base}/contacts`, { params: httpParams });
  }
  createContact(data: {
    name: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    notes?: string;
    residenceState?: string;
  }) {
    return this.http.post<CrmContact>(`${this.base}/contacts`, data);
  }
  getContact(id: string) { return this.http.get<CrmContact360>(`${this.base}/contacts/${id}`); }
  updateContact(id: string, data: Partial<CrmContact> & { residenceState?: string }) {
    return this.http.patch<CrmContact>(`${this.base}/contacts/${id}`, data);
  }
  addContactVehicle(contactId: string, data: {
    plate: string;
    make?: string;
    model?: string;
    year?: number | null;
    state?: string;
    engomadoColor?: string;
    vehicleNotes?: string;
    insuranceExpiry?: string | null;
    tenenciaStatus?: string | null;
  }) {
    return this.http.post<CrmContactVehicle>(`${this.base}/contacts/${contactId}/vehicles`, data);
  }
  updateContactVehicle(vehicleId: string, data: Partial<{
    plate: string;
    make: string;
    model: string;
    year: number | null;
    state: string;
    engomadoColor: string;
    vehicleNotes: string;
    insuranceExpiry: string | null;
    tenenciaStatus: string | null;
  }>) {
    return this.http.patch<CrmContactVehicle>(`${this.base}/contact-vehicles/${vehicleId}`, data);
  }
  deleteContactVehicle(vehicleId: string) {
    return this.http.delete(`${this.base}/contact-vehicles/${vehicleId}`);
  }
  addContactVehicleDocument(vehicleId: string, data: { fileName: string; fileUrl: string; label?: string }) {
    return this.http.post<CrmContactVehicleDocument>(`${this.base}/contact-vehicles/${vehicleId}/documents`, data);
  }
  updateContactVehicleDocument(docId: string, label: string) {
    return this.http.patch<CrmContactVehicleDocument>(`${this.base}/contact-vehicle-documents/${docId}`, { label });
  }
  deleteContactVehicleDocument(docId: string) {
    return this.http.delete(`${this.base}/contact-vehicle-documents/${docId}`);
  }
  getVerificationAlerts() {
    return this.http.get<CrmVerificationAlert[]>(`${this.base}/verification-alerts`);
  }
  createTask(dealId: string, title: string, dueAt: string) {
    return this.http.post(`${this.base}/deals/${dealId}/tasks`, { title, dueAt });
  }
  updateTask(taskId: string, data: { completed?: boolean; title?: string; dueAt?: string }) {
    return this.http.patch(`${this.base}/tasks/${taskId}`, data);
  }
  deleteTask(taskId: string) { return this.http.delete(`${this.base}/tasks/${taskId}`); }
  getTemplates() { return this.http.get<MessageTemplate[]>(`${this.base}/templates`); }
  createTemplate(name: string, content: string) {
    return this.http.post<MessageTemplate>(`${this.base}/templates`, { name, content });
  }
  deleteTemplate(id: string) { return this.http.delete(`${this.base}/templates/${id}`); }

  // Phase 3.1: Quotes
  getQuotes(dealId: string) {
    return this.http.get<any[]>(`${this.base}/deals/${dealId}/quotes`);
  }
  getQuoteBootstrap(dealId: string) {
    return this.http.get<{
      templates: { includes: string[]; requirements: string[]; bonus: string[] };
      service: { required_documents: string[]; includes: string[]; bonus: string[]; price: number | null } | null;
      defaults: { includes: { text: string; checked: boolean }[]; requirements: { text: string; checked: boolean }[]; bonus: { text: string; checked: boolean }[] };
    }>(`${this.base}/deals/${dealId}/quote-bootstrap`);
  }
  getQuoteTemplates() {
    return this.http.get<{ includes: string[]; requirements: string[]; bonus: string[] }>(`${this.base}/quote-templates`);
  }
  saveQuoteTemplates(data: { includes: string[]; requirements: string[]; bonus: string[] }) {
    return this.http.put<{ includes: string[]; requirements: string[]; bonus: string[] }>(`${this.base}/quote-templates`, data);
  }
  createQuote(dealId: string, data: any) {
    return this.http.post<{ id: string }>(`${this.base}/deals/${dealId}/quotes`, data);
  }
  updateQuote(quoteId: string, data: any) {
    return this.http.patch<any>(`${this.base}/quotes/${quoteId}`, data);
  }
  downloadQuotePdf(quoteId: string) {
    return this.http.get(`${this.base}/quotes/${quoteId}/pdf`, { responseType: 'blob' });
  }

  // Phase 3.2: Documents
  getDocuments(dealId: string) {
    return this.http.get<CrmDocument[]>(`${this.base}/deals/${dealId}/documents`);
  }
  addDocument(dealId: string, data: { fileName: string; fileUrl: string; notes?: string; docKind?: 'attachment' | 'cotizacion' | 'entrega' | 'envio' }) {
    return this.http.post<CrmDocument>(`${this.base}/deals/${dealId}/documents`, {
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      notes: data.notes,
      docKind: data.docKind,
    });
  }
  deleteDocument(docId: string) {
    return this.http.delete(`${this.base}/documents/${docId}`);
  }

  // Notificaciones
  getNotifications() { return this.http.get<any[]>(`${this.base}/notifications`); }
  markNotificationRead(id: string) { return this.http.patch(`${this.base}/notifications/${id}/read`, {}); }
  markAllNotificationsRead() { return this.http.patch(`${this.base}/notifications/read-all`, {}); }

  // Pagos
  generatePaymentLink(dealId: string) {
    return this.http.post<{ url: string }>(`${this.base}/deals/${dealId}/checkout`, {});
  }
  getPaymentProviders() {
    return this.http.get<{ stripe: boolean; mercadopago: boolean }>(`${this.base}/payment-providers`);
  }
}

@Injectable({ providedIn: 'root' })
export class AutosService {
  private base = `${environment.apiUrl}/autos`;
  constructor(private http: HttpClient) {}

  list(filters?: { make?: string; minPrice?: number; maxPrice?: number }) {
    let params = new HttpParams();
    if (filters?.make) params = params.set('make', filters.make);
    if (filters?.maxPrice) params = params.set('maxPrice', filters.maxPrice);
    params = params.set('_t', Date.now().toString());
    return this.http.get<Auto[]>(this.base, { params });
  }

  getMakes() { return this.http.get<MakeFilter[]>(`${this.base}/filters/makes`); }
  getById(id: string) { return this.http.get<Auto>(`${this.base}/${id}?_t=${Date.now()}`); }
  getMyInventory(status?: AutoStatus) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Auto[]>(`${this.base}/me/inventory`, { params });
  }
  create(data: Partial<Auto> & { status?: AutoStatus }) { return this.http.post<Auto>(this.base, data); }
  update(id: string, data: Partial<Auto> & { status?: AutoStatus }) { return this.http.put<Auto>(`${this.base}/${id}`, data); }
  setStatus(id: string, status: AutoStatus) { return this.http.patch<Auto>(`${this.base}/${id}/status`, { status }); }
  delete(id: string) { return this.http.delete(`${this.base}/${id}`); }
  getPrivateDocuments(autoId: string) {
    return this.http.get<AutoPrivateDocument[]>(`${this.base}/${autoId}/private-documents`);
  }
  addPrivateDocument(autoId: string, data: { label: string; fileUrl: string; fileName?: string; notes?: string }) {
    return this.http.post<AutoPrivateDocument>(`${this.base}/${autoId}/private-documents`, data);
  }
  deletePrivateDocument(autoId: string, docId: string) {
    return this.http.delete(`${this.base}/${autoId}/private-documents/${docId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ConcesionariaService {
  private base = `${environment.apiUrl}/concesionaria`;
  constructor(private http: HttpClient) {}

  getDashboard() { return this.http.get<ConcesionariaDashboard>(`${this.base}/me/dashboard`); }
  getInquiries() { return this.http.get<AutoInquiry[]>(`${this.base}/me/inquiries`); }
  replyInquiry(id: string, reply: string) { return this.http.patch(`${this.base}/me/inquiries/${id}`, { reply, status: 'respondido' }); }
  getReviews() { return this.http.get<{ reviews: DealerReview[]; rating: number; reviewCount: number }>(`${this.base}/me/reviews`); }
  sendInquiry(data: { autoId: string; clientName: string; clientEmail?: string; clientPhone?: string; message: string }) {
    return this.http.post(`${this.base}/inquiries`, data);
  }


  sendReview(data: { userId: string; author: string; rating: number; comment: string }) {
    return this.http.post(`${this.base}/reviews`, data);
  }
  // Public dealer profile
  getDealerBySlug(slug: string) { return this.http.get<DealerProfile>(`${this.base}/public/${slug}`); }
  getDealerAutos(slug: string, filters?: { q?: string; make?: string; minPrice?: number; maxPrice?: number }) {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.make) params = params.set('make', filters.make);
    if (filters?.minPrice) params = params.set('minPrice', filters.minPrice);
    if (filters?.maxPrice) params = params.set('maxPrice', filters.maxPrice);
    return this.http.get<Auto[]>(`${this.base}/public/${slug}/autos`, { params });
  }
  chatWithDealer(slug: string, message: string, history: { role: string; content: string }[]) {
    return this.http.post<{ reply: string }>(`${this.base}/public/${slug}/chat`, { message, history });
  }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiUrl}/admin`;
  constructor(private http: HttpClient) {}

  getStats() { return this.http.get<AdminStats>(`${this.base}/stats`); }
  getUsers() { return this.http.get(`${this.base}/users`); }
  getManagedUsers(role?: 'gestor' | 'concesionaria' | 'cliente') {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<ManagedUser[]>(`${this.base}/users/managed`, { params });
  }
  resetPassword(userId: string, newPassword: string) {
    return this.http.patch(`${this.base}/users/${userId}/password`, { newPassword });
  }
  updateUser(userId: string, data: Record<string, unknown>) {
    return this.http.put<{ user: import('../models').User }>(`${this.base}/users/${userId}`, data);
  }

  getOrgStats(orgId: string) {
    return this.http.get<{ clientsCount: number; openDealsCount: number; totalBilled: number }>(`${this.base}/orgs/${orgId}/stats`);
  }
  
  getOrgDeals(orgId: string) {
    return this.http.get<any[]>(`${this.base}/orgs/${orgId}/deals`);
  }

  getDealMessages(dealId: string) {
    return this.http.get<any[]>(`${this.base}/deals/${dealId}/messages`);
  }

  updateMyProfile(data: Record<string, unknown>) {
    return this.http.patch<{ user: import('../models').User }>(`${environment.apiUrl}/auth/me`, data);
  }

  getAllSiteSettings() { return this.http.get<SiteSettings[]>(`${this.base}/site`); }
  saveSiteSettings(pageKey: string, settings: SiteSettings) { return this.http.put<SiteSettings>(`${this.base}/site/${pageKey}`, settings); }

  getAnalyticsConfig() { return this.http.get<import('../models').AnalyticsConfig & { oauthConfigured: boolean }>(`${this.base}/analytics/config`); }
  saveAnalyticsConfig(data: {
    measurementId?: string;
    propertyId?: string;
    googleClientId?: string;
    googleClientSecret?: string;
  }) {
    return this.http.put<import('../models').AnalyticsConfig>(`${this.base}/analytics/config`, data);
  }
  getAnalyticsOAuthUrl() { return this.http.get<{ url: string }>(`${this.base}/analytics/oauth/url`); }
  getAnalyticsProperties() { return this.http.get<import('../models').GaProperty[]>(`${this.base}/analytics/properties`); }
  getAnalyticsDashboard(days = 30) {
    return this.http.get<import('../models').AnalyticsDashboard>(`${this.base}/analytics/dashboard`, {
      params: new HttpParams().set('days', String(days)),
    });
  }
  disconnectAnalytics() { return this.http.delete<import('../models').AnalyticsConfig>(`${this.base}/analytics/disconnect`); }
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private base = `${environment.apiUrl}/support`;
  constructor(private http: HttpClient) {}

  getThreads(role?: SupportThread['role']) {
    const params = role ? new HttpParams().set('role', role) : undefined;
    return this.http.get<SupportThread[]>(`${this.base}/threads`, { params });
  }

  getMyMessages() {
    return this.http.get<SupportMessage[]>(`${this.base}/messages`);
  }

  getMessages(clientId: string) {
    return this.http.get<SupportMessage[]>(`${this.base}/messages/${clientId}`);
  }

  sendMyMessage(data: { message?: string; fileUrl?: string }) {
    return this.http.post<SupportMessage>(`${this.base}/messages`, data);
  }

  sendMessage(clientId: string, data: { message?: string; fileUrl?: string }) {
    return this.http.post<SupportMessage>(`${this.base}/messages/${clientId}`, data);
  }

  getUnread() {
    return this.http.get<{ unread: number }>(`${this.base}/unread`);
  }
}

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private base = `${environment.apiUrl}/knowledge`;
  constructor(private http: HttpClient) {}

  listAdmin() {
    return this.http.get<import('../models').KnowledgePost[]>(`${this.base}/admin`);
  }

  create(data: Partial<import('../models').KnowledgePost>) {
    return this.http.post<import('../models').KnowledgePost>(`${this.base}/admin`, data);
  }

  update(id: string, data: Partial<import('../models').KnowledgePost>) {
    return this.http.put<import('../models').KnowledgePost>(`${this.base}/admin/${id}`, data);
  }

  remove(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/admin/${id}`);
  }

  feed(page = 1, limit = 5) {
    return this.http.get<import('../models').KnowledgeFeedPage>(`${this.base}/feed`, {
      params: { page: String(page), limit: String(limit) },
    });
  }

  getById(id: string) {
    return this.http.get<import('../models').KnowledgePost>(`${this.base}/${id}`);
  }

  toggleLike(id: string) {
    return this.http.post<{ likedByMe: boolean; likesCount: number }>(`${this.base}/${id}/like`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private base = `${environment.apiUrl}/site`;
  constructor(private http: HttpClient) {}

  get(pageKey: string) { return this.http.get<SiteSettings>(`${this.base}/${pageKey}`); }
}

export const CHAT_ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private base = `${environment.apiUrl}/upload`;
  constructor(private http: HttpClient) {}

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(this.base, formData);
  }

  uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; fileName: string }>(`${this.base}/document`, formData);
  }

  uploadChatAttachment(file: File) {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    return isImage ? this.uploadFile(file) : this.uploadDocument(file);
  }

  uploadVideo(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; fileName: string }>(`${this.base}/video`, formData);
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  apply(settings: SiteSettings) {
    const root = document.documentElement;
    if (settings.primaryColor) root.style.setProperty('--gold', settings.primaryColor);
    if (settings.accentColor) root.style.setProperty('--mx-green', settings.accentColor);
    if (settings.backgroundColor) root.style.setProperty('--bg', settings.backgroundColor);
    const bodyFont = resolveThemeFont(settings.fontFamily);
    const displayFont = resolveThemeFont(settings.displayFont);
    root.style.setProperty('--f-body', bodyFont);
    root.style.setProperty('--f-ui', bodyFont);
    root.style.setProperty('--f-display', displayFont);
    if (settings.titleSize) root.style.setProperty('--page-title-size', `${settings.titleSize}px`);
    if (settings.subtitleSize) root.style.setProperty('--page-subtitle-size', `${settings.subtitleSize}px`);
    if (settings.cardRadius) root.style.setProperty('--card-radius', `${settings.cardRadius}px`);
  }

  applyPanel(settings: SiteSettings) {
    this.apply(settings);
    this.applyPanelToElement(document.documentElement, settings);
  }

  applyToElement(el: HTMLElement, settings: SiteSettings, panel = false) {
    this.applyToElementBase(el, settings);
    if (panel) this.applyPanelToElement(el, settings);
  }

  private applyToElementBase(el: HTMLElement, settings: SiteSettings) {
    if (settings.primaryColor) el.style.setProperty('--gold', settings.primaryColor);
    if (settings.accentColor) el.style.setProperty('--mx-green', settings.accentColor);
    if (settings.backgroundColor) el.style.setProperty('--bg', settings.backgroundColor);
    const bodyFont = resolveThemeFont(settings.fontFamily);
    const displayFont = resolveThemeFont(settings.displayFont);
    el.style.setProperty('--f-body', bodyFont);
    el.style.setProperty('--f-ui', bodyFont);
    el.style.setProperty('--f-display', displayFont);
    if (settings.titleSize) el.style.setProperty('--page-title-size', `${settings.titleSize}px`);
    if (settings.subtitleSize) el.style.setProperty('--page-subtitle-size', `${settings.subtitleSize}px`);
    if (settings.cardRadius) el.style.setProperty('--card-radius', `${settings.cardRadius}px`);
  }

  private applyPanelToElement(el: HTMLElement, settings: SiteSettings) {
    if (settings.sidebarBg) el.style.setProperty('--panel-sidebar-bg', settings.sidebarBg);
    if (settings.cardBg) el.style.setProperty('--panel-card-bg', settings.cardBg);
    if (settings.primaryColor) el.style.setProperty('--panel-accent', settings.primaryColor);
    if (settings.backgroundColor) el.style.setProperty('--panel-bg', settings.backgroundColor);
  }
}

@Injectable({ providedIn: 'root' })
export class FinancesService {
  private base = `${environment.apiUrl}/finances`;
  constructor(private http: HttpClient) {}

  getDashboard(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<FinDashboard>(`${this.base}/dashboard`, { params });
  }

  getTransactions(opts?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    payment_method?: string;
    deal_id?: string;
  }) {
    let params = new HttpParams();
    if (opts?.from) params = params.set('from', opts.from);
    if (opts?.to) params = params.set('to', opts.to);
    if (opts?.page) params = params.set('page', String(opts.page));
    if (opts?.limit) params = params.set('limit', String(opts.limit));
    if (opts?.payment_method) params = params.set('payment_method', opts.payment_method);
    if (opts?.deal_id) params = params.set('deal_id', opts.deal_id);
    return this.http.get<import('../models').FinTransactionsPage>(this.base, { params });
  }

  getFilterOptions(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<import('../models').FinFilterOptions>(`${this.base}/filter-options`, { params });
  }

  createTransaction(data: Partial<FinTransaction> & { auto_id?: string }) {
    return this.http.post<{ id: string }>(this.base, data);
  }

  deleteTransaction(id: string) { return this.http.delete(`${this.base}/${id}`); }

  getPendingDeals() { return this.http.get<any[]>(`${this.base}/deals/pending`); }

  getPaymentMethods() {
    return this.http.get<{ methods: (string | { id: string; label?: string; icon?: string; enabled?: boolean })[] }>(`${this.base}/payment-methods`);
  }

  savePaymentMethods(methods: (string | { id: string; label?: string; icon?: string; enabled?: boolean })[]) {
    return this.http.put<{ success: boolean; methods: typeof methods }>(`${this.base}/payment-methods`, { methods });
  }

  exportCsv(from?: string, to?: string, paymentMethod?: string, dealId?: string): string {
    const token = localStorage.getItem('tramites_token') || '';
    let url = `${this.base}/export/csv?token=${token}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;
    if (paymentMethod) url += `&payment_method=${encodeURIComponent(paymentMethod)}`;
    if (dealId) url += `&deal_id=${encodeURIComponent(dealId)}`;
    return url;
  }

  exportPdf(from?: string, to?: string, paymentMethod?: string, dealId?: string): string {
    const token = localStorage.getItem('tramites_token') || '';
    let url = `${this.base}/export/pdf?token=${token}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;
    if (paymentMethod) url += `&payment_method=${encodeURIComponent(paymentMethod)}`;
    if (dealId) url += `&deal_id=${encodeURIComponent(dealId)}`;
    return url;
  }
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private base = `${environment.apiUrl}/billing`;
  constructor(private http: HttpClient) {}

  getSummary() { return this.http.get<BillingSummary>(`${this.base}/summary`); }
  getInvoices() { return this.http.get<{ invoices: BillingInvoice[] }>(`${this.base}/invoices`); }
  getPaymentMethods() { return this.http.get<{ methods: BillingPaymentMethod[]; defaultPaymentMethodId: string | null }>(`${this.base}/payment-methods`); }
  createSetupIntent() { return this.http.post<{ clientSecret: string; publishableKey: string }>(`${this.base}/setup-intent`, {}); }
  deletePaymentMethod(id: string) { return this.http.delete<{ success: boolean }>(`${this.base}/payment-methods/${id}`); }
  setDefaultPaymentMethod(id: string) { return this.http.put<{ success: boolean }>(`${this.base}/payment-methods/${id}/default`, {}); }
  cancelSubscription() { return this.http.post<BillingSummary>(`${this.base}/cancel-subscription`, {}); }
  reactivateSubscription() { return this.http.post<BillingSummary>(`${this.base}/reactivate-subscription`, {}); }
  resubscribe() { return this.http.post<{ success: boolean; checkoutUrl?: string }>(`${this.base}/resubscribe`, {}); }
}

@Injectable({ providedIn: 'root' })
export class PeritoService {
  private base = `${environment.apiUrl}/perito`;
  constructor(private http: HttpClient) {}

  getStages() {
    return this.http.get<{ id: string; label: string }[]>(`${this.base}/stages`);
  }

  getDeals() {
    return this.http.get<{ stages: { id: string; label: string }[]; deals: PeritoDeal[] }>(`${this.base}/deals`);
  }

  getDeal(id: string) {
    return this.http.get<PeritoDealDetail>(`${this.base}/deals/${id}`);
  }

  updateStage(dealId: string, stage: string) {
    return this.http.patch<{ ok: boolean; peritoStage: string; label: string }>(`${this.base}/deals/${dealId}/stage`, { stage });
  }

  updatePolizaStatus(dealId: string, status: 'pendiente' | 'pagado') {
    return this.http.patch<{ ok: boolean; peritoPolizaStatus: string }>(`${this.base}/deals/${dealId}/poliza-status`, { status });
  }

  addNote(dealId: string, note: string) {
    return this.http.post<{ id: string; note: string; createdAt: string }>(`${this.base}/deals/${dealId}/notes`, { note });
  }

  addUpload(dealId: string, data: { docType: string; fileUrl: string; fileName?: string }) {
    return this.http.post(`${this.base}/deals/${dealId}/uploads`, data);
  }

  deleteUpload(uploadId: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/uploads/${uploadId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class MpService {
  private base = `${environment.apiUrl}/mp`;
  constructor(private http: HttpClient) {}

  generateLink(dealId: string) {
    return this.http.post<{ url: string }>(`${this.base}/generate-link/${dealId}`, {});
  }

  getPaymentInfo(token: string) {
    return this.http.get<{ publicKey: string; amount: number; description: string; gestorName: string }>(`${this.base}/payment-info/${token}`);
  }

  processPayment(token: string, body: {
    cardToken: string;
    paymentMethodId: string;
    payerEmail: string;
    installments?: number;
    identificationType?: string;
    identificationNumber?: string;
  }) {
    return this.http.post<{ success: boolean; status: string; orderId?: string; requiresAction?: boolean; actionUrl?: string; message?: string }>(`${this.base}/process-payment/${token}`, body);
  }
}

