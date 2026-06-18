import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { SubscriptionBillingComponent } from './subscription-billing.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-panel-subscription-lock',
  standalone: true,
  imports: [CommonModule, SubscriptionBillingComponent],
  template: `
    @if (locked()) {
      <div class="sub-lock-overlay">
        <div class="sub-lock-card">
          @if (status() === 'deactivated') {
            <div class="sub-lock-icon">🚫</div>
            <h2>Cuenta desactivada</h2>
            <p>Tu suscripción fue suspendida tras 3 intentos de pago fallidos. Actualiza tu método de pago para reactivar el panel.</p>
          } @else {
            <div class="sub-lock-icon">💳</div>
            <h2>Activa tu suscripción</h2>
            <p>Tu cuenta está registrada pero el pago aún no se ha completado. Activa tu plan para usar todos los módulos del panel.</p>
            @if (paymentFailedCount() > 0) {
              <p class="sub-lock-warn">Intentos de pago fallidos: {{ paymentFailedCount() }} / 3</p>
            }
          }
          <div class="sub-lock-actions">
            <button type="button" class="sub-lock-btn primary" (click)="requestPaymentLink()" [disabled]="loadingLink()">
              {{ loadingLink() ? 'Preparando…' : 'Ir a pagar ahora' }}
            </button>
            @if (!auth.user()?.parent_id) {
              <button type="button" class="sub-lock-btn ghost" (click)="billingOpen.set(true)">Ver facturación</button>
            }
          </div>
          @if (linkError()) {
            <p class="sub-lock-error">{{ linkError() }}</p>
          }
        </div>
      </div>
    }

    @if (billingOpen()) {
      <app-subscription-billing (closed)="billingOpen.set(false)" />
    }
  `,
  styles: [`
    .sub-lock-overlay {
      position: fixed;
      inset: 0;
      z-index: 9000;
      background: rgba(0,0,0,.82);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .sub-lock-card {
      background: #0a0a0a;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 18px;
      padding: 36px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .sub-lock-icon { font-size: 42px; margin-bottom: 16px; }
    .sub-lock-card h2 {
      color: #fff;
      font-size: 18px;
      margin: 0 0 12px;
      letter-spacing: .06em;
      text-transform: uppercase;
      font-family: var(--f-display, sans-serif);
    }
    .sub-lock-card p {
      color: rgba(255,255,255,.65);
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 12px;
    }
    .sub-lock-warn { color: #ffb347 !important; font-weight: 600; }
    .sub-lock-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
    .sub-lock-btn {
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,.2);
    }
    .sub-lock-btn.primary {
      background: linear-gradient(135deg, #c8a94a, #d4af37);
      color: #000;
      border: none;
    }
    .sub-lock-btn.ghost { background: transparent; color: rgba(255,255,255,.8); }
    .sub-lock-btn:disabled { opacity: .55; cursor: not-allowed; }
    .sub-lock-error { color: #ff6b6b; font-size: 13px; margin-top: 12px; }
  `],
})
export class PanelSubscriptionLockComponent {
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);

  billingOpen = signal(false);
  loadingLink = signal(false);
  linkError = signal('');

  status = computed(() => this.auth.user()?.status || 'active');
  paymentFailedCount = computed(() => this.auth.user()?.payment_failed_count || 0);

  locked = computed(() => {
    const role = this.auth.user()?.role;
    if (!['gestor', 'concesionaria'].includes(role || '')) return false;
    const s = this.status();
    return s === 'pending_payment' || s === 'deactivated';
  });

  requestPaymentLink() {
    this.loadingLink.set(true);
    this.linkError.set('');
    this.http.post<{ success: boolean; checkoutUrl?: string }>(
      `${environment.apiUrl}/auth/resume-payment`,
      {},
    ).subscribe({
      next: (res) => {
        this.loadingLink.set(false);
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.billingOpen.set(true);
        }
      },
      error: (err) => {
        this.loadingLink.set(false);
        this.linkError.set(err.error?.error || 'No se pudo generar el enlace de pago');
      },
    });
  }
}
