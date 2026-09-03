import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class ToastService {

  private toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
    customClass: {
      popup: 'swal-dark-toast',
    },
  });

  success(message: string, title = '¡Listo!') {
    this.toast.fire({ icon: 'success', title, text: message });
  }

  error(message: string, title = 'Error') {
    this.toast.fire({ icon: 'error', title, text: message });
  }

  warning(message: string, title = 'Atención') {
    this.toast.fire({ icon: 'warning', title, text: message });
  }

  info(message: string, title = 'Info', onClick?: () => void) {
    this.toast.fire({ 
      icon: 'info', 
      title, 
      text: message,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
        if (onClick) {
          toast.style.cursor = 'pointer';
          toast.addEventListener('click', () => {
            Swal.close();
            onClick();
          });
        }
      }
    });
  }

  async confirm(message: string, title = '¿Estás seguro?'): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8a94a',
      cancelButtonColor: '#555',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      background: '#1a1a1a',
      color: '#e2e2e2',
      customClass: { popup: 'swal-dark-modal' },
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  async confirmDelete(itemLabel: string, options?: {
    title?: string;
    subtitle?: string;
    confirmText?: string;
  }): Promise<boolean> {
    const title = options?.title || '¿Eliminar del embudo?';
    const subtitle = options?.subtitle || 'Esta acción no se puede deshacer.';
    const safeLabel = this.escapeHtml(itemLabel);
    const result = await Swal.fire({
      title,
      html: `
        <p class="swal-delete-sub">${subtitle}</p>
        <p class="swal-delete-item">${safeLabel}</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: options?.confirmText || 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e63d2f',
      cancelButtonColor: '#2a2a2a',
      background: '#111111',
      color: '#e8e8e8',
      customClass: {
        popup: 'swal-dark-modal swal-delete-modal',
        confirmButton: 'swal-btn-delete',
        cancelButton: 'swal-btn-cancel',
      },
      reverseButtons: true,
      focusCancel: true,
    });
    return result.isConfirmed;
  }

  private escapeHtml(text: string): string {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
