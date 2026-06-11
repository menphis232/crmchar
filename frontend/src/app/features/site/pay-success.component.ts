import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pay-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 20px;">
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; width: 100%;">
        
        @if (loading) {
          <div style="font-size: 40px; margin-bottom: 20px;">⏳</div>
          <h2 style="color: var(--mx-white); font-family: var(--f-display); margin-bottom: 10px;">Verificando pago...</h2>
          <p style="color: var(--muted); font-size: 14px;">Por favor espera, no cierres esta ventana.</p>
        } @else if (error) {
          <div style="font-size: 40px; margin-bottom: 20px;">❌</div>
          <h2 style="color: #ff4d4f; font-family: var(--f-display); margin-bottom: 10px;">Hubo un problema</h2>
          <p style="color: var(--muted); font-size: 14px; margin-bottom: 20px;">{{ error }}</p>
          <a routerLink="/" class="btn-ghost" style="display: inline-block;">Volver al inicio</a>
        } @else {
          <div style="font-size: 40px; margin-bottom: 20px;">✅</div>
          <h2 style="color: var(--mx-green); font-family: var(--f-display); margin-bottom: 10px;">¡Pago Exitoso!</h2>
          <p style="color: var(--muted); font-size: 14px; margin-bottom: 20px;">Tu pago ha sido procesado correctamente y el trámite ha sido actualizado.</p>
          <a routerLink="/" class="btn-copy" style="display: inline-block; text-decoration: none;">Volver al inicio</a>
        }

      </div>
    </div>
  `
})
export class PaySuccessComponent implements OnInit {
  loading = true;
  error = '';

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];
      const dealId = params['deal_id'];

      if (!sessionId || !dealId) {
        this.error = 'Faltan parámetros en la URL.';
        this.loading = false;
        return;
      }

      this.http.post<{success: boolean, error?: string}>(`${environment.apiUrl}/payments/confirm`, { session_id: sessionId, deal_id: dealId })
        .subscribe({
          next: () => {
            this.loading = false;
          },
          error: (err) => {
            this.error = err.error?.error || 'Ocurrió un error al verificar el pago.';
            this.loading = false;
          }
        });
    });
  }
}
