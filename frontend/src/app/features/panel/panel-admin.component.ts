import { Component, OnInit, signal, effect } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AdminService } from '../../core/api.service';
import { AdminStats, ManagedUser, AnalyticsConfig, AnalyticsDashboard, GaProperty } from '../../models';
import { PanelThemeEditorComponent } from './panel-theme-editor.component';
import { DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';

import { NotificationBellComponent } from '../../shared/notification-bell.component';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';

type AdminTab = 'stats' | 'users' | 'autos-theme' | 'gestores-theme' | 'panel-gestor' | 'panel-concesionaria' | 'stripe';

@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, PanelThemeEditorComponent, NotificationBellComponent, DatePipe, CurrencyPipe, DecimalPipe, PanelColorPaletteComponent, AiAssistantComponent],
  templateUrl: './panel-admin.component.html',
  styleUrl: './panel-dashboard.css',
})
export class PanelAdminComponent implements OnInit {
  isMobileMenuOpen = signal(false);
  tab = signal<AdminTab>('stats');
  stats = signal<AdminStats | null>(null);
  managedUsers = signal<ManagedUser[]>([]);
  userFilter = signal<'all' | 'gestor' | 'concesionaria'>('all');
  selectedUser = signal<ManagedUser | null>(null);
  newPassword = '';
  editName = '';
  editEmail = '';
  editLocation = '';
  editState = '';
  editBio = '';
  editWhatsapp = '';
  message = signal('');

  // Audit State
  auditingOrg = signal<ManagedUser | null>(null);
  orgStats = signal<any>(null);
  orgDeals = signal<any[]>([]);
  chatMessages = signal<any[]>([]);
  chatDeal = signal<any>(null);

  stripePublicKey = '';
  stripeSecretKey = '';
  stripePriceId = '';
  stripeMsg = signal('');
  stripeSaving = signal(false);

  aiConfigs: { provider: string, key: string }[] = [{ provider: '', key: '' }];
  aiMsg = signal('');
  aiSaving = signal(false);

  panelAssistantEnabled = true;
  panelAssistantName = 'VEGA';
  panelAssistantPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  panelAssistantBgColor = '#0f172a';
  panelAssistantBtnColor = '#4F46E5';
  panelAssistantTextColor = '#FFFFFF';
  panelAssistantMsg = signal('');
  panelAssistantSaving = signal(false);

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

  analyticsConfig = signal<(AnalyticsConfig & { oauthConfigured?: boolean }) | null>(null);
  analyticsDashboard = signal<AnalyticsDashboard | null>(null);
  gaProperties = signal<GaProperty[]>([]);
  gaMeasurementId = '';
  gaPropertyId = '';
  gaGoogleClientId = '';
  gaGoogleClientSecret = '';
  gaDays = 30;
  gaLoading = signal(false);
  gaConnecting = signal(false);
  gaConfigLoading = signal(true);
  gaMsg = signal('');

  constructor(
    public auth: AuthService,
    private adminService: AdminService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    effect(() => {
      const me = this.auth.user();
      if (me) {
        this.stripePublicKey = me.stripe_public_key || '';
        this.stripeSecretKey = me.stripe_secret_key || '';
        this.stripePriceId = me.stripe_price_id || '';
        
        const rawApiKey = me.ai_api_key || '';
        try {
          if (rawApiKey.trim().startsWith('[')) {
            this.aiConfigs = JSON.parse(rawApiKey);
          } else {
            const keys = rawApiKey.split(',').map(k => k.trim()).filter(Boolean);
            if (keys.length > 0) {
              this.aiConfigs = keys.map(k => ({ provider: me.ai_provider || '', key: k }));
            } else {
              this.aiConfigs = [{ provider: me.ai_provider || '', key: '' }];
            }
          }
        } catch (e) {
          this.aiConfigs = [{ provider: me.ai_provider || '', key: rawApiKey }];
        }
        
        if (this.aiConfigs.length === 0) {
          this.aiConfigs = [{ provider: '', key: '' }];
        }

        this.panelAssistantEnabled = me.panel_assistant_enabled !== 0 && me.panel_assistant_enabled !== false;
        this.panelAssistantName = me.panel_assistant_name || 'VEGA';
        this.panelAssistantPosition = me.panel_assistant_position || 'bottom-right';
        this.panelAssistantBgColor = me.panel_assistant_bg_color || '#0f172a';
        this.panelAssistantBtnColor = me.panel_assistant_btn_color || '#4F46E5';
        this.panelAssistantTextColor = me.panel_assistant_text_color || '#FFFFFF';
      }
    });
  }

