import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WhatsappIconComponent } from './whatsapp-icon.component';

export interface WhatsappLeadData {
  dealerSlug: string;
  dealerPhone: string;
  autoId?: string;
  autoLabel?: string;
  dealerName?: string;
}

@Component({
  selector: 'app-whatsapp-lead-modal',
  standalone: true,
  imports: [FormsModule, WhatsappIconComponent],
  styles: [`
    .wl-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .wl-card {
      background: #000; border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px; padding: 24px 22px; width: 100%; max-width: 400px;
      box-shadow: 0 24px 64px rgba(0,0,0,.9);
      font-family: 'Spartan', sans-serif;
      animation: wl-in .2s ease;
    }
    @keyframes wl-in { from { opacity:0; transform:scale(.95) translateY(10px); } to { opacity:1; transform:none; } }
    .wl-logo-wrap {
      display: flex; justify-content: center; margin-bottom: 12px;
    }
    .wl-logo-circle {
      width: 52px; height: 52px; border-radius: 50%;
      background: rgba(37,211,102,.15); border: 1px solid rgba(37,211,102,.35);
      display: flex; align-items: center; justify-content: center;
      color: #25D366;
    }
    .wl-title { font-size: 17px; font-weight: 700; color: #fff; text-align: center; margin: 0 0 4px; }
    .wl-sub { font-size: 12px; color: rgba(255,255,255,.5); text-align: center; margin: 0 0 18px; line-height: 1.45; }
    .wl-badge {
      background: rgba(37,211,102,.12); border: 1px solid rgba(37,211,102,.3);
      border-radius: 8px; padding: 8px 10px; margin-bottom: 16px;
      font-size: 11px; color: rgba(37,211,102,.9); text-align: center; line-height: 1.4;
    }
    .wl-group { margin-bottom: 12px; }
    .wl-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.6); margin-bottom: 4px; display: block; letter-spacing: .04em; text-transform: uppercase; }
    .wl-input {
      width: 100%; box-sizing: border-box;
      background: #111; border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px; padding: 10px 12px; color: #fff; font-size: 13px;
      font-family: inherit; outline: none; transition: border-color .15s;
    }
    .wl-input:focus { border-color: rgba(37,211,102,.6); }
    .wl-input::placeholder { color: rgba(255,255,255,.3); }
    .wl-note { font-size: 10px; color: rgba(255,255,255,.35); margin: 4px 0 0; line-height: 1.4; }
    .wl-btn-wa {
      width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer;
      background: #25D366; color: #fff; font-size: 13px; font-weight: 700;
      font-family: inherit; margin-top: 6px; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: opacity .15s;
    }
    .wl-btn-wa:hover { opacity: .9; }
    .wl-btn-wa:disabled { opacity: .5; cursor: not-allowed; }
    .wl-cancel { width: 100%; background: none; border: none; color: rgba(255,255,255,.4); font-size: 12px; font-family: inherit; cursor: pointer; margin-top: 8px; padding: 6px; }
    .wl-cancel:hover { color: rgba(255,255,255,.7); }
    .wl-error { color: #f87171; font-size: 11px; margin-top: 8px; text-align: center; }
    .wl-success-icon { display: flex; justify-content: center; margin-bottom: 10px; color: #25D366; }
    .wl-success-title { font-size: 17px; font-weight: 700; color: #25D366; text-align: center; margin: 0 0 8px; }
    .wl-success-msg { font-size: 12px; color: rgba(255,255,255,.55); text-align: center; line-height: 1.55; margin: 0 0 16px; }
    .wl-btn-open {
      width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer;
      background: #25D366; color: #fff; font-size: 13px; font-weight: 700;
      font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .wl-btn-open:hover { opacity: .9; }
  `],
  template: `
    <div class="wl-overlay" (click)="onOverlayClick($event)">
      <div class="wl-card" (click)="$event.stopPropagation()">

        @if (!submitted()) {
          <div class="wl-logo-wrap">
            <div class="wl-logo-circle">
              <app-whatsapp-icon [size]="28" />
            </div>
          </div>
          <h2 class="wl-title">Continuar a WhatsApp</h2>
          <p class="wl-sub">
            @if (data.autoLabel) { Interesado en: <strong style="color:#fff">{{ data.autoLabel }}</strong><br> }
            Completa tus datos para continuar.
          </p>

          <div class="wl-badge">
            Tu información se guarda de forma segura. Te crearemos una cuenta para hacer seguimiento.
          </div>

          <div class="wl-group">
            <label class="wl-label">Nombre *</label>
            <input class="wl-input" [(ngModel)]="form.clientName" placeholder="Tu nombre completo" type="text" autocomplete="name">
          </div>

          <div class="wl-group">
            <label class="wl-label">Teléfono / WhatsApp *</label>
            <input class="wl-input" [(ngModel)]="form.clientPhone" placeholder="55 1234 5678" type="tel" autocomplete="tel">
          </div>

          <div class="wl-group">
            <label class="wl-label">Email <span style="opacity:.5">(opcional)</span></label>
            <input class="wl-input" [(ngModel)]="form.clientEmail" placeholder="correo@ejemplo.com" type="email" autocomplete="email">
            <p class="wl-note">Si lo proporcionas, recibirás acceso a tu cuenta para seguir tu consulta.</p>
          </div>

          @if (error()) {
            <p class="wl-error">{{ error() }}</p>
          }

          <button class="wl-btn-wa" (click)="submit()" [disabled]="loading()">
            @if (loading()) { Procesando... }
            @else {
              <app-whatsapp-icon [size]="16" />
              Continuar a WhatsApp
            }
          </button>
          <button class="wl-cancel" (click)="close.emit()">Cancelar</button>

        } @else {
          <div class="wl-success-icon">
            <app-whatsapp-icon [size]="40" />
          </div>
          <h2 class="wl-success-title">¡Todo listo!</h2>
          <p class="wl-success-msg">
            Tu información fue registrada.
            @if (form.clientEmail) {
              Revisa tu correo <strong style="color:#fff">{{ form.clientEmail }}</strong> — te enviamos tus credenciales de acceso.
            }
          </p>
          <button class="wl-btn-open" (click)="openWhatsapp()">
            <app-whatsapp-icon [size]="16" />
            Abrir WhatsApp
          </button>
          <button class="wl-cancel" (click)="close.emit()">Cerrar</button>
        }

      </div>
    </div>
  `,
})
export class WhatsappLeadModalComponent {
  @Input() data!: WhatsappLeadData;
  @Output() close = new EventEmitter<void>();

