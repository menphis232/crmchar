import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideCircle, LucideCircleCheck, LucideDownload, LucideEye, LucideMail, LucidePhone, LucidePlus, LucideSave, LucideTag, LucideTrash2, LucideUpload, LucideX } from '@lucide/angular';
import { CrmService, UploadService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { CrmContact360, CrmContactVehicle, CrmContactVehicleDocument } from '../../models';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { ENGOMADO_COLORS, engomadoLabel } from '../../shared/engomado-colors';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-crm-contact-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, LucideX, LucideMail, LucidePhone, LucideCircleCheck, LucideCircle, LucidePlus, LucideSave, LucideTrash2, LucideUpload, LucideEye, LucideTag, LucideDownload],
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
    .vehicle-docs {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .vehicle-docs h5 {
      margin: 0 0 8px;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.45);
    }
    .vehicle-doc-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .vehicle-doc-row:last-child { border-bottom: none; }
    .vehicle-doc-name {
      flex: 1;
      min-width: 120px;
      font-size: 13px;
      color: rgba(255,255,255,0.85);
    }
    .vehicle-doc-label {
      font-size: 11px;
      color: var(--gold);
      display: block;
    }
    .vehicle-doc-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .vehicle-doc-actions button {
      font-size: 11px;
      padding: 4px 8px;
    }
    .vehicle-upload-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-end;
      margin-top: 8px;
    }
    .vehicle-upload-row input[type="text"] {
      flex: 1;
      min-width: 140px;
    }
    .vehicle-label-edit {
      display: flex;
      gap: 6px;
      flex: 1;
      min-width: 180px;
    }
    .doc-preview-overlay {
      position: fixed;
      inset: 0;
      z-index: 1200;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .doc-preview-box {
      background: #111;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .doc-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .doc-preview-body {
      flex: 1;
      overflow: auto;
      padding: 12px;
      min-height: 200px;
    }
    .doc-preview-frame {
      width: 100%;
      min-height: 70vh;
      border: none;
      border-radius: 8px;
      background: #fff;
    }
    .doc-preview-image {
      max-width: 100%;
      border-radius: 8px;
    }
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
  uploadingVehicleId = signal<string | null>(null);
  previewDoc = signal<CrmContactVehicleDocument | null>(null);
  labelingDocId = signal<string | null>(null);
  labelDraft = '';

  uploadLabelByVehicle: Record<string, string> = {};

  private uploadService = inject(UploadService);
  private sanitizer = inject(DomSanitizer);

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

  uploadVehicleDocument(vehicle: CrmContactVehicle, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Sube un PDF o una imagen (JPG, PNG, WebP).');
      input.value = '';
      return;
    }

    this.uploadingVehicleId.set(vehicle.id);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: (res) => {
        const label = (this.uploadLabelByVehicle[vehicle.id] || '').trim() || file.name.replace(/\.[^.]+$/, '');
        this.crmService.addContactVehicleDocument(vehicle.id, {
          fileName: file.name,
          fileUrl: res.url,
          label,
        }).subscribe({
          next: () => {
            this.uploadingVehicleId.set(null);
            this.uploadLabelByVehicle[vehicle.id] = '';
            input.value = '';
            const id = this.contactId();
            if (id) this.load(id);
            this.updated.emit();
            this.toast.success('Documento subido');
          },
          error: (e) => {
            this.uploadingVehicleId.set(null);
            input.value = '';
            this.toast.error(e.error?.error || 'Error al guardar el documento');
          },
        });
      },
      error: (e) => {
        this.uploadingVehicleId.set(null);
        input.value = '';
        this.toast.error(e.error?.error || 'Error al subir el archivo');
      },
    });
  }

  openPreview(doc: CrmContactVehicleDocument) {
    this.previewDoc.set(doc);
  }

  closePreview() {
    this.previewDoc.set(null);
  }

  previewFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
  }

  safePreviewUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.previewFileUrl(url));
  }

  isPdfUrl(url: string): boolean {
    return /\.pdf($|\?)/i.test(url || '');
  }

  isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|webp|gif)($|\?)/i.test(url || '');
  }

  downloadDocument(doc: CrmContactVehicleDocument) {
    const name = doc.fileName || doc.label || 'documento';
    const a = document.createElement('a');
    a.href = this.previewFileUrl(doc.fileUrl);
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = name;
    a.click();
  }

  startLabelEdit(doc: CrmContactVehicleDocument) {
    this.labelingDocId.set(doc.id);
    this.labelDraft = doc.label || doc.fileName || '';
  }

  cancelLabelEdit() {
    this.labelingDocId.set(null);
    this.labelDraft = '';
  }

  saveLabel(doc: CrmContactVehicleDocument) {
    const label = this.labelDraft.trim();
    if (!label) {
      this.toast.error('Escribe una etiqueta para el documento');
      return;
    }
    this.crmService.updateContactVehicleDocument(doc.id, label).subscribe({
      next: () => {
        this.labelingDocId.set(null);
        this.labelDraft = '';
        const id = this.contactId();
        if (id) this.load(id);
        this.toast.success('Etiqueta actualizada');
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al guardar etiqueta'),
    });
  }

  deleteVehicleDocument(doc: CrmContactVehicleDocument) {
    if (!confirm('¿Eliminar este documento del vehículo?')) return;
    this.crmService.deleteContactVehicleDocument(doc.id).subscribe({
      next: () => {
        const id = this.contactId();
        if (id) this.load(id);
        this.updated.emit();
        this.toast.success('Documento eliminado');
      },
      error: () => this.toast.error('Error al eliminar documento'),
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('deal-panel-overlay')) {
      this.closed.emit();
    }
  }
}
