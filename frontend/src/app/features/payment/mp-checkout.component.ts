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
  styleUrl: './mp-checkout.component.css',
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

  showBrick = signal(false);
  brickReady = signal(false);

  private brickController: { unmount?: () => void } | null = null;
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
      .then(() => { this.sdkReady = true; this.tryInitBrick(); })
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
        this.showBrick.set(true);
        this.tryInitBrick();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudo cargar la información de pago.');
        this.loading.set(false);
      },
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitBrick();
  }

  ngOnDestroy() {
    this.brickController?.unmount?.();
    this.brickController = null;
  }

  private tryInitBrick() {
    if (this.initStarted || !this.sdkReady || !this.paymentInfoReady || !this.viewReady) return;
    if (!document.getElementById('cardPaymentBrick_container')) {
      setTimeout(() => this.tryInitBrick(), 50);
      return;
    }
    this.initStarted = true;
    void this.initBrick();
  }

  private async initBrick() {
    try {
      const MercadoPago = (window as any).MercadoPago;
      if (!MercadoPago) {
        this.error.set('SDK de MercadoPago no disponible.');
        this.loading.set(false);
        return;
      }

      const mp = new MercadoPago(this.publicKey, { locale: 'es-MX' });
      const bricksBuilder = mp.bricks();

      this.brickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
        initialization: {
          amount: this.amount,
        },
        customization: {
          visual: {
            style: {
              theme: 'bootstrap',
              customVariables: {
                baseColor: '#009ee3',
                baseColorFirstVariant: '#007eb5',
                baseColorSecondVariant: '#005f87',
                errorColor: '#e53935',
                successColor: '#00a650',
                outlinePrimaryColor: '#009ee3',
                outlineSecondaryColor: '#e0e0e0',
                buttonTextColor: '#ffffff',
                formBackgroundColor: '#ffffff',
                inputBackgroundColor: '#f7f9fc',
                borderRadius: '10px',
                fontSizeExtraSmall: '12px',
                fontSizeSmall: '14px',
                fontSizeMedium: '16px',
                fontSizeLarge: '18px',
                inputVerticalPadding: '12px',
                inputHorizontalPadding: '14px',
              },
            },
            texts: {
              formTitle: 'Datos de la tarjeta',
              formSubmit: `Pagar $${this.amount.toFixed(2)} MXN`,
            },
          },
          paymentMethods: {
            minInstallments: 1,
            maxInstallments: 12,
          },
        },
        callbacks: {
          onReady: () => {
            this.brickReady.set(true);
            this.loading.set(false);
          },
          onError: (brickError: any) => {
            console.error('MP brick error:', brickError);
            const msg = brickError?.message || 'Error en el formulario de pago.';
            this.error.set(msg);
            this.loading.set(false);
          },
          onSubmit: (cardFormData: any) => {
            this.processing.set(true);
            this.error.set('');

            return new Promise<void>((resolve, reject) => {
              this.mpService.processPayment(this.token, {
                cardToken: cardFormData.token,
                paymentMethodId: cardFormData.payment_method_id,
                payerEmail: cardFormData.payer?.email,
                installments: Number(cardFormData.installments) || 1,
                identificationType: cardFormData.payer?.identification?.type,
                identificationNumber: cardFormData.payer?.identification?.number,
              }).subscribe({
                next: (res) => {
                  this.processing.set(false);
                  if (res.success || res.status === 'processed' || res.status === 'approved') {
                    this.success.set(true);
                    resolve();
                    return;
                  }
                  if (res.requiresAction && res.actionUrl) {
                    this.requiresAction.set(true);
                    this.actionUrl.set(res.actionUrl);
                    resolve();
                    return;
                  }
                  const msg = res.message || 'Pago no aprobado. Intenta con otra tarjeta.';
                  this.error.set(msg);
                  reject(new Error(msg));
                },
                error: (err) => {
                  this.processing.set(false);
                  const msg = err.error?.error || 'Error al procesar el pago.';
                  this.error.set(msg);
                  reject(new Error(msg));
                },
              });
            });
          },
        },
      });
    } catch (e: any) {
      console.error('MP brick init error:', e);
      this.error.set('Error al inicializar MercadoPago: ' + (e?.message || ''));
      this.loading.set(false);
    }
  }
}
