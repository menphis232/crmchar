import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

@Component({
  selector: 'app-registro-pendiente',
  standalone: true,
  imports: [RouterLink],
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
          <h2 class="auth-subtitle">Pago pendiente</h2>
          <p class="auth-hint">
            Tu cuenta ya está creada. Para activarla y usar el panel, completa el pago de tu suscripción.
          </p>

          <div class="pending-box">
            @if (emailSent()) {
              <p class="pending-msg">
                Te enviamos un correo a
                <strong>{{ email() }}</strong>
                con el enlace para completar el pago.
              </p>
            } @else if (sending()) {
              <p class="pending-msg muted">Enviando correo de activación…</p>
            } @else if (error()) {
              <p class="pending-msg error">{{ error() }}</p>
            } @else {
              <p class="pending-msg muted">
                Inicia sesión con tu correo y contraseña; el panel te pedirá completar el pago.
              </p>
            }
          </div>

          <a routerLink="/login/gestor" class="btn-submit pending-btn">IR AL LOGIN</a>

          @if (email()) {
            <div class="auth-links">
              <button type="button" class="link-btn" [disabled]="sending()" (click)="resend()">
                {{ sending() ? 'Enviando…' : 'Reenviar enlace de pago' }}
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pending-form { text-align: center; }
    .pending-box {
      margin: 0 0 22px;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(200, 169, 74, 0.35);
      background: rgba(200, 169, 74, 0.1);
    }
    .pending-msg {
      margin: 0;
      font-size: 14px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.85);
      word-break: break-word;
    }
    .pending-msg strong {
      color: #c8a94a;
      font-weight: 700;
    }
    .pending-msg.muted { color: rgba(255, 255, 255, 0.55); }
    .pending-msg.error { color: #ff6b6b; }
    .pending-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      box-sizing: border-box;
    }
    .auth-links { margin-top: 16px; }
    .link-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
  styleUrl: './login.component.css',
})
export class RegistroPendienteComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  email = signal('');
  emailSent = signal(false);
  sending = signal(false);
  error = signal('');

  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
        this.sendActivationEmail(params['email']);
      }
    });
  }

  resend() {
    const email = this.email();
    if (!email || this.sending()) return;
    this.sendActivationEmail(email);
  }

  private sendActivationEmail(email: string) {
    this.sending.set(true);
    this.error.set('');
    this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/send-activation-email`, { email }).subscribe({
      next: () => {
        this.sending.set(false);
        this.emailSent.set(true);
      },
      error: (err) => {
        this.sending.set(false);
        if (err.status === 200 || err.error?.message?.includes('activa')) {
          this.emailSent.set(true);
          return;
        }
        this.error.set(err.error?.error || 'No se pudo enviar el correo. Inicia sesión e intenta desde el panel.');
      },
    });
  }
}
