import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';

export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

const AUTH_FORM_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/magic-login',
  '/auth/change-password',
  '/auth/change-email',
];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't show toast for background polling requests
      const silentPaths = ['/crm/dashboard', '/crm/notifications', '/crm/today-inbox', '/crm/ai/insights'];
      const isSilent = req.context.get(SKIP_ERROR_TOAST) || silentPaths.some(p => req.url.includes(p));
      const isAuthForm = AUTH_FORM_PATHS.some((p) => req.url.includes(p));

      if (!isSilent) {
        let message = 'Ocurrió un error inesperado';

        if (error.status === 0) {
          // Network error or CORS
          message = `No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté corriendo en ${req.url.split('/api')[0]}.`;
        } else if (error.status === 401 && isAuthForm) {
          // Fallo de login/clave: no tratarlo como sesión expirada ni forzar logout
          message = error.error?.error || 'Credenciales incorrectas';
        } else if (error.status === 401) {
          message = 'Sesión expirada. Vuelve a iniciar sesión.';
          auth.logout();
        } else if (error.status === 403) {
          message = 'No tienes permisos para realizar esta acción.';
        } else if (error.status === 404) {
          message = 'Recurso no encontrado.';
        } else if (error.status === 409) {
          message = error.error?.error || 'Conflicto con datos existentes.';
        } else if (error.status >= 500) {
          message = error.error?.error || error.error?.details || 'Error interno del servidor.';
        } else if (error.error?.error) {
          message = error.error.error;
        }

        // En formularios de auth el componente ya muestra el error en pantalla
        if (!(isAuthForm && error.status === 401)) {
          toast.error(message);
        }
      } else if (error.status === 401 && !isAuthForm) {
        // Polling silencioso con JWT muerto: limpiar sesión sin spam de toast
        auth.logout();
      }

      return throwError(() => error);
    })
  );
};
