import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { CrmService, GestoresService, SiteService, ThemeService, UploadService } from '../../core/api.service';
import { CrmDashboard, CrmDeal, CrmTodayInbox, Gestor, MessageTemplate, SiteSettings } from '../../models';
import { CrmKanbanComponent } from './crm-kanban.component';
import { CrmDealPanelComponent } from './crm-deal-panel.component';
import { CrmTodayInboxComponent } from './crm-today-inbox.component';
import { CrmContactPanelComponent } from './crm-contact-panel.component';
import { PdfDesignerComponent } from './pdf-designer.component';
import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { CrmTeamComponent } from './crm-team.component';
import { FinancesComponent } from './finances.component';
import { PageBuilderComponent } from './page-builder.component';
import { ToastService } from '../../core/toast.service';
import { ColorPickerComponent } from '../../shared/color-picker.component';

type GestorTab = 'dashboard' | 'pipeline' | 'servicios' | 'perfil' | 'plantillas' | 'pdf_designer' | 'team' | 'finanzas' | 'page_builder' | 'ajustes-crm';

@Component({
  selector: 'app-panel-gestor',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent,
    CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, NotificationBellComponent, CrmTeamComponent, FinancesComponent, PageBuilderComponent, ColorPickerComponent
  ],
  templateUrl: './panel-gestor.component.html',
  styleUrl: './panel-dashboard.css',
})
export class PanelGestorComponent implements OnInit {
  tab = signal<GestorTab>('dashboard');
  profile = signal<Gestor | null>(null);
  panelTheme = signal<SiteSettings>({});
  crmDashboard = signal<CrmDashboard | null>(null);
  todayInbox = signal<CrmTodayInbox | null>(null);
  deals = signal<CrmDeal[]>([]);
  templates = signal<MessageTemplate[]>([]);
  selectedDealId = signal<string | null>(null);
  selectedContactId = signal<string | null>(null);
  searchQuery = '';
  filterStage = '';
  editBio = signal(false);
  bio = '';
  googleAnalyticsId = '';
  stripeSecretKey = '';
  stripePublicKey = '';
  aiProvider = '';
  aiApiKey = '';
  chatbotBgColor = '#000000';
  chatbotBtnColor = '#4F46E5';
  chatbotTextColor = '#FFFFFF';
  gestorPhone = '';
  gestorAddress = '';
  gestorMapEmbedUrl = '';
  aiInsights = signal<string[]>([]);
  isAiLoading = signal(false);
  message = signal('');
  newService = { name: '', timeEstimate: '', price: 0, requiredDocumentsStr: '' };
  newTemplate = { name: '', content: '' };
  isMobileMenuOpen = signal(false);

  // CRM Stages Settings
  crmStages: { id: string, label: string }[] = [];
  isSavingStages = false;

  constructor(
    public auth: AuthService,
    private gestoresService: GestoresService,
    private crmService: CrmService,
    private siteService: SiteService,
    private themeService: ThemeService,
    private uploadService: UploadService,
    private http: HttpClient,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.siteService.get('panel-gestor').subscribe(t => {
      this.panelTheme.set(t);
      this.themeService.applyPanel(t);
    });
    this.loadProfile();
    this.loadCrm();

    const user = this.auth.user();
    if (user?.parent_id && user?.permissions && user.permissions.length > 0) {
      if (!user.permissions.includes('dashboard')) {
        this.tab.set(user.permissions[0] as GestorTab);
      }
    }

    if (user?.logo_url) {
      this.profileLogoUrl = user.logo_url;
    }
  }

  hasPerm(mod: string): boolean {
    const user = this.auth.user();
    if (!user) return false;
    if (!user.parent_id) return true; // Boss has all permissions
    return user.permissions?.includes(mod) || false;
  }

  setTab(t: GestorTab) {
    this.tab.set(t);
    if (t === 'dashboard' || t === 'pipeline') this.loadCrm();
    if (t === 'plantillas') this.loadTemplates();
  }

  loadProfile() {
    this.gestoresService.getMyProfile().subscribe(p => {
      this.profile.set(p);
      this.bio = p.bio || '';
      this.gestorPhone = p.phone || '';
      this.gestorAddress = p.address || '';
      this.gestorMapEmbedUrl = p.mapEmbedUrl || '';
    });
    this.auth.getMe().subscribe(res => {
      this.profileLogoUrl = res.user.logo_url || '';
      this.googleAnalyticsId = res.user.google_analytics_id || '';
      this.stripeSecretKey = res.user.stripe_secret_key || '';
      this.stripePublicKey = res.user.stripe_public_key || '';
      this.aiProvider = res.user.ai_provider || '';
      this.aiApiKey = res.user.ai_api_key || '';
      this.chatbotBgColor = res.user.chatbot_bg_color || '#000000';
      this.chatbotBtnColor = res.user.chatbot_btn_color || '#4F46E5';
      this.chatbotTextColor = res.user.chatbot_text_color || '#FFFFFF';
      this.crmStages = res.user.crm_stages ? [...res.user.crm_stages] : [
        { id: 'nuevo', label: 'Nuevo' },
        { id: 'contactado', label: 'Contactado' },
        { id: 'en_tramite', label: 'En trámite' },
        { id: 'documentacion', label: 'Documentación' },
        { id: 'completado', label: 'Completado' },
        { id: 'perdido', label: 'Perdido' }
      ];
    });
  }

