import { AfterViewInit, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { loadMercadoPago } from '@mercadopago/sdk-js';
import { MpService } from '../../core/api.service';

@Component({
  selector: 'app-mp-checkout',
  standalone: true,
  imports: [RouterModule, DecimalPipe],
  templateUrl: './mp-checkout.component.html',
})
export class MpCheckoutComponent implements OnInit, AfterViewInit, OnDestroy {
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

  /** El formulario debe existir en el DOM antes de inicializar cardForm. */
  showForm = signal(false);
  formReady = signal(false);

  private mp: any = null;
  private cardForm: any = null;
  private sdkReady = false;
  private paymentInfoReady = false;
  private viewReady = false;
  private initStarted = false;

  constructor(private route: ActivatedRoute, private mpService: MpService) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error.set('Link de pago inválido.');
      this.loading.set(false);
      return;
    }

    void loadMercadoPago()
      .then(() => { this.sdkReady = true; })
      .catch(() => {
        this.error.set('No se pudo cargar el SDK de MercadoPago.');
        this.loading.set(false);
      });

    this.mpService.getPaymentInfo(this.token).subscribe({
      next: (info) => {
        this.publicKey = info.publicKey;
        this.amount = info.amount;
        this.description = info.description;
        this.gestorName = info.gestorName;
        this.paymentInfoReady = true;
        this.showForm.set(true);
        this.tryInitCardForm();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudo cargar la información de pago.');
        this.loading.set(false);
      },
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitCardForm();
  }

  ngOnDestroy() {
    this.cardForm = null;
    this.mp = null;
  }

  private tryInitCardForm() {
    if (this.initStarted || !this.sdkReady || !this.paymentInfoReady || !this.viewReady) return;
    if (!document.getElementById('mp-card-form')) {
      setTimeout(() => this.tryInitCardForm(), 50);
      return;
    }
    this.initStarted = true;
    this.initMp();
  }

  private initMp() {
    try {
      const MercadoPago = (window as any).MercadoPago;
      if (!MercadoPago) {
        this.error.set('SDK de MercadoPago no disponible.');
        this.loading.set(false);
        return;
      }

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
          onFormMounted: (mountError: any) => {
            if (mountError) {
              console.error('MP cardForm mount error:', mountError);
              const detail = mountError?.message || mountError?.[0]?.message;
              this.error.set(detail || 'Error al inicializar el formulario de pago.');
              this.loading.set(false);
              return;
            }
            this.formReady.set(true);
            this.loading.set(false);
          },
          onSubmit: (event: Event) => {
            event.preventDefault();
            const data = this.cardForm.getCardFormData();
            this.processing.set(true);
            this.error.set('');

            this.mpService.processPayment(this.token, {
              cardToken: data.token,
              payerEmail: data.cardholderEmail,
              installments: Number(data.installments) || 1,
              identificationType: data.identificationType,
              identificationNumber: data.identificationNumber,
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
          onFetching: () => {
            const progressBar = document.querySelector('.mp-progress-bar') as HTMLProgressElement | null;
            progressBar?.removeAttribute('value');
            return () => progressBar?.setAttribute('value', '0');
          },
        },
      });
    } catch (e: any) {
      console.error('MP init error:', e);
      this.error.set('Error al inicializar MercadoPago: ' + (e?.message || ''));
      this.loading.set(false);
    }
  }
}
