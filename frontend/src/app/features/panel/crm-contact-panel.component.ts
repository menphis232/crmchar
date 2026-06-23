import { Component, input, output, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { LucideCircle, LucideCircleCheck, LucideMail, LucidePhone, LucidePlus, LucideSave, LucideTrash2, LucideX } from '@lucide/angular';
import { CrmService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { CrmContact360, CrmContactVehicle } from '../../models';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { ENGOMADO_COLORS, engomadoLabel } from '../../shared/engomado-colors';

@Component({
  selector: 'app-crm-contact-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, LucideX, LucideMail, LucidePhone, LucideCircleCheck, LucideCircle, LucidePlus, LucideSave, LucideTrash2],
  templateUrl: './crm-contact-panel.component.html',
  styleUrls: ['./panel-dashboard.css', './crm-side-panel.theme.css'],
  styles: [`
    .contact-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 640px) { .contact-form-grid { grid-template-columns: 1fr; } }
    .contact-form-grid .full { grid-column: 1 / -1; }
    .contact-form-grid label {
      display: block;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: rgba(255,255,255,0.45);
    }
    .contact-form-grid input,
    .contact-form-grid select,
    .contact-form-grid textarea {
      width: 100%;
      box-sizing: border-box;
    }
    .vehicle-card {
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 10px;
      background: #141414;
    }
    .vehicle-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 10px;
    }
    .vehicle-plate {
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--gold);
    }
    .verification-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .verification-badge.due { border-color: rgba(255,180,80,0.5); color: #ffc966; }
    .verification-badge.soon { border-color: rgba(200,169,74,0.5); color: var(--gold); }
    .verification-badge.overdue { border-color: rgba(255,100,100,0.5); color: #ff9b9b; }
    .vehicle-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 640px) { .vehicle-form-grid { grid-template-columns: 1fr; } }
    .engomado-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .engomado-dot.amarillo { background: #f5d547; }
    .engomado-dot.rosa { background: #e879a8; }
    .engomado-dot.rojo { background: #e74c3c; }
    .engomado-dot.verde { background: #27ae60; }
    .engomado-dot.azul { background: #3498db; }
    .contact-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  `],
})
export class CrmContactPanelComponent {
  contactId = input<string | null>(null);
  stageLabels = input<Record<string, string>>({});

  closed = output<void>();
  openDeal = output<string>();
  updated = output<void>();

  data = signal<CrmContact360 | null>(null);
  isSaving = signal(false);
  isAddingVehicle = signal(false);

  editName = '';
  editEmail = '';
  editPhone = '';
  editWhatsapp = '';
  editResidenceState = '';
  editNotes = '';

  newPlate = '';
  newVehicleState = '';
  newEngomado = '';
  newVehicleNotes = '';

  readonly mexicoStates = MEXICO_STATES;
  readonly engomadoColors = ENGOMADO_COLORS;
  readonly engomadoLabel = engomadoLabel;

  vehicleCount = computed(() => this.data()?.vehicles?.length ?? 0);

  constructor(private crmService: CrmService, private toast: ToastService) {
    effect(() => {
      const id = this.contactId();
      if (id) this.load(id);
      else this.data.set(null);
    });
  }

  private load(id: string) {
    this.crmService.getContact(id).subscribe(d => {
      this.data.set({ ...d, vehicles: d.vehicles || [] });
      this.syncFormFromContact({ ...d, vehicles: d.vehicles || [] });
    });
  }

  private syncFormFromContact(d: CrmContact360) {
    this.editName = d.contact.name || '';
    this.editEmail = d.contact.email || '';
    this.editPhone = d.contact.phone || '';
    this.editWhatsapp = d.contact.whatsapp || '';
    this.editResidenceState = d.contact.residenceState || '';
    this.editNotes = d.contact.notes || '';
  }

  saveContact() {
    const id = this.contactId();
    if (!id) return;
    this.isSaving.set(true);
    this.crmService.updateContact(id, {
      name: this.editName.trim(),
      email: this.editEmail.trim(),
      phone: this.editPhone.trim(),
      whatsapp: this.editWhatsapp.trim(),
      residenceState: this.editResidenceState || undefined,
      notes: this.editNotes.trim(),
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toast.success('Cliente actualizado');
        this.load(id);
        this.updated.emit();
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Error al guardar el cliente');
      },
    });
  }

  addVehicle() {
    const id = this.contactId();
    if (!id || !this.newPlate.trim()) {
      this.toast.error('Indica la placa del vehículo');
      return;
    }
    this.isAddingVehicle.set(true);
    this.crmService.addContactVehicle(id, {
      plate: this.newPlate.trim(),
      state: this.newVehicleState || undefined,
      engomadoColor: this.newEngomado || undefined,
      vehicleNotes: this.newVehicleNotes.trim() || undefined,
    }).subscribe({
      next: () => {
        this.isAddingVehicle.set(false);
        this.newPlate = '';
        this.newVehicleState = '';
        this.newEngomado = '';
        this.newVehicleNotes = '';
        this.toast.success('Vehículo agregado');
        this.load(id);
        this.updated.emit();
      },
      error: () => {
        this.isAddingVehicle.set(false);
        this.toast.error('Error al agregar vehículo');
      },
    });
  }

  updateVehicle(v: CrmContactVehicle, field: string, value: string) {
    const payload: Record<string, string> = { [field]: value };
    this.crmService.updateContactVehicle(v.id, payload).subscribe({
      next: () => {
        const id = this.contactId();
        if (id) this.load(id);
        this.updated.emit();
      },
      error: () => this.toast.error('Error al actualizar vehículo'),
    });
  }

  removeVehicle(vehicleId: string) {
    if (!confirm('¿Quitar este vehículo del cliente?')) return;
    this.crmService.deleteContactVehicle(vehicleId).subscribe({
      next: () => {
        const id = this.contactId();
        if (id) this.load(id);
        this.updated.emit();
      },
      error: () => this.toast.error('Error al eliminar vehículo'),
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('deal-panel-overlay')) {
      this.closed.emit();
    }
  }
}
