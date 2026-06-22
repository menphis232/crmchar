import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { UploadService } from '../../core/api.service';
import { ColorPickerComponent } from '../../shared/color-picker.component';
import { TVM_LOGO_URL } from '../../shared/brand.constants';

export interface PdfBlockDef {
  id: string;
  name: string;
}

const DEFAULT_BLOCKS: PdfBlockDef[] = [
  { id: 'header', name: 'Encabezado y Logo' },
  { id: 'title', name: 'Título de la Cotización' },
  { id: 'client', name: 'Datos del Cliente' },
  { id: 'auto', name: 'Vehículo / Trámite' },
  { id: 'financial', name: 'Desglose Financiero' },
  { id: 'items', name: 'Extras / Accesorios' },
  { id: 'footer', name: 'Pie de Página' }
];

@Component({
  selector: 'app-pdf-designer',
  standalone: true,
  imports: [DragDropModule, FormsModule, CommonModule, ColorPickerComponent],
  templateUrl: './pdf-designer.component.html',
  styleUrl: './pdf-designer.component.css'
})
export class PdfDesignerComponent implements OnInit {
  auth = inject(AuthService);
  uploadService = inject(UploadService);

  readonly tvmLogoUrl = TVM_LOGO_URL;

  blocks = signal<PdfBlockDef[]>([...DEFAULT_BLOCKS]);
  primaryColor = signal('#c8a94a');
  footerText = signal('Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.');
  pdfLogoUrl = signal<string | null>(null);
  isSaving = signal(false);
  isUploadingLogo = signal(false);
  message = signal('');

  previewLogoUrl = computed(() => {
    return this.pdfLogoUrl()
      || this.auth.user()?.logo_url
      || TVM_LOGO_URL;
  });

  previewLogoSource = computed((): 'pdf' | 'profile' | 'tvm' => {
    if (this.pdfLogoUrl()) return 'pdf';
    if (this.auth.user()?.logo_url) return 'profile';
    return 'tvm';
  });

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    const user = this.auth.user();
    if (!user) return;
    
    if (user.pdf_settings) {
      if (user.pdf_settings.primaryColor) {
        this.primaryColor.set(user.pdf_settings.primaryColor);
      }
      if (user.pdf_settings.footerText) {
        this.footerText.set(user.pdf_settings.footerText);
      }
      if (user.pdf_settings.logoUrl) {
        this.pdfLogoUrl.set(user.pdf_settings.logoUrl);
      }
      if (user.pdf_settings.layout && Array.isArray(user.pdf_settings.layout)) {
        // Reorder DEFAULT_BLOCKS based on layout array
        const ordered = [];
        for (const id of user.pdf_settings.layout) {
          const block = DEFAULT_BLOCKS.find(b => b.id === id);
          if (block) ordered.push(block);
        }
        // Add any missing blocks that might be new
        for (const block of DEFAULT_BLOCKS) {
          if (!ordered.find(b => b.id === block.id)) {
            ordered.push(block);
          }
        }
        this.blocks.set(ordered);
      }
    }
  }

  drop(event: CdkDragDrop<PdfBlockDef[]>) {
    const currentBlocks = [...this.blocks()];
    moveItemInArray(currentBlocks, event.previousIndex, event.currentIndex);
    this.blocks.set(currentBlocks);
  }

  onPdfLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      this.message.set('Selecciona una imagen (JPG, PNG o WebP).');
      setTimeout(() => this.message.set(''), 3000);
      input.value = '';
      return;
    }

    this.isUploadingLogo.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: res => {
        this.pdfLogoUrl.set(res.url);
        this.isUploadingLogo.set(false);
        input.value = '';
      },
      error: () => {
        this.isUploadingLogo.set(false);
        this.message.set('Error al subir el logo.');
        setTimeout(() => this.message.set(''), 3000);
        input.value = '';
      },
    });
  }

  clearPdfLogo() {
    this.pdfLogoUrl.set(null);
  }

  save() {
    this.isSaving.set(true);
    const layout = this.blocks().map(b => b.id);

    this.auth.updateMe({
      pdf_settings: {
        layout,
        primaryColor: this.primaryColor(),
        footerText: this.footerText(),
        logoUrl: this.pdfLogoUrl(),
      }
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.set('Plantilla guardada correctamente');
        setTimeout(() => this.message.set(''), 3000);
      },
      error: () => {
        this.isSaving.set(false);
        this.message.set('Error al guardar la plantilla');
      }
    });
  }
}
