import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MpService } from '../../core/api.service';

declare const MercadoPago: any;

@Component({
  selector: 'app-mp-checkout',
  standalone: true,
  imports: [RouterModule, FormsModule, DecimalPipe],
  templateUrl: './mp-checkout.component.html',
})
export class MpCheckoutComponent implements OnInit, OnDestroy {
  token = '';

  loading = signal(true);
  processing = signal(false);
  error = signal('');
  success = signal(false);
  requiresAction = signal(false);
  actionUrl = signal('');

  publicKey = '';
  amount = 0;
  description = '';
  gestorName = '';

  payerEmail = '';
  identificationType = 'RFC';
  identificationNumber = '';
  installments = 1;

  formReady = signal(false);
  private mp: any = null;
  private cardForm: any = null;
  private scriptEl: HTMLScriptElement | null = null;

  constructor(private route: ActivatedRoute, private mpService: MpService) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error.set('Link de pago inválido.');
      this.loading.set(false);
      return;
    }
    this.mpService.getPaymentInfo(this.token).subscribe({
      next: (info) => {
        this.publicKey = info.publicKey;
        this.amount = info.amount;
        this.description = info.description;
        this.gestorName = info.gestorName;
        this.loadMpScript();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudo cargar la información de pago.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy() {
    if (this.scriptEl) {
      document.head.removeChild(this.scriptEl);
    }
  }

  private loadMpScript() {
    if (typeof MercadoPago !== 'undefined') {
      this.initMp();
      return;
    }
    this.scriptEl = document.createElement('script');
    this.scriptEl.src = 'https://sdk.mercadopago.com/v2/mercadopago.js';
    this.scriptEl.onload = () => this.initMp();
    this.scriptEl.onerror = () => {
      this.error.set('No se pudo cargar el SDK de MercadoPago.');
      this.loading.set(false);
    };
    document.head.appendChild(this.scriptEl);
  }

  private initMp() {
    try {
      this.mp = new MercadoPago(this.publicKey, { locale: 'es-MX' });
      this.cardForm = this.mp.cardForm({
        amount: String(this.amount),
        iframe: true,
        form: {
          id: 'mp-card-form',
          cardNumber: { id: 'mp-card-number', placeholder: 'Número de tarjeta' },
          expirationDate: { id: 'mp-expiration-date', placeholder: 'MM/AA' },
          securityCode: { id: 'mp-security-code', placeholder: 'CVV' },
          cardholderName: { id: 'mp-cardholder-name', placeholder: 'Nombre en la tarjeta' },
          issuer: { id: 'mp-issuer', placeholder: 'Banco emisor' },
          installments: { id: 'mp-installments', placeholder: 'Cuotas' },
          identificationType: { id: 'mp-identification-type', placeholder: 'Tipo de documento' },
          identificationNumber: { id: 'mp-identification-number', placeholder: 'Número de documento' },
          cardholderEmail: { id: 'mp-cardholder-email', placeholder: 'Email' },
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) {
              this.error.set('Error al inicializar el formulario de pago.');
              this.loading.set(false);
              return;
            }
            this.formReady.set(true);
            this.loading.set(false);
          },
          onSubmit: (event: any) => {
            event.preventDefault();
            const {
              paymentMethodId,
              issuerId,
              cardholderEmail: email,
              token: cardToken,
              installments,
              identificationNumber,
              identificationType,
            } = this.cardForm.getCardFormData();

            this.processing.set(true);
            this.error.set('');

            this.mpService.processPayment(this.token, {
              cardToken,
              payerEmail: email,
              installments: Number(installments) || 1,
              identificationType,
              identificationNumber,
            }).subscribe({
              next: (res) => {
                this.processing.set(false);
                if (res.success || res.status === 'processed' || res.status === 'approved') {
                  this.success.set(true);
                } else if (res.requiresAction && res.actionUrl) {
                  this.requiresAction.set(true);
                  this.actionUrl.set(res.actionUrl);
                } else {
                  this.error.set(res.message || 'Pago no aprobado. Intenta con otra tarjeta.');
                }
              },
              error: (err) => {
                this.processing.set(false);
                this.error.set(err.error?.error || 'Error al procesar el pago.');
              },
            });
          },
          onFetching: (resource: any) => {
            const progressBar = document.querySelector('.mp-progress-bar');
            progressBar?.removeAttribute('value');
            return () => {
              progressBar?.setAttribute('value', '0');
            };
          },
        },
      });
    } catch (e: any) {
      this.error.set('Error al inicializar MercadoPago: ' + (e?.message || ''));
      this.loading.set(false);
    }
  }
}
