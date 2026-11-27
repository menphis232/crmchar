import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  LucideX, LucideUpload, LucideTrash2, LucideFileText, LucideStickyNote, LucideExternalLink,
  LucideEye, LucideDownload,
} from '@lucide/angular';
import { PeritoDealDetail } from '../../models';
import { PeritoService, UploadService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PERITO_STAGES, PERITO_STAGE_LABELS } from '../../shared/perito-stages';
import { environment } from '../../../environments/environment';

type PeritoPreviewDoc = {
  id: string;
  title: string;
  fileUrl: string;
};

const UPLOAD_LABELS: Record<string, string> = {
  poliza_pago: 'Póliza de pago',
  tramite_listo: 'Trámite listo',
};

@Component({
  selector: 'app-perito-deal-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    LucideX, LucideUpload, LucideTrash2, LucideFileText, LucideStickyNote, LucideExternalLink,
    LucideEye, LucideDownload,
  ],
  templateUrl: './perito-deal-panel.component.html',
  styleUrl: './perito-deal-panel.component.css',
})
export class PeritoDealPanelComponent implements OnInit {
  dealId = input.required<string>();
  closed = output<void>();
  updated = output<void>();

  private peritoService = inject(PeritoService);
  private uploadService = inject(UploadService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  detail = signal<PeritoDealDetail | null>(null);
  previewDoc = signal<PeritoPreviewDoc | null>(null);
  loading = signal(true);
  newNote = '';
  newStaffMessage = '';
  staffMessages: any[] = [];
  uploading = signal<string | null>(null);
  serviceCostModel: number | null = null;
  savingCost = signal(false);
  stages = PERITO_STAGES.map((id) => ({ id, label: PERITO_STAGE_LABELS[id] }));
  readonly uploadTypes = ['poliza_pago', 'tramite_listo'] as const;

  get myUserId() {
    return this.auth.user()?.id;
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.peritoService.getDeal(this.dealId()).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.serviceCostModel = d.deal.peritoServiceCost ?? null;
        this.loading.set(false);
        this.loadStaffMessages();
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el trámite');
      },
    });
  }

  loadStaffMessages() {
    this.peritoService.getStaffMessages(this.dealId()).subscribe({
      next: (msgs) => {
        this.staffMessages = msgs;
        setTimeout(() => {
          const el = document.getElementById('perito-staff-chat-box');
          if (el) el.scrollTop = el.scrollHeight;
        }, 50);
      },
      error: () => { this.staffMessages = []; },
    });
  }

  sendStaffMessage() {
    const txt = this.newStaffMessage.trim();
    if (!txt) return;
    this.newStaffMessage = '';
    this.peritoService.sendStaffMessage(this.dealId(), txt).subscribe({
      next: (saved) => {
        if (!this.staffMessages.find((m) => m.id === saved.id)) {
          this.staffMessages = [...this.staffMessages, saved];
        }
        setTimeout(() => {
          const el = document.getElementById('perito-staff-chat-box');
          if (el) el.scrollTop = el.scrollHeight;
        }, 50);
      },
      error: (e) => this.toast.error(e.error?.error || 'No se pudo enviar el mensaje'),
    });
  }

  close() {
    this.closed.emit();
  }

  changeStage(stage: string) {
    const d = this.detail()?.deal;
    if (!d || d.peritoStage === stage) return;
    this.peritoService.updateStage(d.id, stage).subscribe({
      next: () => {
        this.toast.success('Etapa actualizada');
        this.load();
        this.updated.emit();
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al mover etapa'),
    });
  }

  changePoliza(status: 'pendiente' | 'pagado') {
    const d = this.detail()?.deal;
    if (!d) return;
    this.peritoService.updatePolizaStatus(d.id, status).subscribe({
      next: () => {
        this.toast.success('Estatus de póliza actualizado');
        this.load();
        this.updated.emit();
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al actualizar póliza'),
    });
  }

  saveServiceCost() {
    const d = this.detail()?.deal;
    if (!d) return;
    const raw = this.serviceCostModel;
    const cost = raw === null || raw === undefined || (raw as any) === ''
      ? null
      : Number(raw);
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
      this.toast.error('Costo inválido');
      return;
    }
    this.savingCost.set(true);
    this.peritoService.updateServiceCost(d.id, cost).subscribe({
      next: () => {
        this.savingCost.set(false);
        this.toast.success('Costo guardado');
        this.load();
        this.updated.emit();
      },
      error: (e) => {
        this.savingCost.set(false);
        this.toast.error(e.error?.error || 'Error al guardar el costo');
      },
    });
  }

  saveNote() {
    const note = this.newNote.trim();
    const d = this.detail()?.deal;
    if (!note || !d) return;
    this.peritoService.addNote(d.id, note).subscribe({
      next: () => {
        this.newNote = '';
        this.toast.success('Nota guardada');
        this.load();
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al guardar nota'),
    });
  }

  onUpload(docType: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    const d = this.detail()?.deal;
    if (!file || !d) return;
    this.uploading.set(docType);
    // PDF e imagen: /upload solo acepta imágenes; documentos van a /upload/document.
    this.uploadService.uploadChatAttachment(file).subscribe({
      next: (res) => {
        this.peritoService.addUpload(d.id, {
          docType,
          fileUrl: res.url,
          fileName: (res as { fileName?: string }).fileName || file.name,
        }).subscribe({
          next: () => {
            this.uploading.set(null);
            input.value = '';
            this.toast.success('Archivo subido');
            this.load();
            this.updated.emit();
          },
          error: (e) => {
            this.uploading.set(null);
            input.value = '';
            this.toast.error(e.error?.error || 'Error al registrar archivo');
          },
        });
      },
      error: (e) => {
        this.uploading.set(null);
        input.value = '';
        this.toast.error(e.error?.error || 'No se pudo subir el archivo');
      },
    });
  }

  deleteUpload(id: string) {
    if (!confirm('¿Eliminar este archivo?')) return;
    this.peritoService.deleteUpload(id).subscribe({
      next: () => {
        this.toast.success('Archivo eliminado');
        this.load();
      },
      error: () => this.toast.error('No se pudo eliminar'),
    });
  }

  uploadLabel(docType: string) {
    return UPLOAD_LABELS[docType] || docType;
  }

  uploadsByType(docType: string) {
    return this.detail()?.uploads.filter((u) => u.docType === docType) || [];
  }

  isImage(url: string) {
    return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
  }

  isPdfUrl(url: string): boolean {
    return /\.pdf($|\?)/i.test(url || '');
  }

  isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|webp|gif)($|\?)/i.test(url || '');
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

  openPreview(doc: { id?: string; fileUrl: string; fileName?: string; documentType?: string; docType?: string }) {
    this.previewDoc.set({
      id: doc.id || doc.fileUrl,
      title: doc.documentType || doc.fileName || this.uploadLabel(doc.docType || '') || 'Documento',
      fileUrl: doc.fileUrl,
    });
  }

  closePreview() {
    this.previewDoc.set(null);
  }

  downloadDocument(doc: { fileUrl: string; fileName?: string; documentType?: string; title?: string }) {
    const name = doc.fileName || doc.documentType || doc.title || 'documento';
    const a = document.createElement('a');
    a.href = this.previewFileUrl(doc.fileUrl);
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = name;
    a.click();
  }
}
