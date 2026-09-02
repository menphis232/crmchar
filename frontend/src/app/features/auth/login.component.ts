import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

export type LoginRole = 'gestor' | 'concesionaria' | 'admin' | 'cliente' | 'perito';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  mode = signal<'login' | 'register' | 'forgot'>('login');
  role = signal<LoginRole>('cliente');
  email = '';
  password = '';
  name = '';
  firstName = '';
  lastName = '';
  companyName = '';
  phone = '';
  error = signal('');
  successMsg = signal('');
  loading = signal(false);

  private querySub?: Subscription;
  private dataSub?: Subscription;

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.auth.redirectByRole();
      return;
    }
    this.dataSub = this.route.data.subscribe(data => {
      this.applyRole((data['role'] as string) || null);
    });
    this.querySub = this.route.queryParamMap.subscribe(params => {
      const queryRole = params.get('role');
      if (queryRole) this.applyRole(queryRole);
    });
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
    this.dataSub?.unsubscribe();
  }

  private applyRole(role: string | null) {
    if (role === 'concesionaria' || role === 'gestor' || role === 'cliente' || role === 'admin' || role === 'perito') {
      this.role.set(role);
    } else {
      this.role.set('cliente');
    }
    this.mode.set('login');
  }

  roleLabel(): string {
    const map: Record<LoginRole, string> = {
      cliente: 'Usuario',
      gestor: 'Consultor',
      concesionaria: 'Concesionaria',
      admin: 'Administrador',
      perito: 'Perito',
    };
    return map[this.role()] || 'Portal';
  }

  isPortalStyle(): boolean {
    const r = this.role();
    return r === 'concesionaria' || r === 'gestor' || r === 'cliente';
  }

  submitLogin() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => { this.loading.set(false); this.auth.redirectByRole(); },
      error: (e) => { this.loading.set(false); this.error.set(e.error?.error || 'Error al iniciar sesión'); },
    });
  }

  submitRegister() {
    this.loading.set(true);
    this.error.set('');
    this.successMsg.set('');

    const role = this.role();
    const payload: {
      email: string;
      password: string;
      role: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      companyName?: string;
      phone?: string;
    } = {
      email: this.email.trim(),
      password: this.password,
      role,
    };

    if (role === 'gestor') {
      payload.firstName = this.firstName.trim();
      payload.lastName = this.lastName.trim();
      payload.companyName = this.companyName.trim();
      payload.phone = this.phone.trim();
      payload.name = this.companyName.trim();
      if (!payload.firstName || !payload.lastName || !payload.companyName || !payload.phone) {
        this.loading.set(false);
        this.error.set('Completa nombre, apellido, empresa, teléfono, correo y contraseña.');
        return;
      }
    } else {
      payload.name = this.name.trim();
      if (!payload.name) {
        this.loading.set(false);
        this.error.set('El nombre comercial es obligatorio.');
        return;
      }
    }

    if (!payload.email || payload.password.length < 6) {
      this.loading.set(false);
      this.error.set('Ingresa un correo válido y una contraseña de al menos 6 caracteres.');
      return;
    }

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requirePayment && res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }
        if (res.requirePayment && !res.checkoutUrl) {
          this.error.set(res.error || 'Cuenta creada. Completa el pago desde el panel.');
          this.auth.redirectByRole();
          return;
        }
        this.auth.redirectByRole();
      },
      error: (e) => {
        this.loading.set(false);
        const msg = e.error?.error || 'Error al registrarse';
        const details = e.error?.details ? ` (${e.error.details})` : '';
        this.error.set(msg + details);
      },
    });
  }

  submitForgot() {
    if (!this.email) {
      this.error.set('Por favor, ingresa tu correo electrónico.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.successMsg.set('');
    this.auth.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMsg.set('Si el correo existe, hemos enviado una clave provisional. Por favor revisa tu bandeja de entrada.');
        this.email = '';
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Hubo un error al intentar restablecer la contraseña.');
      },
    });
  }
}
