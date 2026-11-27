import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasValidSession()) return true;
  router.navigate(['/login/cliente']);
  return false;
};

export const roleGuard = (roles: string[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.hasValidSession()) {
    router.navigate(['/login/cliente']);
    return false;
  }
  const user = auth.user();
  if (user && roles.includes(user.role)) return true;
  // Si ya hay sesión, llevar al panel del rol — nunca al selector de logins.
  const panel = auth.panelPathByRole();
  router.navigate([panel || '/']);
  return false;
};
