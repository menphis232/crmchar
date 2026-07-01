import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideX, LucideUpload, LucideTrash2, LucideFileText, LucideStickyNote, LucideExternalLink,
} from '@lucide/angular';
import { PeritoDealDetail } from '../../models';
import { PeritoService, UploadService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PERITO_STAGES, PERITO_STAGE_LABELS } from '../../shared/perito-stages';

const UPLOAD_LABELS: Record<string, string> = {
  poliza_pago: 'Póliza de pago',
  tramite_listo: 'Trámite listo',
  guia_paqueteria: 'Guía de paquetería',
};

@Component({
  selector: 'app-perito-deal-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe,
    LucideX, LucideUpload, LucideTrash2, LucideFileText, LucideStickyNote, LucideExternalLink,
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

  detail = signal<PeritoDealDetail | null>(null);
  loading = signal(true);
  newNote = '';
  uploading = signal<string | null>(null);
  stages = PERITO_STAGES.map((id) => ({ id, label: PERITO_STAGE_LABELS[id] }));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.peritoService.getDeal(this.dealId()).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el trámite');
      },
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
    this.uploadService.uploadFile(file).subscribe({
      next: (res) => {
        this.peritoService.addUpload(d.id, { docType, fileUrl: res.url, fileName: file.name }).subscribe({
          next: () => {
            this.uploading.set(null);
            input.value = '';
            this.toast.success('Archivo subido');
            this.load();
            this.updated.emit();
          },
          error: (e) => {
            this.uploading.set(null);
            this.toast.error(e.error?.error || 'Error al registrar archivo');
          },
        });
      },
      error: () => {
        this.uploading.set(null);
        this.toast.error('Error al subir archivo');
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
}
