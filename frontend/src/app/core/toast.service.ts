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

  private isLightTheme(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

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
      },
    });
  }

  async confirm(message: string, title = '¿Estás seguro?'): Promise<boolean> {
    const light = this.isLightTheme();
    const result = await Swal.fire({
      title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: light ? '#0073ea' : '#c8a94a',
      cancelButtonColor: light ? '#c5c7d0' : '#555',
      background: light ? '#ffffff' : '#1a1a1a',
      color: light ? '#323338' : '#e2e2e2',
      customClass: {
        popup: light ? 'swal-monday-modal' : 'swal-dark-modal',
        confirmButton: light ? 'swal-btn-primary' : undefined,
        cancelButton: light ? 'swal-btn-cancel-light' : undefined,
      },
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  async confirmDelete(itemLabel: string, options?: {
    title?: string;
    subtitle?: string;
    confirmText?: string;
  }): Promise<boolean> {
    const light = this.isLightTheme();
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
      confirmButtonColor: '#e2445c',
      cancelButtonColor: light ? '#c5c7d0' : '#2a2a2a',
      background: light ? '#ffffff' : '#111111',
      color: light ? '#323338' : '#e8e8e8',
      customClass: {
        popup: light
          ? 'swal-monday-modal swal-delete-modal'
          : 'swal-dark-modal swal-delete-modal',
        confirmButton: 'swal-btn-delete',
        cancelButton: light ? 'swal-btn-cancel-light' : 'swal-btn-cancel',
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
