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

  info(message: string, title = 'Info') {
    this.toast.fire({ icon: 'info', title, text: message });
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
    });
    return result.isConfirmed;
  }
}
