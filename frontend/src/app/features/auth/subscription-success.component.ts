import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="login-page login-page--portal">
      <a [href]="tvmMainSite" class="btn-back-top">← VOLVER AL INICIO</a>

      <div class="login-container">
        <div class="login-logo">
          <a [href]="tvmMainSite">
            <img [src]="tvmLogo" alt="Trámites Vehiculares de México" />
          </a>
        </div>
        <div class="login-title">ACCESO AL PORTAL</div>

        <div class="auth-form pending-form">
          @if (loading()) {
            <h2 class="auth-subtitle">Verificando pago</h2>
            <p class="auth-hint">Estamos activando tu cuenta. Espera un momento…</p>
          } @else if (error()) {
            <h2 class="auth-subtitle">Hubo un problema</h2>
            <p class="auth-hint error-msg">{{ error() }}</p>
            <a routerLink="/login/gestor" class="btn-submit pending-btn">IR AL LOGIN</a>
          } @else {
            <h2 class="auth-subtitle">Cuenta activada</h2>
            <p class="auth-hint">
              @if (isTrial()) {
                Tu prueba gratuita de 7 días ha comenzado. Ya puedes usar tu panel.
              } @else {
                Tu suscripción fue confirmada y tu cuenta ya está activa.
              }
            </p>
            <a routerLink="/login/gestor" class="btn-submit pending-btn">INGRESAR AL PANEL</a>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pending-form { text-align: center; }
    .pending-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      box-sizing: border-box;
      margin-top: 8px;
    }
  `],
  styleUrl: './login.component.css',
})
export class SubscriptionSuccessComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  loading = signal(true);
  error = signal('');
  isTrial = signal(false);

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];

      if (!sessionId) {
        this.error.set('Falta el ID de sesión de Stripe.');
        this.loading.set(false);
        return;
      }

      this.http
        .post<{ success: boolean; trial?: boolean; error?: string }>(
          `${environment.apiUrl}/payments/confirm-subscription`,
          { session_id: sessionId },
        )
        .subscribe({
          next: (res) => {
            this.isTrial.set(!!res.trial);
            this.loading.set(false);
            if (this.auth.isLoggedIn()) {
              this.auth.getMe().subscribe();
            }
            setTimeout(() => this.router.navigate(['/login/gestor']), 4000);
          },
          error: (err) => {
            this.error.set(err.error?.error || 'Ocurrió un error al verificar tu pago de suscripción.');
            this.loading.set(false);
          },
        });
    });
  }
}
