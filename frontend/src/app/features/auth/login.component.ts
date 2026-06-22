import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  mode = signal<'select' | 'login' | 'register' | 'forgot'>('select');
  role = signal<'gestor' | 'concesionaria' | 'admin' | 'cliente'>('cliente');
  directRoleLogin = signal(false);
  email = '';
  password = '';
  name = '';
  error = signal('');
  successMsg = signal('');
  loading = signal(false);

  private querySub?: Subscription;

  constructor(private auth: AuthService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.querySub = this.route.queryParamMap.subscribe(params => {
      this.applyRoleFromQuery(params.get('role'));
    });
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
  }

  private applyRoleFromQuery(role: string | null) {
    if (role === 'concesionaria' || role === 'gestor' || role === 'cliente') {
      this.role.set(role);
      this.mode.set('login');
      this.directRoleLogin.set(true);
    } else {
      this.directRoleLogin.set(false);
    }
  }

  backHomeLink(): string {
    return this.role() === 'gestor' ? '/gestores' : '/autos';
  }

  selectRole(r: 'gestor' | 'concesionaria' | 'cliente') {
    this.role.set(r);
    this.mode.set('login');
  }

  loginAsAdmin() {
    this.role.set('admin');
    this.mode.set('login');
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
    this.auth.register({ email: this.email, password: this.password, role: this.role(), name: this.name }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requirePayment && res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.auth.redirectByRole();
        }
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
      }
    });
  }
}
