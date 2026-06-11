import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  mode = signal<'select' | 'login' | 'register'>('select');
  role = signal<'gestor' | 'concesionaria' | 'admin' | 'cliente'>('cliente');
  email = '';
  password = '';
  name = '';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService) {}

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
    this.auth.register({ email: this.email, password: this.password, role: this.role(), name: this.name }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requirePayment && res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.auth.redirectByRole();
        }
      },
      error: (e) => { this.loading.set(false); this.error.set(e.error?.error || 'Error al registrarse'); },
    });
  }
}
