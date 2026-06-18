import { Component, OnInit, signal, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
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
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { PanelUserMenuComponent } from './panel-user-menu.component';
import { PanelSubscriptionLockComponent } from './panel-subscription-lock.component';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

type GestorTab = 'dashboard' | 'pipeline' | 'servicios' | 'perfil' | 'plantillas' | 'pdf_designer' | 'team' | 'finanzas' | 'page_builder' | 'ajustes-crm' | 'automatizaciones';

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

const DEFAULT_GESTOR_STAGES: { id: string; label: string }[] = [
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
    RouterLink, FormsModule, DecimalPipe, CrmKanbanComponent, CrmDealPanelComponent,
    CrmTodayInboxComponent, CrmContactPanelComponent, PdfDesignerComponent, NotificationBellComponent, CrmTeamComponent, FinancesComponent, PageBuilderComponent, PanelColorPaletteComponent, AiAssistantComponent, PanelUserMenuComponent, PanelSubscriptionLockComponent
  ],
  templateUrl: './panel-gestor.component.html',
  styleUrl: './panel-dashboard.css',
})
export class PanelGestorComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

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
  stripePublicKey = '';
  stripeSecretKey = '';

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
  gestorPhone = '';
  gestorAddress = '';
  gestorMapEmbedUrl = '';
  aiInsights = signal<string[]>(DEFAULT_AI_TIPS);
  isAiLoading = signal(false);
  message = signal('');
  newService = { name: '', timeEstimate: '', price: 0, requiredDocumentsStr: '' };
  newTemplate = { name: '', content: '' };
  automations = signal<any[]>([]);
  newAutomation = { name: '', trigger_event: 'stage_change', trigger_stage: '', trigger_delay_days: 3, action_type: 'send_email', action_content: '' };
  readonly automationVariables = AUTOMATION_VARIABLES;
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
    this.auth.getMe().subscribe();
    this.siteService.get('panel-gestor').subscribe(t => {
      this.panelTheme.set(t);
    });
    this.loadProfile();
    this.loadCrm();
    this.loadAiInsights();

    this.route.queryParams.subscribe(params => {
      if (params['deal']) {
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
    if (t === 'automatizaciones') {
      this.syncCrmStagesFromDashboard();
      this.loadAutomations();
    }
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
      this.crmStages = Array.isArray(res.user.crm_stages) && res.user.crm_stages.length > 0
        ? [...res.user.crm_stages]
        : [...DEFAULT_GESTOR_STAGES];
    });
  }

  syncCrmStagesFromDashboard() {
    const dash = this.crmDashboard();
    if (dash?.stages?.length) {
      this.crmStages = dash.stages.map(id => ({
        id,
        label: dash.stageLabels[id] || id,
      }));
      return;
    }
    if (!this.crmStages.length) {
      this.crmStages = [...DEFAULT_GESTOR_STAGES];
    }
  }

  loadCrm() {
    this.crmService.getDashboard().subscribe(d => {
      this.crmDashboard.set(d);
      if (this.tab() === 'automatizaciones' || !this.crmStages.length) {
        this.syncCrmStagesFromDashboard();
      }
    });
    this.crmService.getToday().subscribe(t => this.todayInbox.set(t));
    this.loadDeals();
    this.crmService.getTemplates().subscribe(t => this.templates.set(t));
    this.loadAiInsights();
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
      next: () => this.loadDeals(),
      error: () => {
        this.message.set('No se pudo mover la tarjeta');
        this.loadDeals();
      },
    });
  }

  openDeal(id: string) {
    this.selectedDealId.set(id);
    this.selectedContactId.set(null);
    if (this.tab() !== 'pipeline') this.tab.set('pipeline');
  }

  onDealUpdated() {
    this.loadDeals();
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

  addAiConfig() {
    this.aiConfigs.push({ provider: '', key: '' });
  }

  removeAiConfig(index: number) {
    this.aiConfigs.splice(index, 1);
    if (this.aiConfigs.length === 0) {
      this.addAiConfig();
    }
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
            chatbot_bg_color: this.chatbotBgColor,
            chatbot_btn_color: this.chatbotBtnColor,
            chatbot_text_color: this.chatbotTextColor,
            panel_assistant_enabled: this.panelAssistantEnabled,
            panel_assistant_name: this.panelAssistantName,
            panel_assistant_position: this.panelAssistantPosition,
            panel_assistant_bg_color: this.panelAssistantBgColor,
            panel_assistant_btn_color: this.panelAssistantBtnColor,
            panel_assistant_text_color: this.panelAssistantTextColor,
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

  readonly designColorFields: ColorPaletteFieldDef[] = [
    { key: 'chatbotBg', label: 'Chatbot · Fondo' },
    { key: 'chatbotBtn', label: 'Chatbot · Botones' },
    { key: 'chatbotText', label: 'Chatbot · Texto' },
    { key: 'assistantBg', label: 'Asistente · Fondo' },
    { key: 'assistantBtn', label: 'Asistente · Botón' },
    { key: 'assistantText', label: 'Asistente · Texto' },
  ];

  get designColors(): Record<string, string> {
    return {
      chatbotBg: this.chatbotBgColor,
      chatbotBtn: this.chatbotBtnColor,
      chatbotText: this.chatbotTextColor,
      assistantBg: this.panelAssistantBgColor,
      assistantBtn: this.panelAssistantBtnColor,
      assistantText: this.panelAssistantTextColor,
    };
  }

  applyDesignColors(map: Record<string, string>) {
    if (map['chatbotBg']) this.chatbotBgColor = map['chatbotBg'];
    if (map['chatbotBtn']) this.chatbotBtnColor = map['chatbotBtn'];
    if (map['chatbotText']) this.chatbotTextColor = map['chatbotText'];
    if (map['assistantBg']) this.panelAssistantBgColor = map['assistantBg'];
    if (map['assistantBtn']) this.panelAssistantBtnColor = map['assistantBtn'];
    if (map['assistantText']) this.panelAssistantTextColor = map['assistantText'];
  }

  saveDesignColors() {
    this.auth.updateMe({
      chatbot_bg_color: this.chatbotBgColor,
      chatbot_btn_color: this.chatbotBtnColor,
      chatbot_text_color: this.chatbotTextColor,
      panel_assistant_bg_color: this.panelAssistantBgColor,
      panel_assistant_btn_color: this.panelAssistantBtnColor,
      panel_assistant_text_color: this.panelAssistantTextColor,
    }).subscribe({
      next: () => this.message.set('Colores guardados'),
      error: () => this.message.set('Error al guardar colores'),
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
