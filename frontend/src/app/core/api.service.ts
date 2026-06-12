import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  AdminStats, Auto, AutoInquiry, AutoStatus, ConcesionariaDashboard, DealerProfile,
  CrmContact, CrmContact360, CrmDashboard, CrmDeal, CrmTodayInbox, CrmTask, CrmDocument, DealerReview, Gestor, MakeFilter, ManagedUser,
  MessageTemplate, SiteSettings, StateFilter, FinTransaction, FinDashboard
} from '../models';

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
  deleteService(id: string) { return this.http.delete(`${this.base}/me/services/${id}`); }
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
  getDeals(filters?: { q?: string; stage?: string }) {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.stage) params = params.set('stage', filters.stage);
    return this.http.get<CrmDeal[]>(`${this.base}/deals`, { params });
  }
  getDeal(id: string) { return this.http.get<CrmDeal>(`${this.base}/deals/${id}`); }
  updateDeal(id: string, data: { stage?: string; internalNotes?: string; estimatedValue?: number; lostReason?: string }) {
    return this.http.patch<CrmDeal>(`${this.base}/deals/${id}`, data);
  }
  addActivity(dealId: string, content: string, activityType = 'note') {
    return this.http.post(`${this.base}/deals/${dealId}/activities`, { content, activityType });
  }
  replyDeal(dealId: string, reply: string) {
    return this.http.post(`${this.base}/deals/${dealId}/reply`, { reply });
  }
  getContacts() { return this.http.get<CrmContact[]>(`${this.base}/contacts`); }
  getContact(id: string) { return this.http.get<CrmContact360>(`${this.base}/contacts/${id}`); }
  updateContact(id: string, data: Partial<CrmContact>) {
    return this.http.patch<CrmContact>(`${this.base}/contacts/${id}`, data);
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
  createQuote(dealId: string, data: any) {
    return this.http.post<{ id: string }>(`${this.base}/deals/${dealId}/quotes`, data);
  }
  downloadQuotePdf(quoteId: string) {
    return this.http.get(`${this.base}/quotes/${quoteId}/pdf`, { responseType: 'blob' });
  }

  // Phase 3.2: Documents
  getDocuments(dealId: string) {
    return this.http.get<CrmDocument[]>(`${this.base}/deals/${dealId}/documents`);
  }
  addDocument(dealId: string, data: { fileName: string, fileUrl: string }) {
    return this.http.post<CrmDocument>(`${this.base}/deals/${dealId}/documents`, data);
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
  getManagedUsers(role?: 'gestor' | 'concesionaria') {
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
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private base = `${environment.apiUrl}/site`;
  constructor(private http: HttpClient) {}

  get(pageKey: string) { return this.http.get<SiteSettings>(`${this.base}/${pageKey}`); }
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private base = `${environment.apiUrl}/upload`;
  constructor(private http: HttpClient) {}

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(this.base, formData);
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  apply(settings: SiteSettings) {
    const root = document.documentElement;
    if (settings.primaryColor) root.style.setProperty('--gold', settings.primaryColor);
    if (settings.accentColor) root.style.setProperty('--mx-green', settings.accentColor);
    if (settings.backgroundColor) root.style.setProperty('--bg', settings.backgroundColor);
    if (settings.fontFamily) {
      root.style.setProperty('--f-body', settings.fontFamily);
      root.style.setProperty('--f-ui', settings.fontFamily);
    }
    if (settings.displayFont) root.style.setProperty('--f-display', settings.displayFont);
    if (settings.titleSize) root.style.setProperty('--page-title-size', `${settings.titleSize}px`);
    if (settings.subtitleSize) root.style.setProperty('--page-subtitle-size', `${settings.subtitleSize}px`);
    if (settings.cardRadius) root.style.setProperty('--card-radius', `${settings.cardRadius}px`);
  }

  applyPanel(settings: SiteSettings) {
    this.apply(settings);
    const root = document.documentElement;
    if (settings.sidebarBg) root.style.setProperty('--panel-sidebar-bg', settings.sidebarBg);
    if (settings.cardBg) root.style.setProperty('--panel-card-bg', settings.cardBg);
    if (settings.primaryColor) root.style.setProperty('--panel-accent', settings.primaryColor);
    if (settings.backgroundColor) root.style.setProperty('--panel-bg', settings.backgroundColor);
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

  getTransactions(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<FinTransaction[]>(this.base, { params });
  }

  createTransaction(data: Partial<FinTransaction>) {
    return this.http.post<{ id: string }>(this.base, data);
  }

  deleteTransaction(id: string) { return this.http.delete(`${this.base}/${id}`); }

  getPendingDeals() { return this.http.get<any[]>(`${this.base}/deals/pending`); }

  getPaymentMethods() { return this.http.get<{ methods: string[] }>(`${this.base}/payment-methods`); }

  savePaymentMethods(methods: (string | { id: string; label: string; icon: string })[]) {
    return this.http.put<{ success: boolean }>(`${this.base}/payment-methods`, { methods });
  }

  exportCsv(from?: string, to?: string): string {
    const token = localStorage.getItem('tramites_token') || '';
    let url = `${this.base}/export/csv?token=${token}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return url;
  }

  exportPdf(from?: string, to?: string): string {
    const token = localStorage.getItem('tramites_token') || '';
    let url = `${this.base}/export/pdf?token=${token}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return url;
  }
}

