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

const CONCESIONARIA_BLOCKS: PdfBlockDef[] = [
  { id: 'header', name: 'Encabezado y Logo' },
  { id: 'title', name: 'Título de la Cotización' },
  { id: 'client', name: 'Datos del Cliente' },
  { id: 'auto', name: 'Vehículo cotizado' },
  { id: 'financial', name: 'Desglose financiero' },
  { id: 'items', name: 'Extras / Accesorios' },
  { id: 'footer', name: 'Pie de Página' },
];

const GESTOR_BLOCKS: PdfBlockDef[] = [
  { id: 'header', name: 'Encabezado y Logo' },
  { id: 'title', name: 'Título de la Cotización' },
  { id: 'client', name: 'Datos del Cliente' },
  { id: 'tramite', name: 'Trámite' },
  { id: 'financial', name: 'Honorarios' },
  { id: 'items', name: 'Conceptos / Servicios' },
  { id: 'footer', name: 'Pie de Página' },
];

const CONCESIONARIA_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.';

const GESTOR_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los honorarios pueden variar según requisitos adicionales del trámite.';

function blocksForRole(role?: string): PdfBlockDef[] {
  return role === 'gestor' ? [...GESTOR_BLOCKS] : [...CONCESIONARIA_BLOCKS];
}

function defaultFooterForRole(role?: string): string {
  return role === 'gestor' ? GESTOR_DEFAULT_FOOTER : CONCESIONARIA_DEFAULT_FOOTER;
}

function normalizeLayout(layout: string[], role?: string): string[] {
  const catalog = blocksForRole(role);
  const allowed = new Set(catalog.map(b => b.id));
  const filtered = layout.filter(id => allowed.has(id) && !(role === 'gestor' && id === 'auto'));
  for (const block of catalog) {
    if (!filtered.includes(block.id)) filtered.push(block.id);
  }
  return filtered;
}

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

  isGestor = computed(() => this.auth.user()?.role === 'gestor');

  blocks = signal<PdfBlockDef[]>([...CONCESIONARIA_BLOCKS]);
  primaryColor = signal('#c8a94a');
  footerText = signal(CONCESIONARIA_DEFAULT_FOOTER);
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

    const catalog = blocksForRole(user.role);
    this.blocks.set([...catalog]);

    if (user.pdf_settings) {
      if (user.pdf_settings.primaryColor) {
        this.primaryColor.set(user.pdf_settings.primaryColor);
      }
      if (user.pdf_settings.footerText) {
        this.footerText.set(user.pdf_settings.footerText);
      } else {
        this.footerText.set(defaultFooterForRole(user.role));
      }
      if (user.pdf_settings.logoUrl) {
        this.pdfLogoUrl.set(user.pdf_settings.logoUrl);
      }
      if (user.pdf_settings.layout && Array.isArray(user.pdf_settings.layout)) {
        const layoutIds = normalizeLayout(user.pdf_settings.layout, user.role);
        const ordered = layoutIds
          .map(id => catalog.find(b => b.id === id))
          .filter((block): block is PdfBlockDef => !!block);
        this.blocks.set(ordered);
      }
    } else {
      this.footerText.set(defaultFooterForRole(user.role));
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
    const role = this.auth.user()?.role;
    const layout = normalizeLayout(this.blocks().map(b => b.id), role);

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
