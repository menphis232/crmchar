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
import { VehicleMmySelectComponent } from '../../shared/vehicle-mmy-select.component';
import { formatVehicleLabel } from '../../shared/mexico-vehicle-catalog';

@Component({
  selector: 'app-crm-contact-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, VehicleMmySelectComponent, LucideX, LucideMail, LucidePhone, LucideCircleCheck, LucideCircle, LucidePlus, LucideSave, LucideTrash2, LucideUpload, LucideEye, LucideTag, LucideDownload],
  templateUrl: './crm-contact-panel.component.html',
  styleUrls: ['./panel-dashboard.css'],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      --mon-primary: #0073ea;
      --brand-black: #323338;
      --brand-white: #ffffff;
      --surface: #ffffff;
      --muted: #676879;
      --gold: #0073ea;
      color-scheme: light;
      font-family: 'Figtree', system-ui, sans-serif;
      color: #323338;
    }
    .deal-page {
      display: block;
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      padding: 0 0 48px;
      box-sizing: border-box;
    }
    .deal-page-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 12px;
    }
    .deal-back-btn {
      border: none;
      background: transparent;
      color: #0073ea;
      font-family: 'Figtree', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 0;
    }
    .deal-back-btn:hover { text-decoration: underline; }
    .contact-loading {
      margin: 24px 0;
      color: #676879;
      font-size: 14px;
    }
    .deal-panel {
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #323338 !important;
      overflow: visible !important;
      display: block !important;
      animation: none !important;
      padding: 0 !important;
    }
    .deal-panel-header {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      color: #323338 !important;
    }
    .deal-panel-eyebrow {
      color: #676879 !important;
      margin: 0 0 4px;
    }
    .deal-panel-header h3 { color: #323338 !important; }
    .deal-panel-body {
      background: transparent !important;
      color: #323338 !important;
      overflow: visible !important;
      padding: 8px 0 0 !important;
    }
    .deal-section {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      padding: 16px 18px !important;
      margin-bottom: 12px !important;
    }
    .deal-section h4 {
      color: #676879 !important;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px !important;
    }
    .card-desc { color: #676879 !important; }
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
      color: #676879;
    }
    .contact-form-grid input,
    .contact-form-grid select,
    .contact-form-grid textarea {
      width: 100%;
      box-sizing: border-box;
      background: #fff;
      border: 1px solid #c5c7d0;
      border-radius: 8px;
      color: #323338;
      padding: 8px 10px;
    }
    .vehicle-card {
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 10px;
      background: #f7f8fa;
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
      color: #0073ea;
    }
    .vehicle-mmy {
      margin: 0;
      font-size: 13px;
      color: #676879;
    }
    .verification-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid #c5c7d0;
      background: #fff;
    }
    .verification-badge.due { border-color: #fdab3d; color: #c87d0c; }
    .verification-badge.soon { border-color: #0073ea; color: #0073ea; }
    .verification-badge.overdue { border-color: #e2445c; color: #e2445c; }
    .vehicle-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 640px) { .vehicle-form-grid { grid-template-columns: 1fr; } }
    .vehicle-form-grid .full { grid-column: 1 / -1; }
    .vehicle-form-grid input,
    .vehicle-form-grid select,
    .vehicle-form-grid textarea {
      width: 100%;
      box-sizing: border-box;
      background: #fff;
      border: 1px solid #c5c7d0;
      border-radius: 8px;
      color: #323338;
      padding: 8px 10px;
    }
    .engomado-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
      border: 1px solid rgba(0,0,0,0.15);
    }
    .engomado-dot.amarillo { background: #f5d547; }
    .engomado-dot.rosa { background: #e879a8; }
    .engomado-dot.rojo { background: #e74c3c; }
    .engomado-dot.verde { background: #27ae60; }
    .engomado-dot.azul { background: #3498db; }
    .contact-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
      align-items: center;
    }
    .contact-actions .deal-outline-btn,
    .deal-panel .deal-outline-btn,
    button.deal-outline-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      min-height: 40px !important;
      padding: 10px 16px !important;
      box-sizing: border-box !important;
      background: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border: 1px solid #c5c7d0 !important;
      border-radius: 8px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      line-height: 1.2 !important;
      cursor: pointer !important;
      white-space: nowrap;
    }
    .contact-actions .deal-outline-btn:hover:not(:disabled),
    button.deal-outline-btn:hover:not(:disabled) {
      background: #f5f6f8 !important;
      border-color: #0073ea !important;
      color: #0073ea !important;
      -webkit-text-fill-color: #0073ea !important;
    }
    .contact-actions .deal-outline-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .contact-actions .btn-with-icon svg {
      flex-shrink: 0;
    }
    .vehicle-docs {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e6e9ef;
    }
    .vehicle-docs h5 {
      margin: 0 0 8px;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #676879;
    }
    .vehicle-doc-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #e6e9ef;
    }
    .vehicle-doc-row:last-child { border-bottom: none; }
    .vehicle-doc-name {
      flex: 1;
      min-width: 120px;
      font-size: 13px;
      color: #323338;
    }
    .vehicle-doc-label {
      font-size: 11px;
      color: #0073ea;
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
      color: #fff;
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
    .mon-access-overlay {
      position: fixed;
      inset: 0;
      z-index: 5000;
      background: rgba(50, 51, 56, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .mon-access-modal {
      position: relative;
      width: min(440px, 100%);
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      padding: 28px 24px 22px;
      box-shadow: 0 16px 48px rgba(50, 51, 56, 0.18);
      color: #323338;
      font-family: 'Figtree', system-ui, sans-serif;
    }
    .mon-access-close {
      position: absolute;
      top: 14px;
      right: 14px;
    }
    .mon-access-eyebrow {
      margin: 0 0 6px;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9ca0ad;
    }
    .mon-access-title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #323338;
    }
    .mon-access-desc {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.55;
      color: #676879;
    }
    .mon-access-creds {
      display: grid;
      gap: 10px;
      padding: 14px 16px;
      margin: 0 0 14px;
      background: #f7f8fa;
      border: 1px solid #e6e9ef;
      border-radius: 10px;
    }
    .mon-access-row { display: grid; gap: 2px; }
    .mon-access-label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #676879;
    }
    .mon-access-value { font-size: 16px; color: #323338; font-weight: 700; }
    .mon-access-value--mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: 0.04em;
    }
    .mon-access-hint {
      margin: 0 0 16px;
      font-size: 12px;
      line-height: 1.5;
      color: #676879;
    }
    .mon-access-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .mon-access-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid #c5c7d0;
      border-radius: 8px;
      background: #fff;
      color: #323338;
      font-family: 'Figtree', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    .mon-access-btn:hover:not(:disabled) { border-color: #0073ea; color: #0073ea; }
    .mon-access-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .mon-access-btn--primary {
      background: #0073ea;
      border-color: #0073ea;
      color: #fff;
    }
    .mon-access-btn--primary:hover:not(:disabled) {
      background: #0060c2;
      border-color: #0060c2;
      color: #fff;
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
  loading = signal(false);
  isSaving = signal(false);
  isCreatingAccess = signal(false);
  clientAccessNotice = signal<{
    created: boolean;
    login: string;
    password?: string | null;
    emailed?: boolean;
    whatsappUrl?: string | null;
  } | null>(null);
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
  newMake = '';
  newModel = '';
  newYear: number | null = null;
  newVehicleState = '';
  newEngomado = '';
  newVehicleNotes = '';
  newInsuranceExpiry = '';
  newTenencia = '';

  readonly mexicoStates = MEXICO_STATES;
  readonly engomadoColors = ENGOMADO_COLORS;
  readonly engomadoLabel = engomadoLabel;
  readonly formatVehicleLabel = formatVehicleLabel;
  readonly tenenciaOptions = [
    { value: 'si', label: 'Sí, pagada' },
    { value: 'no', label: 'No pagada' },
    { value: 'pendiente', label: 'Pendiente' },
  ];
  readonly currentYear = new Date().getFullYear();

  vehicleCount = computed(() => this.data()?.vehicles?.length ?? 0);

  constructor(private crmService: CrmService, private toast: ToastService) {
    effect(() => {
      const id = this.contactId();
      if (id) this.load(id);
      else {
        this.data.set(null);
        this.loading.set(false);
      }
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.data.set(null);
    this.crmService.getContact(id).subscribe({
      next: (d) => {
        const payload = { ...d, vehicles: d.vehicles || [] };
        this.data.set(payload);
        this.syncFormFromContact(payload);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo abrir la ficha del cliente');
        this.closed.emit();
      },
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

  createClientAccess(reset = false) {
    const id = this.contactId();
    if (!id) return;
    this.isCreatingAccess.set(true);
    this.crmService.createContactClientAccess(id, reset).subscribe({
      next: (access) => {
        this.isCreatingAccess.set(false);
        this.clientAccessNotice.set(access);
      },
      error: (e) => {
        this.isCreatingAccess.set(false);
        this.toast.error(e.error?.error || 'No se pudo crear el usuario');
      },
    });
  }

  copyClientAccess() {
    const access = this.clientAccessNotice();
    if (!access) return;
    const lines = [`Usuario: ${access.login}`];
    if (access.password) lines.push(`Contraseña: ${access.password}`);
    lines.push('Portal: https://central.tramitesvehicularesdemexico.com/login/cliente');
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Clave copiada'),
      () => this.toast.warning('No se pudo copiar. Anótala de la ventana.'),
    );
  }

  addVehicle() {
    const id = this.contactId();
    if (!id || !this.newPlate.trim()) {
      this.toast.error('Indica la placa del vehículo');
      return;
    }
    if (!this.newMake || !this.newModel || !this.newYear) {
      this.toast.error('Selecciona marca, submarca y año');
      return;
    }
    this.isAddingVehicle.set(true);
    this.crmService.addContactVehicle(id, {
      plate: this.newPlate.trim(),
      make: this.newMake,
      model: this.newModel,
      year: this.newYear,
      state: this.newVehicleState || undefined,
      engomadoColor: this.newEngomado || undefined,
      vehicleNotes: this.newVehicleNotes.trim() || undefined,
      insuranceExpiry: this.newInsuranceExpiry || undefined,
      tenenciaStatus: this.newTenencia || undefined,
    }).subscribe({
      next: () => {
        this.isAddingVehicle.set(false);
        this.newPlate = '';
        this.newMake = '';
        this.newModel = '';
        this.newYear = null;
        this.newVehicleState = '';
        this.newEngomado = '';
        this.newVehicleNotes = '';
        this.newInsuranceExpiry = '';
        this.newTenencia = '';
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

  updateVehicle(v: CrmContactVehicle, field: string, value: string | number | null) {
    const payload: Record<string, string | number | null> = { [field]: value };
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

}
