import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't show toast for background polling requests
      const silentPaths = ['/crm/dashboard', '/crm/notifications', '/crm/today-inbox'];
      const isSilent = silentPaths.some(p => req.url.includes(p));

      if (!isSilent) {
        let message = 'Ocurrió un error inesperado';

        if (error.status === 0) {
          // Network error or CORS
          message = `No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté corriendo en ${req.url.split('/api')[0]}.`;
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

        toast.error(message);
      }

      return throwError(() => error);
    })
  );
};
