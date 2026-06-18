import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-registro-pendiente',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card" style="text-align: center;">
        <h2 style="color: var(--primary);">Registro Pendiente</h2>
        <p style="margin: 16px 0; color: var(--muted); line-height: 1.5;">
          ¡Tu cuenta fue creada con éxito! Sin embargo, no completaste el pago.
        </p>
        <p style="margin: 16px 0; color: var(--muted); line-height: 1.5;">
          Para activar tu cuenta y usar el panel, completa tu suscripción mensual.
        </p>
        <div style="background: rgba(200, 169, 74, 0.1); padding: 16px; border-radius: 8px; border: 1px solid rgba(200, 169, 74, 0.3); margin: 24px 0;">
          @if (emailSent()) {
            <p style="margin: 0; font-size: 14px;">
              Te enviamos un correo a <strong style="color: white;">{{ email() }}</strong> con el enlace para activar tu cuenta.
            </p>
          } @else if (sending()) {
            <p style="margin: 0; font-size: 14px; color: var(--muted);">Enviando correo de activación…</p>
          } @else {
            <p style="margin: 0; font-size: 14px; color: #ff6b6b;">{{ error() || 'No se pudo enviar el correo. Inicia sesión e intenta desde el panel.' }}</p>
          }
        </div>
        <a routerLink="/login" class="btn-copy full" style="text-decoration: none; display: inline-block;">
          IR AL LOGIN
        </a>
      </div>
    </div>
  `,
  styleUrl: './login.component.css'
})
export class RegistroPendienteComponent implements OnInit {
  email = signal<string>('');
  emailSent = signal(false);
  sending = signal(false);
  error = signal('');

  private http = inject(HttpClient);

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
        this.sendActivationEmail(params['email']);
      }
    });
  }

  private sendActivationEmail(email: string) {
    this.sending.set(true);
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
        this.error.set(err.error?.error || 'Error al enviar correo');
      },
    });
  }
}
