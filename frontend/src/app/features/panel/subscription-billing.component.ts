import { firstValueFrom } from 'rxjs';
import {
  Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { BillingService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { BillingInvoice, BillingPaymentMethod, BillingSummary } from '../../models';

@Component({
  selector: 'app-subscription-billing',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="billing-overlay" (click)="onOverlayClick($event)">
      <div class="billing-modal" (click)="$event.stopPropagation()">
        <div class="billing-header">
          <div>
            <h2>Suscripción y facturación</h2>
            <p>Gestiona tu plan, facturas y métodos de pago</p>
          </div>
          <button type="button" class="billing-close" (click)="closed.emit()" aria-label="Cerrar">✕</button>
        </div>

        @if (loading()) {
          <div class="billing-loading">Cargando información…</div>
        } @else if (error()) {
          <div class="billing-error">{{ error() }}</div>
        } @else {
          <!-- Resumen -->
          <section class="billing-section">
            <h3>Plan actual</h3>
            <div class="billing-summary-grid">
              <div class="billing-stat">
                <span class="billing-stat-label">Estado</span>
                <span class="billing-stat-value" [class.active]="summary()?.status === 'active'">
                  @if (summary()?.cancelAtPeriodEnd) {
                    Activa (cancelación programada)
                  } @else {
                    {{ statusLabel(summary()?.status) }}
                  }
                </span>
              </div>
              @if ((summary()?.paymentFailedCount ?? 0) > 0) {
                <div class="billing-stat">
                  <span class="billing-stat-label">Pagos fallidos</span>
                  <span class="billing-stat-value">{{ summary()!.paymentFailedCount }} / 3</span>
                </div>
              }
              @if (summary()?.planAmount != null) {
                <div class="billing-stat">
                  <span class="billing-stat-label">Plan</span>
                  <span class="billing-stat-value">
                    \${{ summary()!.planAmount | number:'1.2-2' }} {{ (summary()!.planCurrency || 'mxn') | uppercase }}
                    / {{ intervalLabel(summary()?.planInterval) }}
                  </span>
                </div>
              }
              <div class="billing-stat">
                <span class="billing-stat-label">Último pago</span>
                <span class="billing-stat-value">{{ formatDate(summary()?.lastPaymentDate) }}</span>
              </div>
              <div class="billing-stat">
                <span class="billing-stat-label">
                  @if (summary()?.cancelAtPeriodEnd) { Acceso hasta } @else { Próxima factura }
                </span>
                <span class="billing-stat-value">
                  {{ formatDate(summary()?.cancelAtPeriodEnd ? summary()?.accessUntilDate : summary()?.nextInvoiceDate) }}
                </span>
              </div>
            </div>

            @if (summary()?.cancelAtPeriodEnd && summary()?.accessUntilDate) {
              <p class="billing-notice warn">
                Tu suscripción está cancelada. Tendrás acceso hasta el {{ formatDate(summary()!.accessUntilDate) }}.
                Después de esa fecha no se te cobrará de nuevo.
              </p>
            }

            <div class="billing-sub-actions">
              @if (summary()?.canCancel) {
                <button type="button" class="billing-btn danger" (click)="cancelSubscription()" [disabled]="subBusy()">
                  {{ subBusy() ? 'Procesando…' : 'Cancelar suscripción' }}
                </button>
              }
              @if (summary()?.canReactivate) {
                <button type="button" class="billing-btn primary" (click)="reactivateSubscription()" [disabled]="subBusy()">
                  {{ subBusy() ? 'Procesando…' : 'Mantener suscripción' }}
                </button>
              }
              @if (summary()?.canResubscribe && !summary()?.canReactivate) {
                <button type="button" class="billing-btn primary" (click)="resubscribe()" [disabled]="subBusy()">
                  {{ subBusy() ? 'Preparando…' : 'Volver a suscribirme' }}
                </button>
              }
            </div>
          </section>

          <!-- Facturas -->
          <section class="billing-section">
            <h3>Facturas</h3>
            @if (invoices().length === 0) {
              <p class="billing-empty">No hay facturas disponibles aún.</p>
            } @else {
              <div class="billing-table-wrap">
                <table class="billing-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Número</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inv of invoices(); track inv.id) {
                      <tr>
                        <td>{{ formatDate(inv.paidAt || inv.createdAt) }}</td>
                        <td>{{ inv.number || '—' }}</td>
                        <td>\${{ inv.amount | number:'1.2-2' }} {{ inv.currency | uppercase }}</td>
                        <td><span class="billing-badge" [class.paid]="inv.status === 'paid'">{{ invoiceStatusLabel(inv.status) }}</span></td>
                        <td class="billing-actions-cell">
                          @if (inv.pdfUrl) {
                            <a [href]="inv.pdfUrl" target="_blank" rel="noopener" class="billing-link">PDF</a>
                          }
                          @if (inv.hostedUrl) {
                            <a [href]="inv.hostedUrl" target="_blank" rel="noopener" class="billing-link">Ver</a>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <!-- Métodos de pago -->
          <section class="billing-section">
            <div class="billing-section-head">
              <h3>Métodos de pago</h3>
              @if (!showAddForm()) {
                <button type="button" class="billing-btn primary" (click)="openAddForm()">+ Agregar tarjeta</button>
              }
            </div>

            @if (showAddForm()) {
              <div class="billing-add-card">
                <div #paymentElementHost class="billing-stripe-element"></div>
                <div class="billing-add-actions">
                  <button type="button" class="billing-btn ghost" (click)="closeAddForm()" [disabled]="savingCard()">Cancelar</button>
                  <button type="button" class="billing-btn primary" (click)="saveCard()" [disabled]="savingCard() || !stripeReady()">
                    {{ savingCard() ? 'Guardando…' : 'Guardar tarjeta' }}
                  </button>
                </div>
              </div>
            }

            @if (paymentMethods().length === 0 && !showAddForm()) {
              <p class="billing-empty">No tienes métodos de pago registrados.</p>
            } @else if (paymentMethods().length > 0) {
              <div class="billing-pm-list">
                @for (pm of paymentMethods(); track pm.id) {
                  <div class="billing-pm-item">
                    <div class="billing-pm-info">
                      <span class="billing-pm-brand">{{ brandLabel(pm.brand) }}</span>
                      <span class="billing-pm-detail">•••• {{ pm.last4 }} · {{ pm.expMonth }}/{{ pm.expYear }}</span>
                      @if (pm.isDefault) {
                        <span class="billing-badge paid">Predeterminada</span>
                      }
                    </div>
                    <div class="billing-pm-actions">
                      @if (!pm.isDefault) {
                        <button type="button" class="billing-btn ghost sm" (click)="setDefault(pm.id)" [disabled]="busyPmId() === pm.id">
                          Predeterminar
                        </button>
                      }
                      <button type="button" class="billing-btn danger sm" (click)="removePm(pm.id)" [disabled]="busyPmId() === pm.id">
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </section>
        }
      </div>
    </div>
  `,
  styles: [`
    .billing-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(6px);
      display: flex; align-items: flex-start; justify-content: center; z-index: 10000;
      padding: 24px 16px; overflow-y: auto;
    }
    .billing-modal {
      background: #0a0a0a; border: 1px solid rgba(255,255,255,.12); border-radius: 18px;
      width: min(720px, 100%); margin: auto 0; box-shadow: 0 24px 80px rgba(0,0,0,.65);
    }
    .billing-header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
      padding: 24px 24px 0;
    }
    .billing-header h2 {
      margin: 0 0 4px; color: #fff; font-size: 18px; letter-spacing: .06em; text-transform: uppercase;
      font-family: var(--f-display, sans-serif);
    }
    .billing-header p { margin: 0; color: rgba(255,255,255,.5); font-size: 13px; }
    .billing-close {
      background: transparent; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.7);
      width: 36px; height: 36px; border-radius: 8px; cursor: pointer; flex-shrink: 0;
    }
    .billing-close:hover { border-color: #fff; color: #fff; }
    .billing-loading, .billing-error, .billing-empty {
      padding: 16px 24px 24px; color: rgba(255,255,255,.65); font-size: 14px;
    }
    .billing-error { color: #ff6b6b; }
    .billing-section { padding: 20px 24px; border-top: 1px solid rgba(255,255,255,.08); }
    .billing-section h3 {
      margin: 0 0 14px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
      color: rgba(255,255,255,.45); font-family: var(--f-display, sans-serif);
    }
    .billing-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
    .billing-section-head h3 { margin: 0; }
    .billing-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (min-width: 560px) { .billing-summary-grid { grid-template-columns: repeat(4, 1fr); } }
    .billing-stat {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px; padding: 12px;
    }
    .billing-stat-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,.4); margin-bottom: 6px; }
    .billing-stat-value { display: block; font-size: 13px; color: #fff; font-weight: 600; }
    .billing-stat-value.active { color: #7dffb3; }
    .billing-notice {
      margin: 14px 0 0; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.7);
    }
    .billing-notice.warn { border-color: rgba(255,179,71,.35); color: #ffb347; }
    .billing-sub-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .billing-table-wrap { overflow-x: auto; }
    .billing-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .billing-table th, .billing-table td { padding: 10px 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.08); color: rgba(255,255,255,.85); }
    .billing-table th { color: rgba(255,255,255,.4); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .billing-actions-cell { white-space: nowrap; }
    .billing-link {
      color: #c8a94a; text-decoration: none; font-size: 12px; font-weight: 600; margin-right: 10px;
    }
    .billing-link:hover { text-decoration: underline; }
    .billing-badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px;
      background: rgba(255,255,255,.08); color: rgba(255,255,255,.65);
    }
    .billing-badge.paid { background: rgba(125,255,179,.12); color: #7dffb3; }
    .billing-pm-list { display: flex; flex-direction: column; gap: 10px; }
    .billing-pm-item {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 12px 14px;
    }
    .billing-pm-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .billing-pm-brand { font-weight: 700; color: #fff; text-transform: capitalize; font-size: 14px; }
    .billing-pm-detail { color: rgba(255,255,255,.55); font-size: 13px; }
    .billing-pm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .billing-btn {
      border: 1px solid rgba(255,255,255,.18); background: transparent; color: #fff;
      border-radius: 8px; padding: 8px 14px; font-size: 12px; cursor: pointer; font-weight: 600;
    }
    .billing-btn.sm { padding: 6px 10px; font-size: 11px; }
    .billing-btn.primary { background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; border-color: transparent; }
    .billing-btn.primary:disabled { opacity: .55; cursor: not-allowed; }
    .billing-btn.ghost { color: rgba(255,255,255,.7); }
    .billing-btn.danger { border-color: rgba(255,68,68,.35); color: #ff6b6b; }
    .billing-btn:disabled { opacity: .5; cursor: not-allowed; }
    .billing-add-card {
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px; padding: 16px; margin-bottom: 14px;
    }
    .billing-stripe-element { min-height: 44px; margin-bottom: 14px; }
    .billing-add-actions { display: flex; justify-content: flex-end; gap: 10px; }
  `],
})
export class SubscriptionBillingComponent implements OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('paymentElementHost') paymentElementHost?: ElementRef<HTMLDivElement>;

  loading = signal(true);
  error = signal<string | null>(null);
  summary = signal<BillingSummary | null>(null);
  invoices = signal<BillingInvoice[]>([]);
  paymentMethods = signal<BillingPaymentMethod[]>([]);
  showAddForm = signal(false);
  savingCard = signal(false);
  stripeReady = signal(false);
  busyPmId = signal<string | null>(null);
  subBusy = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private clientSecret: string | null = null;

  constructor(
    private billing: BillingService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.loadAll();
  }

  ngOnDestroy() {
    this.destroyStripeForm();
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('billing-overlay')) {
      this.closed.emit();
    }
  }

  loadAll() {
    this.loading.set(true);
    this.error.set(null);
    Promise.all([
      firstValueFrom(this.billing.getSummary()),
      firstValueFrom(this.billing.getInvoices()),
      firstValueFrom(this.billing.getPaymentMethods()),
    ]).then(([summary, invoicesRes, pmRes]) => {
      this.summary.set(summary ?? null);
      this.invoices.set(invoicesRes?.invoices ?? []);
      this.paymentMethods.set(pmRes?.methods ?? []);
      this.loading.set(false);
    }).catch((err) => {
      this.error.set(err?.error?.error || 'No se pudo cargar la información de facturación');
      this.loading.set(false);
    });
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  cancelSubscription() {
    if (!confirm('¿Cancelar tu suscripción? Seguirás con acceso hasta el fin del periodo actual y no se te cobrará el próximo mes.')) return;
    this.subBusy.set(true);
    this.billing.cancelSubscription().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.subBusy.set(false);
        this.toast.success('Suscripción cancelada. Tendrás acceso hasta el fin del periodo.');
      },
      error: (err) => {
        this.subBusy.set(false);
        this.toast.error(err?.error?.error || 'No se pudo cancelar la suscripción');
      },
    });
  }

  reactivateSubscription() {
    this.subBusy.set(true);
    this.billing.reactivateSubscription().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.subBusy.set(false);
        this.auth.getMe().subscribe();
        this.toast.success('Suscripción reactivada correctamente');
      },
      error: (err) => {
        this.subBusy.set(false);
        this.toast.error(err?.error?.error || 'No se pudo reactivar la suscripción');
      },
    });
  }

  resubscribe() {
    this.subBusy.set(true);
    this.billing.resubscribe().subscribe({
      next: (res) => {
        this.subBusy.set(false);
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.toast.success('Tu suscripción ya está activa');
          this.loadAll();
        }
      },
      error: (err) => {
        this.subBusy.set(false);
        this.toast.error(err?.error?.error || 'No se pudo iniciar la suscripción');
      },
    });
  }

  statusLabel(status?: string | null) {
    const map: Record<string, string> = {
      active: 'Activa',
      pending_payment: 'Pago pendiente',
      deactivated: 'Desactivada',
      canceled: 'Cancelada',
      past_due: 'Vencida',
      trialing: 'Prueba',
      unpaid: 'Impaga',
    };
    return map[status || ''] || status || '—';
  }

  intervalLabel(interval?: string | null) {
    if (interval === 'month') return 'mes';
    if (interval === 'year') return 'año';
    return interval || 'periodo';
  }

  invoiceStatusLabel(status: string) {
    const map: Record<string, string> = {
      paid: 'Pagada',
      open: 'Abierta',
      draft: 'Borrador',
      void: 'Anulada',
      uncollectible: 'Incobrable',
    };
    return map[status] || status;
  }

  brandLabel(brand: string) {
    const map: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
    };
    return map[brand] || brand;
  }

  async openAddForm() {
    this.showAddForm.set(true);
    this.stripeReady.set(false);
    setTimeout(() => this.initStripeForm(), 0);
  }

  closeAddForm() {
    this.showAddForm.set(false);
    this.destroyStripeForm();
  }

  private destroyStripeForm() {
    this.elements = null;
    this.stripe = null;
    this.clientSecret = null;
    if (this.paymentElementHost?.nativeElement) {
      this.paymentElementHost.nativeElement.innerHTML = '';
    }
  }

  private async initStripeForm() {
    try {
      const host = this.paymentElementHost?.nativeElement;
      if (!host) return;

      const setup = await firstValueFrom(this.billing.createSetupIntent());
      if (!setup?.clientSecret || !setup.publishableKey) {
        throw new Error('Stripe no está configurado');
      }

      this.clientSecret = setup.clientSecret;
      this.stripe = await loadStripe(setup.publishableKey);
      if (!this.stripe) throw new Error('No se pudo cargar Stripe');

      this.elements = this.stripe.elements({
        clientSecret: setup.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#c8a94a',
            colorBackground: '#111111',
            colorText: '#ffffff',
            borderRadius: '8px',
          },
        },
      });

      const paymentElement = this.elements.create('payment');
      paymentElement.mount(host);
      this.stripeReady.set(true);
    } catch (err: any) {
      this.toast.error(err?.error?.error || err?.message || 'Error al cargar formulario de pago');
      this.closeAddForm();
    }
  }

  async saveCard() {
    if (!this.stripe || !this.elements || !this.clientSecret) return;
    this.savingCard.set(true);
    try {
      const { error } = await this.stripe.confirmSetup({
        elements: this.elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error) {
        this.toast.error(error.message || 'No se pudo guardar la tarjeta');
      } else {
        this.toast.success('Tarjeta agregada correctamente');
        this.closeAddForm();
        const pmRes = await firstValueFrom(this.billing.getPaymentMethods());
        this.paymentMethods.set(pmRes?.methods ?? []);
      }
    } finally {
      this.savingCard.set(false);
    }
  }

  setDefault(id: string) {
    this.busyPmId.set(id);
    this.billing.setDefaultPaymentMethod(id).subscribe({
      next: () => {
        this.toast.success('Método predeterminado actualizado');
        this.paymentMethods.update((list) => list.map((pm) => ({ ...pm, isDefault: pm.id === id })));
        this.busyPmId.set(null);
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Error al actualizar');
        this.busyPmId.set(null);
      },
    });
  }

  removePm(id: string) {
    if (!confirm('¿Eliminar este método de pago?')) return;
    this.busyPmId.set(id);
    this.billing.deletePaymentMethod(id).subscribe({
      next: () => {
        this.toast.success('Método de pago eliminado');
        this.paymentMethods.update((list) => list.filter((pm) => pm.id !== id));
        this.busyPmId.set(null);
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'No se pudo eliminar');
        this.busyPmId.set(null);
      },
    });
  }
}
