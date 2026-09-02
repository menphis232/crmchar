import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models';
import { OneSignalService } from './onesignal.service';

const TOKEN_KEY = 'tramites_token';
const USER_KEY = 'tramites_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(this.loadUser());
  readonly isLoggedIn = signal(!!this.getToken());

  constructor(
    private http: HttpClient,
    private router: Router,
    private oneSignal: OneSignalService,
  ) {}

  login(email: string, password: string) {
    return this.http.post<{ token: string; user: User }>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => this.setSession(res.token, res.user))
    );
  }

  forgotPassword(email: string) {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  register(data: {
    email: string;
    password: string;
    role: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
  }) {
    return this.http.post<{
      token?: string;
      user?: User;
      requirePayment?: boolean;
      checkoutUrl?: string;
      error?: string;
    }>(`${environment.apiUrl}/auth/register`, data).pipe(
      tap(res => {
        if (!res.requirePayment && res.token && res.user) {
          this.setSession(res.token, res.user);
        } else if (res.requirePayment && !res.checkoutUrl && res.token && res.user) {
          // Cuenta creada pero Stripe falló: entrar al panel bloqueado para poder pagar.
          this.setSession(res.token, res.user);
        }
      })
    );
  }

  logout() {
    const target = this.loginPathAfterLogout();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.isLoggedIn.set(false);
    this.oneSignal.syncUser(null);
    this.router.navigate([target]);
  }

  /** Login contextual al cerrar sesión desde un panel específico. */
  private loginPathAfterLogout(): string {
    const path = this.router.url.split('?')[0];
    if (path.startsWith('/panel/concesionaria')) return '/login/concesionaria';
    if (path.startsWith('/panel/gestor')) return '/login/gestor';
    if (path.startsWith('/panel/perito')) return '/login/perito';
    if (path.startsWith('/panel/cliente')) return '/login/cliente';
    return '/login/cliente';
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setSession(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
    this.isLoggedIn.set(true);
    this.oneSignal.syncUser(user.id, user.role);
  }

  private loadUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /** Ruta del panel según el rol de sesión. Nunca debe devolver /login si hay sesión. */
  panelPathByRole(role?: string | null): string | null {
    const r = role ?? this.user()?.role;
    if (r === 'gestor') return '/panel/gestor';
    if (r === 'concesionaria') return '/panel/concesionaria';
    if (r === 'admin' || r === 'super_admin') return '/panel/admin';
    if (r === 'cliente') return '/panel/cliente';
    if (r === 'perito') return '/panel/perito';
    return null;
  }

  redirectByRole() {
    const path = this.panelPathByRole();
    this.router.navigate([path || '/']);
  }

  updateMe(data: { name?: string; avatar_url?: string | null; logo_url?: string; pdf_settings?: any; google_analytics_id?: string; stripe_secret_key?: string; stripe_public_key?: string; stripe_price_id?: string; stripe_price_id_gestor?: string; mp_access_token?: string; mp_public_key?: string; ai_provider?: string; ai_api_key?: string; page_builder_config?: any; chatbot_bg_color?: string; chatbot_btn_color?: string; chatbot_text_color?: string; panel_assistant_enabled?: boolean; panel_assistant_name?: string; panel_assistant_position?: string; panel_assistant_bg_color?: string; panel_assistant_btn_color?: string; panel_assistant_text_color?: string; panel_assistant_font?: string; panel_assistant_prompt?: string | null; chat_ai_auto_reply_enabled?: boolean; chat_ai_inactivity_minutes?: number; description?: string | null; phone?: string | null; address?: string | null; map_embed_url?: string | null; crm_stages?: any[]; }) {
    return this.http.patch<{ user: User }>(`${environment.apiUrl}/auth/me`, data).pipe(
      tap(res => {
        const token = this.getToken();
        if (token) this.setSession(token, res.user);
      })
    );
  }

  getMe() {
    return this.http.get<{ user: User }>(`${environment.apiUrl}/auth/me`).pipe(
      tap(res => {
        const token = this.getToken();
        if (token) this.setSession(token, res.user);
      })
    );
  }
}