  loadCrm() {
    this.crmService.getDashboard().subscribe(d => this.crmDashboard.set(d));
    this.crmService.getToday().subscribe(t => this.todayInbox.set(t));
    this.loadDeals();
    this.crmService.getTemplates().subscribe(t => this.templates.set(t));
    this.loadAiInsights();
  }

  loadAiInsights() {
    this.isAiLoading.set(true);
    this.http.get<{insights: string[]}>(`${environment.apiUrl}/crm/ai/insights`).subscribe({
      next: (res) => {
        this.aiInsights.set(res.insights || []);
        this.isAiLoading.set(false);
      },
      error: () => {
        this.isAiLoading.set(false);
      }
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
    this.loadProfile();
  }

  copyLink() {
    const url = `${window.location.origin}/gestores/${this.profile()?.slug}`;
    navigator.clipboard.writeText(url);
    this.message.set('¡Enlace copiado!');
    setTimeout(() => this.message.set(''), 2000);
  }

  // Phase 3.1 Profile Logo
  profileLogoUrl = '';
  isUploadingLogo = false;

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.isUploadingLogo = true;
    this.uploadService.uploadFile(file).subscribe({
      next: (res: any) => {
        this.profileLogoUrl = res.url;
        this.isUploadingLogo = false;
        this.message.set('Logo subido correctamente, no olvides guardar.');
      },
      error: () => {
        this.isUploadingLogo = false;
        this.message.set('Error al subir la imagen');
      }
    });
  }

  saveBio() {
    this.gestoresService.updateProfile({
      bio: this.bio,
      phone: this.gestorPhone || undefined,
      address: this.gestorAddress || undefined,
      mapEmbedUrl: this.gestorMapEmbedUrl || undefined,
    }).subscribe({
      next: p => {
        this.profile.set({ ...this.profile()!, ...p });

        this.auth.updateMe({
          name: this.profile()?.name,
          logo_url: this.profileLogoUrl,
          google_analytics_id: this.googleAnalyticsId,
          stripe_secret_key: this.stripeSecretKey,
          stripe_public_key: this.stripePublicKey,
          ai_provider: this.aiProvider,
          ai_api_key: this.aiApiKey,
          chatbot_bg_color: this.chatbotBgColor,
          chatbot_btn_color: this.chatbotBtnColor,
          chatbot_text_color: this.chatbotTextColor,
        }).subscribe(() => {
          this.editBio.set(false);
          this.message.set('Perfil actualizado exitosamente');
        });
      },
      error: () => this.message.set('Error al actualizar el perfil'),
    });
  }

  savePageBuilderConfig(config: any) {
    this.auth.updateMe({ page_builder_config: config }).subscribe(() => {
      this.message.set('Diseño de página guardado exitosamente');
      setTimeout(() => this.message.set(''), 3000);
    });
  }

  // CRM Stages Settings Methods
  addCrmStage() {
    this.crmStages.push({ id: `etapa_${Date.now()}`, label: 'Nueva Etapa' });
  }

  removeCrmStage(index: number) {
    if (this.crmStages.length <= 2) {
      alert('Debes tener al menos 2 etapas.');
      return;
    }
    this.crmStages.splice(index, 1);
  }

  moveCrmStageUp(index: number) {
    if (index === 0) return;
    const temp = this.crmStages[index];
    this.crmStages[index] = this.crmStages[index - 1];
    this.crmStages[index - 1] = temp;
  }

  moveCrmStageDown(index: number) {
    if (index === this.crmStages.length - 1) return;
    const temp = this.crmStages[index];
    this.crmStages[index] = this.crmStages[index + 1];
    this.crmStages[index + 1] = temp;
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

  addService() {
    if (!this.newService.name || !this.newService.timeEstimate) return;
    const docs = this.newService.requiredDocumentsStr.split(',').map(s => s.trim()).filter(Boolean);
    const payload: any = { name: this.newService.name, timeEstimate: this.newService.timeEstimate, price: this.newService.price };
    if (docs.length > 0) payload.required_documents = docs;
    
    this.gestoresService.addService(payload).subscribe({
      next: () => {
        this.newService = { name: '', timeEstimate: '', price: 0, requiredDocumentsStr: '' };
        this.loadProfile();
        this.message.set('Servicio agregado');
      },
    });
  }

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

  initials(name?: string) {
    return (name || 'GL').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