  ngOnInit() {
    this.auth.getMe().subscribe(res => {
      this.auth.user.set(res.user);
    });
    this.loadStats();
    this.loadUsers();
    this.loadAnalytics();

    this.route.queryParamMap.subscribe(params => {
      const analytics = params.get('analytics');
      if (!analytics) return;
      if (analytics === 'connected') {
        this.gaMsg.set('Cuenta de Google Analytics conectada correctamente.');
        this.loadAnalytics();
        this.loadGaProperties();
      } else if (analytics === 'error') {
        this.gaMsg.set(`Error al conectar: ${params.get('reason') || 'desconocido'}`);
      }
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    });
  }

  loadStats() { this.adminService.getStats().subscribe(s => this.stats.set(s)); }

  loadAnalytics() {
    this.gaConfigLoading.set(true);
    this.adminService.getAnalyticsConfig().subscribe({
      next: (cfg) => {
        this.analyticsConfig.set(cfg);
        this.gaMeasurementId = cfg.measurementId || '';
        this.gaPropertyId = cfg.propertyId || '';
        this.gaGoogleClientId = cfg.googleClientId || '';
        this.gaGoogleClientSecret = '';
        this.gaConfigLoading.set(false);
        if (cfg.connected) this.loadGaProperties();
        if (cfg.connected && cfg.propertyId) this.loadAnalyticsDashboard();
      },
      error: (e) => {
        this.gaConfigLoading.set(false);
        this.analyticsConfig.set({
          connected: false,
          measurementId: null,
          propertyId: null,
          connectedEmail: null,
          googleClientId: null,
          hasClientSecret: false,
          oauthConfigured: false,
        });
        this.gaMsg.set(e.error?.error || 'No se pudo cargar la configuración de Analytics. Verifica que el backend esté corriendo.');
      },
    });
  }

  loadGaProperties() {
    this.adminService.getAnalyticsProperties().subscribe({
      next: (props) => this.gaProperties.set(props),
      error: (e) => this.gaMsg.set(e.error?.error || 'No se pudieron cargar las propiedades GA'),
    });
  }

  loadAnalyticsDashboard() {
    this.gaLoading.set(true);
    this.adminService.getAnalyticsDashboard(this.gaDays).subscribe({
      next: (d) => { this.analyticsDashboard.set(d); this.gaLoading.set(false); },
      error: (e) => { this.gaMsg.set(e.error?.error || 'Error al cargar tráfico'); this.gaLoading.set(false); },
    });
  }

  connectGoogleAnalytics() {
    const cfg = this.analyticsConfig();
    if (!cfg?.oauthConfigured) {
      this.gaMsg.set('Guarda primero el Client ID y Client Secret de Google (abajo) y luego haz clic en Conectar.');
      return;
    }
    this.gaConnecting.set(true);
    this.gaMsg.set('Redirigiendo a Google...');
    this.adminService.getAnalyticsOAuthUrl().subscribe({
      next: (res) => {
        if (res?.url) {
          window.location.href = res.url;
        } else {
          this.gaConnecting.set(false);
          this.gaMsg.set('No se recibió la URL de autorización.');
        }
      },
      error: (e) => {
        this.gaConnecting.set(false);
        this.gaMsg.set(e.error?.error || 'OAuth no configurado en el servidor');
      },
    });
  }

  saveAnalyticsSettings() {
    this.adminService.saveAnalyticsConfig({
      measurementId: this.gaMeasurementId.trim(),
      propertyId: this.gaPropertyId,
      googleClientId: this.gaGoogleClientId.trim(),
      googleClientSecret: this.gaGoogleClientSecret.trim() || undefined,
    }).subscribe({
      next: (cfg) => {
        this.analyticsConfig.set(cfg);
        this.gaGoogleClientSecret = '';
        this.gaMsg.set('Configuración guardada correctamente.');
        if (cfg.connected && cfg.propertyId) this.loadAnalyticsDashboard();
      },
      error: (e) => this.gaMsg.set(e.error?.error || 'Error al guardar'),
    });
  }

  saveOAuthCredentials() {
    if (!this.gaGoogleClientId.trim()) {
      this.gaMsg.set('Ingresa el Client ID de Google.');
      return;
    }
    if (!this.gaGoogleClientSecret.trim() && !this.analyticsConfig()?.hasClientSecret) {
      this.gaMsg.set('Ingresa el Client Secret de Google.');
      return;
    }
    this.saveAnalyticsSettings();
  }

  disconnectGoogleAnalytics() {
    if (!confirm('¿Desconectar Google Analytics? Tendrás que volver a autorizar.')) return;
    this.adminService.disconnectAnalytics().subscribe({
      next: (cfg) => {
        this.analyticsConfig.set(cfg);
        this.analyticsDashboard.set(null);
        this.gaProperties.set([]);
        this.gaMsg.set('Analytics desconectado.');
      },
      error: (e) => this.gaMsg.set(e.error?.error || 'Error al desconectar'),
    });
  }

