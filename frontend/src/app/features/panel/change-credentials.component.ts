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

            <label class="cc-label">Contraseña actual</label>
            <input class="cc-input" type="password" [(ngModel)]="emailPw" name="emailPw"
                   placeholder="Confirma tu contraseña" autocomplete="current-password" required />

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
      background: rgba(50, 51, 56, 0.42);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .cc-modal {
      background: #fff; border: 1px solid #e6e9ef;
      border-radius: 12px; width: 100%; max-width: 420px;
      overflow: hidden; font-family: Figtree, system-ui, sans-serif;
      box-shadow: 0 16px 40px rgba(50, 51, 56, 0.18);
      color: #323338;
    }
    .cc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e6e9ef;
    }
    .cc-title { color: #323338; font-size: 16px; font-weight: 700; }
    .cc-title-with-icon, .cc-tab-with-icon {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .cc-tab-with-icon { justify-content: center; }
    .cc-close {
      background: transparent; border: none; color: #676879;
      font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
    }
    .cc-close:hover { color: #323338; background: #f5f6f8; }
    .cc-tabs {
      display: flex; border-bottom: 1px solid #e6e9ef;
    }
    .cc-tab {
      flex: 1; padding: 12px; background: transparent; border: none;
      color: #676879; font-size: 13px; font-family: inherit;
      cursor: pointer; font-weight: 600; transition: color .15s, background .15s;
      border-bottom: 2px solid transparent;
    }
    .cc-tab:hover { color: #323338; background: #f7f8fa; }
    .cc-tab--active { color: #0073ea; border-bottom-color: #0073ea; }
    .cc-form {
      display: flex; flex-direction: column; gap: 10px; padding: 20px;
    }
    .cc-hint { color: #676879; font-size: 13px; margin: 0 0 4px; }
    .cc-hint strong { color: #323338; }
    .cc-label { color: #323338; font-size: 13px; font-weight: 600; margin-bottom: -4px; }
    .cc-input {
      width: 100%; padding: 10px 12px; background: #fff;
      border: 1px solid #e6e9ef; border-radius: 8px;
      color: #323338; font-size: 14px; font-family: inherit; box-sizing: border-box;
      transition: border-color .15s;
    }
    .cc-input::placeholder { color: #9ca0ad; }
    .cc-input:focus { outline: none; border-color: #0073ea; box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.12); }
    .cc-error { color: #e2445c; font-size: 12px; margin: 0; }
    .cc-submit {
      margin-top: 6px; padding: 11px; border: 1px solid #0073ea; border-radius: 8px;
      background: #0073ea; color: #fff; font-size: 14px; font-weight: 600;
      font-family: inherit; cursor: pointer; transition: background .15s;
    }
    .cc-submit:hover:not(:disabled) { background: #0060c2; }
    .cc-submit:disabled { opacity: .45; cursor: not-allowed; }
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
    const email = this.newEmail.trim().toLowerCase();
    if (!email.includes('@') || !email.includes('.')) {
      this.error.set('Ingresa un correo válido.');
      return;
    }
    if (!this.emailPw) {
      this.error.set('Confirma tu contraseña actual.');
      return;
    }

    this.loading.set(true);
    this.auth.changeEmail(email, this.emailPw).subscribe({
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
