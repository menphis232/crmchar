import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-registro-pendiente',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card" style="text-align: center;">
        <h2 style="color: var(--primary);">Registro Pendiente</h2>
        <p style="margin: 16px 0; color: var(--muted); line-height: 1.5;">
          ¡Tu cuenta fue creada con éxito! Sin embargo, cancelaste el proceso de pago.
        </p>
        <p style="margin: 16px 0; color: var(--muted); line-height: 1.5;">
          Para activar tu cuenta y poder ingresar al panel, necesitas completar tu suscripción mensual.
        </p>
        <div style="background: rgba(200, 169, 74, 0.1); padding: 16px; border-radius: 8px; border: 1px solid rgba(200, 169, 74, 0.3); margin: 24px 0;">
          <p style="margin: 0; font-size: 14px;">
            Te hemos enviado un correo a <strong style="color: white;">{{ email() }}</strong> con el enlace para retomar el pago cuando estés listo.
          </p>
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

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }
    });
  }
}
