import { Component, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LucideKeyRound, LucideMail, LucideSettings, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

type Tab = 'password' | 'email';

@Component({
  selector: 'app-change-credentials',
  standalone: true,
  imports: [FormsModule, LucideSettings, LucideX, LucideMail, LucideKeyRound],
  template: `
    <div class="cc-overlay" (click)="closed.emit()">
      <div class="cc-modal" (click)="$event.stopPropagation()">

        <div class="cc-header">
          <span class="cc-title cc-title-with-icon">
            <svg lucideSettings [size]="18" aria-hidden="true"></svg>
            Mi cuenta
          </span>
          <button class="cc-close" type="button" (click)="closed.emit()" aria-label="Cerrar">
            <svg lucideX [size]="18" aria-hidden="true"></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="cc-tabs">
          <button class="cc-tab cc-tab-with-icon" [class.cc-tab--active]="tab() === 'email'" type="button" (click)="tab.set('email')">
            <svg lucideMail [size]="14" aria-hidden="true"></svg>
            Cambiar correo
          </button>
          <button class="cc-tab cc-tab-with-icon" [class.cc-tab--active]="tab() === 'password'" type="button" (click)="tab.set('password')">
            <svg lucideKeyRound [size]="14" aria-hidden="true"></svg>
            Cambiar contraseña
          </button>
        </div>

        <!-- Cambiar contraseña -->
        @if (tab() === 'password') {
          <form class="cc-form" (ngSubmit)="changePassword()">
            <label class="cc-label">Contraseña actual</label>
            <input class="cc-input" type="password" [(ngModel)]="pwCurrent" name="pwCurrent"
                   placeholder="Tu contraseña actual" autocomplete="current-password" required />

            <label class="cc-label">Nueva contraseña</label>
            <input class="cc-input" type="password" [(ngModel)]="pwNew" name="pwNew"
                   placeholder="Mínimo 6 caracteres" autocomplete="new-password" required minlength="6" />

            <label class="cc-label">Confirmar nueva contraseña</label>
            <input class="cc-input" type="password" [(ngModel)]="pwConfirm" name="pwConfirm"
                   placeholder="Repite la nueva contraseña" autocomplete="new-password" required />

            @if (error()) {
              <p class="cc-error">{{ error() }}</p>
            }

            <button class="cc-submit" type="submit" [disabled]="loading()">
              {{ loading() ? 'Guardando...' : 'Cambiar contraseña' }}
            </button>
          </form>
        }

        <!-- Cambiar correo -->
        @if (tab() === 'email') {
          <form class="cc-form" (ngSubmit)="changeEmail()">
            <p class="cc-hint">Correo actual: <strong>{{ auth.user()?.email }}</strong></p>

            <label class="cc-label">Nuevo correo electrónico</label>
            <input class="cc-input" type="email" [(ngModel)]="newEmail" name="newEmail"
                   placeholder="nuevo@correo.com" autocomplete="email" required />

            @if (error()) {
              <p class="cc-error">{{ error() }}</p>
            }

            <button class="cc-submit" type="submit" [disabled]="loading()">
              {{ loading() ? 'Guardando...' : 'Cambiar correo' }}
            </button>
          </form>
        }

      </div>
    </div>
  `,
  styles: [`
    .cc-overlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .cc-modal {
      background: #111; border: 1px solid rgba(255,255,255,.12);
      border-radius: 14px; width: 100%; max-width: 420px;
      overflow: hidden; font-family: 'Spartan', sans-serif;
    }
    .cc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .cc-title { color: #fff; font-size: 15px; font-weight: 700; }
    .cc-title-with-icon, .cc-tab-with-icon {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .cc-tab-with-icon { justify-content: center; }
    .cc-close {
      background: transparent; border: none; color: rgba(255,255,255,.45);
      font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
    }
    .cc-close:hover { color: #fff; background: rgba(255,255,255,.08); }
    .cc-tabs {
      display: flex; border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .cc-tab {
      flex: 1; padding: 12px; background: transparent; border: none;
      color: rgba(255,255,255,.5); font-size: 12px; font-family: inherit;
      cursor: pointer; font-weight: 600; transition: color .15s, background .15s;
      border-bottom: 2px solid transparent;
    }
    .cc-tab:hover { color: rgba(255,255,255,.8); background: rgba(255,255,255,.04); }
    .cc-tab--active { color: #fff; border-bottom-color: #fff; }
    .cc-form {
      display: flex; flex-direction: column; gap: 10px; padding: 20px;
    }
    .cc-hint { color: rgba(255,255,255,.5); font-size: 12px; margin: 0 0 4px; }
    .cc-hint strong { color: rgba(255,255,255,.8); }
    .cc-label { color: rgba(255,255,255,.7); font-size: 12px; font-weight: 600; margin-bottom: -4px; }
    .cc-input {
      width: 100%; padding: 10px 12px; background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12); border-radius: 8px;
      color: #fff; font-size: 13px; font-family: inherit; box-sizing: border-box;
      transition: border-color .15s;
    }
    .cc-input:focus { outline: none; border-color: rgba(255,255,255,.35); }
    .cc-error { color: #f87171; font-size: 12px; margin: 0; }
    .cc-submit {
      margin-top: 6px; padding: 11px; border: none; border-radius: 8px;
      background: #fff; color: #000; font-size: 13px; font-weight: 700;
      font-family: inherit; cursor: pointer; transition: opacity .15s;
    }
    .cc-submit:hover:not(:disabled) { opacity: .88; }
    .cc-submit:disabled { opacity: .4; cursor: not-allowed; }
  `],
})
export class ChangeCredentialsComponent {
  closed = output<void>();

  private http  = inject(HttpClient);
  auth          = inject(AuthService);
  private toast = inject(ToastService);

  tab       = signal<Tab>('email');
  loading   = signal(false);
  error     = signal('');

  // password fields
  pwCurrent = '';
  pwNew     = '';
  pwConfirm = '';

  // email fields
  newEmail = '';
  emailPw  = '';

  changePassword() {
    this.error.set('');
    if (this.pwNew.length < 6) { this.error.set('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (this.pwNew !== this.pwConfirm) { this.error.set('Las contraseñas no coinciden.'); return; }

    this.loading.set(true);
    this.http.patch(`${environment.apiUrl}/auth/change-password`, {
      currentPassword: this.pwCurrent,
      newPassword: this.pwNew,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Contraseña actualizada correctamente', '¡Listo!');
        this.pwCurrent = this.pwNew = this.pwConfirm = '';
        this.closed.emit();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Error al cambiar la contraseña.');
      },
    });
  }

  changeEmail() {
    this.error.set('');
    if (!this.newEmail.includes('@')) { this.error.set('Ingresa un correo válido.'); return; }

    this.loading.set(true);
    this.auth.updateMe({ email: this.newEmail } as any).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Correo actualizado correctamente', '¡Listo!');
        this.newEmail = this.emailPw = '';
        this.closed.emit();
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Error al cambiar el correo.');
      },
    });
  }
}