  deviceLabel(device: string): string {
    const map: Record<string, string> = {
      mobile: 'Móvil',
      desktop: 'Escritorio',
      tablet: 'Tablet',
    };
    return map[device.toLowerCase()] || device;
  }

  maxDailySessions(daily: { sessions: number }[] = []): number {
    return Math.max(...daily.map(d => d.sessions), 1);
  }

  loadUsers() {
    const f = this.userFilter();
    const role = f === 'all' ? undefined : f;
    this.adminService.getManagedUsers(role).subscribe({
      next: u => this.managedUsers.set(u),
      error: e => this.message.set(e.error?.error || 'No se pudieron cargar los usuarios'),
    });
  }

  selectUser(u: ManagedUser) {
    this.selectedUser.set(u);
    this.newPassword = '';
    this.editName = u.name;
    this.editEmail = u.email;
    this.editLocation = u.location || '';
    this.editState = u.state || '';
    this.editBio = '';
    this.editWhatsapp = '';
  }

  resetPassword() {
    const u = this.selectedUser();
    if (!u || !this.newPassword) return;
    this.adminService.resetPassword(u.id, this.newPassword).subscribe({
      next: () => { this.message.set(`Contraseña de ${u.name} actualizada`); this.newPassword = ''; },
      error: (e) => this.message.set(e.error?.error || 'Error'),
    });
  }

  saveUser() {
    const u = this.selectedUser();
    if (!u) return;
    const payload: Record<string, unknown> = { name: this.editName, email: this.editEmail };
    if (u.role === 'gestor') {
      payload['gestorProfile'] = { location: this.editLocation, state: this.editState, bio: this.editBio, whatsapp: this.editWhatsapp };
    }
    this.adminService.updateUser(u.id, payload).subscribe({
      next: () => { this.message.set('Usuario actualizado'); this.loadUsers(); },
      error: (e) => this.message.set(e.error?.error || 'Error'),
    });
  }

  initials() { return 'SA'; }

  // Auditing Methods
  auditUser(u: ManagedUser) {
    this.auditingOrg.set(u);
    this.adminService.getOrgStats(u.id).subscribe(s => this.orgStats.set(s));
    this.adminService.getOrgDeals(u.id).subscribe(d => this.orgDeals.set(d));
    this.chatDeal.set(null);
    this.chatMessages.set([]);
  }

  closeAudit() {
    this.auditingOrg.set(null);
  }

  viewChat(deal: any) {
    this.chatDeal.set(deal);
    this.adminService.getDealMessages(deal.id).subscribe(m => this.chatMessages.set(m));
  }

  closeChat() {
    this.chatDeal.set(null);
  }

  saveStripeConfig() {
    this.stripeSaving.set(true);
    this.adminService.updateMyProfile({
      stripe_public_key: this.stripePublicKey,
      stripe_secret_key: this.stripeSecretKey,
      stripe_price_id: this.stripePriceId
    }).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.stripeMsg.set('Configuración de Stripe guardada.');
        this.stripeSaving.set(false);
      },
      error: (e) => {
        this.stripeMsg.set(e.error?.error || 'Error al guardar configuración');
        this.stripeSaving.set(false);
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

  saveAiConfig() {
    this.aiSaving.set(true);
    
    // Filtrar las que están vacías
    const validConfigs = this.aiConfigs.filter(c => c.key.trim() !== '');
    const firstProvider = validConfigs.length > 0 ? validConfigs[0].provider : '';

    this.adminService.updateMyProfile({
      ai_provider: firstProvider,
      ai_api_key: JSON.stringify(validConfigs)
    }).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.aiMsg.set('Configuración de IA guardada.');
        this.aiSaving.set(false);
      },
      error: (e) => {
        this.aiMsg.set(e.error?.error || 'Error al guardar configuración de IA');
        this.aiSaving.set(false);
      }
    });
  }

  savePanelAssistant() {
    this.panelAssistantSaving.set(true);
    this.adminService.updateMyProfile({
      panel_assistant_enabled: this.panelAssistantEnabled,
      panel_assistant_name: this.panelAssistantName,
      panel_assistant_position: this.panelAssistantPosition,
      panel_assistant_bg_color: this.panelAssistantBgColor,
      panel_assistant_btn_color: this.panelAssistantBtnColor,
      panel_assistant_text_color: this.panelAssistantTextColor,
    }).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.panelAssistantMsg.set('Asistente del panel guardado.');
        this.panelAssistantSaving.set(false);
      },
      error: (e) => {
        this.panelAssistantMsg.set(e.error?.error || 'Error al guardar asistente');
        this.panelAssistantSaving.set(false);
      }
    });
  }
}
