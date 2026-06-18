import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 20px;">
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; width: 100%;">
        
        @if (loading()) {
          <div style="font-size: 40px; margin-bottom: 20px;">⏳</div>
          <h2 style="color: var(--mx-white); font-family: var(--f-display); margin-bottom: 10px;">Verificando pago...</h2>
          <p style="color: var(--muted); font-size: 14px;">Por favor espera, estamos activando tu cuenta.</p>
        } @else if (error()) {
          <div style="font-size: 40px; margin-bottom: 20px;">❌</div>
          <h2 style="color: #ff4d4f; font-family: var(--f-display); margin-bottom: 10px;">Hubo un problema</h2>
          <p style="color: var(--muted); font-size: 14px; margin-bottom: 20px;">{{ error() }}</p>
          <a routerLink="/login" class="btn-ghost" style="display: inline-block;">Ir al Login</a>
        } @else {
          <div style="font-size: 40px; margin-bottom: 20px;">✅</div>
          <h2 style="color: var(--mx-green); font-family: var(--f-display); margin-bottom: 10px;">¡Cuenta Activada!</h2>
          <p style="color: var(--muted); font-size: 14px; margin-bottom: 20px;">Tu pago ha sido confirmado y tu cuenta ya está activa.</p>
          <a routerLink="/login" class="btn-copy" style="display: inline-block; text-decoration: none;">INGRESAR AL PANEL</a>
        }

      </div>
    </div>
  `
})
export class SubscriptionSuccessComponent implements OnInit {
  loading = signal(true);
  error = signal('');

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];

      if (!sessionId) {
        this.error.set('Falta el ID de sesión de Stripe.');
        this.loading.set(false);
        return;
      }

      this.http.post<{success: boolean, error?: string}>(`${environment.apiUrl}/payments/confirm-subscription`, { session_id: sessionId })
        .subscribe({
          next: () => {
            this.loading.set(false);
            if (this.auth.isLoggedIn()) {
              this.auth.getMe().subscribe();
            }
            setTimeout(() => this.router.navigate(['/login']), 4000);
          },
          error: (err) => {
            this.error.set(err.error?.error || 'Ocurrió un error al verificar tu pago de suscripción.');
            this.loading.set(false);
          }
        });
    });
  }
}
