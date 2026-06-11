import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models';

const TOKEN_KEY = 'tramites_token';
const USER_KEY = 'tramites_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(this.loadUser());
  readonly isLoggedIn = signal(!!this.getToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<{ token: string; user: User }>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => this.setSession(res.token, res.user))
    );
  }

  register(data: { email: string; password: string; role: string; name: string }) {
    return this.http.post<{ token?: string; user?: User; requirePayment?: boolean; checkoutUrl?: string }>(`${environment.apiUrl}/auth/register`, data).pipe(
      tap(res => {
        if (!res.requirePayment && res.token && res.user) {
          this.setSession(res.token, res.user);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setSession(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
    this.isLoggedIn.set(true);
  }

  private loadUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  redirectByRole() {
    const role = this.user()?.role;
    if (role === 'gestor') this.router.navigate(['/panel/gestor']);
    else if (role === 'concesionaria') this.router.navigate(['/panel/concesionaria']);
    else if (role === 'admin') this.router.navigate(['/panel/admin']);
    else if (role === 'cliente') this.router.navigate(['/panel/cliente']);
    else this.router.navigate(['/']);
  }

  updateMe(data: { name?: string; logo_url?: string; pdf_settings?: any; google_analytics_id?: string; stripe_secret_key?: string; stripe_public_key?: string; ai_provider?: string; ai_api_key?: string; page_builder_config?: any; chatbot_bg_color?: string; chatbot_btn_color?: string; chatbot_text_color?: string; }) {
    return this.http.patch<{ user: User }>(`${environment.apiUrl}/auth/me`, data).pipe(
      tap(res => {
        const token = this.getToken();
        if (token) this.setSession(token, res.user);
      })
    );
  }

  getMe() {
    return this.http.get<{ user: User }>(`${environment.apiUrl}/auth/me`);
  }
}