  private http = inject(HttpClient);

  form = { clientName: '', clientPhone: '', clientEmail: '' };
  loading = signal(false);
  error = signal('');
  submitted = signal(false);

  private resolvedPhone = '';

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('wl-overlay')) this.close.emit();
  }

  submit() {
    if (!this.form.clientName.trim()) { this.error.set('El nombre es obligatorio.'); return; }
    if (!this.form.clientPhone.trim()) { this.error.set('El teléfono es obligatorio.'); return; }
    this.error.set('');
    this.loading.set(true);

    this.http.post<{ ok: boolean; dealerPhone?: string }>(
      `${environment.apiUrl}/concesionaria/whatsapp-lead`,
      {
        dealerSlug: this.data.dealerSlug,
        clientName: this.form.clientName.trim(),
        clientPhone: this.form.clientPhone.trim(),
        clientEmail: this.form.clientEmail.trim() || null,
        autoId: this.data.autoId || null,
      }
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.resolvedPhone = res.dealerPhone || this.data.dealerPhone;
        this.submitted.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Error al procesar. Intenta de nuevo.');
      },
    });
  }

  openWhatsapp() {
    const phone = (this.resolvedPhone || this.data.dealerPhone).replace(/\D/g, '');
    if (!phone) { this.close.emit(); return; }
    const autoText = this.data.autoLabel ? ` el ${this.data.autoLabel}` : ' sus vehículos';
    const text = encodeURIComponent(`Hola ${this.data.dealerName ? this.data.dealerName + ', ' : ''}me llamo ${this.form.clientName} y quisiera información sobre${autoText}.`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    this.close.emit();
  }
}
