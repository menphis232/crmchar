import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AdminService } from '../../core/api.service';
import { AdminStats, ManagedUser } from '../../models';
import { PanelThemeEditorComponent } from './panel-theme-editor.component';
import { DatePipe, CurrencyPipe } from '@angular/common';

import { NotificationBellComponent } from '../../shared/notification-bell.component';

type AdminTab = 'stats' | 'users' | 'autos-theme' | 'gestores-theme' | 'panel-gestor' | 'panel-concesionaria' | 'stripe';

@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, PanelThemeEditorComponent, NotificationBellComponent, DatePipe, CurrencyPipe],
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

  aiProvider = '';
  aiApiKey = '';
  aiMsg = signal('');
  aiSaving = signal(false);

  constructor(public auth: AuthService, private adminService: AdminService) {
    const me = this.auth.user();
    if (me) {
      this.stripePublicKey = me.stripe_public_key || '';
      this.stripeSecretKey = me.stripe_secret_key || '';
      this.stripePriceId = me.stripe_price_id || '';
      this.aiProvider = me.ai_provider || '';
      this.aiApiKey = me.ai_api_key || '';
    }
  }

  ngOnInit() {
    this.loadStats();
    this.loadUsers();
  }

  loadStats() { this.adminService.getStats().subscribe(s => this.stats.set(s)); }

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

  saveAiConfig() {
    this.aiSaving.set(true);
    this.adminService.updateMyProfile({
      ai_provider: this.aiProvider,
      ai_api_key: this.aiApiKey
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
}
