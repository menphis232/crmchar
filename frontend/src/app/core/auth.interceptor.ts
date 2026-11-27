import { HttpInterceptorFn } from '@angular/common/http';

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload?.exp) return false;
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('tramites_token');
  // No mandar Bearer vencido (rompe UX de re-login y contamina /auth/login)
  if (token && !isJwtExpired(token)) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  } else if (token) {
    localStorage.removeItem('tramites_token');
    localStorage.removeItem('tramites_user');
  }
  return next(req);
};
