import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-magic-login',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="magic-page">
      <div class="magic-card">
        @if (loading()) {
          <div class="magic-spinner"></div>
          <h1>Entrando a tu panel…</h1>
          <p>Estamos iniciando tu sesión de forma segura.</p>
        } @else if (error()) {
          <h1>No se pudo entrar</h1>
          <p>{{ error() }}</p>
          <a routerLink="/login/cliente" class="magic-btn">Iniciar sesión manualmente</a>
        }
      </div>
    </div>
  `,
  styles: [`
    .magic-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background: linear-gradient(180deg, #f4f7fb 0%, #e8eef5 100%);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .magic-card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
      border: 1px solid #e5e7eb;
    }
    h1 { margin: 0 0 8px; font-size: 1.35rem; color: #111827; }
    p { margin: 0 0 20px; color: #4b5563; font-size: 0.95rem; line-height: 1.5; }
    .magic-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 18px;
      border-radius: 10px;
      background: #0073EA;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    .magic-spinner {
      width: 36px;
      height: 36px;
      margin: 0 auto 16px;
      border: 3px solid #dbeafe;
      border-top-color: #0073EA;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class MagicLoginComponent implements OnInit {
  loading = signal(true);
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') || '';
    const next = this.route.snapshot.queryParamMap.get('next') || '/panel/cliente';
    if (!token) {
      this.loading.set(false);
      this.error.set('Link inválido.');
      return;
    }

    this.auth.magicLogin(token).subscribe({
      next: () => {
        const safeNext = next.startsWith('/panel/cliente') ? next : '/panel/cliente';
        this.router.navigateByUrl(safeNext);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Este link ya expiró o fue usado.');
      },
    });
  }
}
