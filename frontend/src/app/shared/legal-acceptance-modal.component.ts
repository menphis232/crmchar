import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { TVM_PRIVACY_URL, TVM_TERMS_URL } from './brand.constants';

@Component({
  selector: 'app-legal-acceptance-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (visible()) {
      <div class="la-overlay" role="dialog" aria-modal="true" aria-labelledby="la-title">
        <div class="la-card">
          <h2 id="la-title" class="la-title">Acepta para continuar</h2>
          <p class="la-sub">
            Antes de usar el panel debes aceptar los Términos y condiciones y el Aviso de privacidad.
          </p>

          <label class="la-check">
            <input type="checkbox" [(ngModel)]="acceptTerms" name="laTerms" />
            <span>
              Acepto los
              <a [href]="termsUrl" target="_blank" rel="noopener noreferrer">Términos y condiciones</a>
            </span>
          </label>

          <label class="la-check">
            <input type="checkbox" [(ngModel)]="acceptPrivacy" name="laPrivacy" />
            <span>
              Acepto el
              <a [href]="privacyUrl" target="_blank" rel="noopener noreferrer">Aviso de privacidad</a>
            </span>
          </label>

          @if (error()) {
            <p class="la-error">{{ error() }}</p>
          }

          <button
            type="button"
            class="la-btn"
            [disabled]="loading() || !acceptTerms || !acceptPrivacy"
            (click)="submit()"
          >
            {{ loading() ? 'Guardando...' : 'Aceptar y continuar' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .la-overlay {
      position: fixed; inset: 0; z-index: 10050;
      background: rgba(0,0,0,.82); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .la-card {
      width: 100%; max-width: 420px;
      background: #0a0a0a; border: 1px solid rgba(255,255,255,.12);
      border-radius: 14px; padding: 24px 22px;
      box-shadow: 0 24px 64px rgba(0,0,0,.85);
      font-family: inherit;
    }
    .la-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #fff; }
    .la-sub { margin: 0 0 18px; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.55); }
    .la-check {
      display: flex; gap: 10px; align-items: flex-start;
      margin-bottom: 12px; font-size: 13px; color: rgba(255,255,255,.85);
      text-align: left; cursor: pointer;
    }
    .la-check input { margin-top: 2px; flex-shrink: 0; }
    .la-check a { color: #7dd3fc; text-decoration: underline; }
    .la-error { color: #f87171; font-size: 12px; margin: 4px 0 10px; }
    .la-btn {
      width: 100%; margin-top: 8px; padding: 12px; border: none; border-radius: 10px;
      background: #e11d48; color: #fff; font-weight: 700; font-size: 13px;
      cursor: pointer; font-family: inherit;
    }
    .la-btn:disabled { opacity: .45; cursor: not-allowed; }
    .la-btn:not(:disabled):hover { opacity: .92; }
  `],
})
export class LegalAcceptanceModalComponent {
  private auth = inject(AuthService);

  readonly termsUrl = TVM_TERMS_URL;
  readonly privacyUrl = TVM_PRIVACY_URL;

  visible = signal(false);
  loading = signal(false);
  error = signal('');
  acceptTerms = false;
  acceptPrivacy = false;

  constructor() {
    effect(() => {
      // Lee señales de sesión para reaccionar a login / getMe / acceptLegal.
      this.auth.isLoggedIn();
      this.auth.user();
      this.visible.set(this.auth.isLoggedIn() && this.auth.needsLegalAcceptance());
    });
  }

  submit() {
    if (!this.acceptTerms || !this.acceptPrivacy) {
      this.error.set('Debes aceptar ambos documentos.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.acceptLegal(true, true).subscribe({
      next: () => {
        this.loading.set(false);
        this.visible.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.error || 'No se pudo guardar la aceptación');
      },
    });
  }
}
