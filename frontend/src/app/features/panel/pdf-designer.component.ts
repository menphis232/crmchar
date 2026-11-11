import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { CrmService, UploadService } from '../../core/api.service';
import { ColorPickerComponent } from '../../shared/color-picker.component';
import { TVM_LOGO_URL } from '../../shared/brand.constants';
import { ImageCropperModalComponent, CropResult } from '../../shared/image-cropper-modal.component';
import { GESTOR_LOGO_ASPECT } from '../../shared/gestor-media.constants';
import {
  DEFAULT_QUOTE_BONUS,
  DEFAULT_QUOTE_INCLUDES,
  DEFAULT_QUOTE_REQUIREMENTS,
  checklistToPayload,
} from '../../shared/quote-checklist.utils';

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
  { id: 'includes', name: 'Qué incluye' },
  { id: 'requirements', name: 'Requisitos' },
  { id: 'bonus', name: 'Bonus' },
  { id: 'total', name: 'Costo Total' },
  { id: 'footer', name: 'Pie de Página' },
];

const CONCESIONARIA_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.';

const GESTOR_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los gastos de operación pueden variar según requisitos adicionales del trámite.';

function blocksForRole(role?: string): PdfBlockDef[] {
  return role === 'gestor' ? [...GESTOR_BLOCKS] : [...CONCESIONARIA_BLOCKS];
}

function defaultFooterForRole(role?: string): string {
  return role === 'gestor' ? GESTOR_DEFAULT_FOOTER : CONCESIONARIA_DEFAULT_FOOTER;
}

function normalizeLayout(layout: string[], role?: string): string[] {
  const catalog = blocksForRole(role);
  const allowed = new Set(catalog.map(b => b.id));
  const legacyGestorSkip = new Set(['items', 'financial', 'auto']);
  const filtered = layout.filter((id) => {
    if (role === 'gestor' && legacyGestorSkip.has(id)) return false;
    return allowed.has(id) && !(role === 'gestor' && id === 'auto');
  });
  for (const block of catalog) {
    if (!filtered.includes(block.id)) filtered.push(block.id);
  }
  if (role === 'gestor') {
    const totalIdx = filtered.indexOf('total');
    const footerIdx = filtered.indexOf('footer');
    if (totalIdx >= 0 && footerIdx >= 0 && totalIdx > footerIdx) {
      filtered.splice(totalIdx, 1);
      filtered.splice(footerIdx, 0, 'total');
    }
  }
  return filtered;
}

function linesToList(text: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-–—*✓]+\s*/, '').trim())
    .filter(Boolean);
}

@Component({
  selector: 'app-pdf-designer',
  standalone: true,
  imports: [DragDropModule, FormsModule, CommonModule, DecimalPipe, ColorPickerComponent, ImageCropperModalComponent],
  templateUrl: './pdf-designer.component.html',
  styleUrl: './pdf-designer.component.css'
})
export class PdfDesignerComponent implements OnInit {
  auth = inject(AuthService);
  uploadService = inject(UploadService);
  crm = inject(CrmService);

  readonly tvmLogoUrl = TVM_LOGO_URL;

  mode = signal<'crear' | 'diseno'>('crear');
  isGestor = computed(() => this.auth.user()?.role === 'gestor');

  blocks = signal<PdfBlockDef[]>([...CONCESIONARIA_BLOCKS]);
  primaryColor = signal('#c8a94a');
  footerText = signal(CONCESIONARIA_DEFAULT_FOOTER);
  pdfLogoUrl = signal<string | null>(null);
  pdfLogoCropFile = signal<File | null>(null);
  readonly pdfLogoAspect = GESTOR_LOGO_ASPECT;
  readonly pdfLogoOutputMax = 512;
  isSaving = signal(false);
  isUploadingLogo = signal(false);
  isDownloading = signal(false);
  message = signal('');

  // Cotización ad-hoc (sin cliente registrado)
  draftClientName = signal('');
  draftClientPhone = signal('');
  draftClientEmail = signal('');
  draftTitle = signal('');
  draftTotal = signal<number | null>(null);
  draftValidDays = signal(7);
  draftDownPayment = signal<number | null>(null);
  draftTermMonths = signal<number | null>(null);
  draftIncludesText = signal(DEFAULT_QUOTE_INCLUDES.join('\n'));
  draftRequirementsText = signal(DEFAULT_QUOTE_REQUIREMENTS.join('\n'));
  draftBonusText = signal(DEFAULT_QUOTE_BONUS.join('\n'));

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

  previewClientName = computed(() => this.draftClientName().trim() || 'Juan Pérez');
  previewClientPhone = computed(() => this.draftClientPhone().trim() || '555-123-4567');
  previewClientEmail = computed(() => this.draftClientEmail().trim() || 'juan@ejemplo.com');
  previewTitle = computed(() =>
    this.draftTitle().trim()
      || (this.isGestor() ? 'Cambio de propietario — Morelos' : 'Volkswagen Jetta 2024 - Comfortline'),
  );
  previewTotal = computed(() => {
    const n = Number(this.draftTotal());
    return Number.isFinite(n) && n >= 0 ? n : (this.isGestor() ? 4500 : 350000);
  });
  previewDownPayment = computed(() => {
    const n = Number(this.draftDownPayment());
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  previewTermMonths = computed(() => {
    const n = Number(this.draftTermMonths());
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  previewFinanceAmount = computed(() =>
    Math.max(0, this.previewTotal() - this.previewDownPayment()),
  );
  previewIncludes = computed(() => {
    const lines = linesToList(this.draftIncludesText());
    return lines.length ? lines : DEFAULT_QUOTE_INCLUDES.slice(0, 5);
  });
  previewRequirements = computed(() => {
    const lines = linesToList(this.draftRequirementsText());
    return lines.length ? lines : DEFAULT_QUOTE_REQUIREMENTS.slice(0, 4);
  });
  previewBonus = computed(() => {
    const lines = linesToList(this.draftBonusText());
    return lines.length ? lines : DEFAULT_QUOTE_BONUS;
  });
  previewFolio = computed(() => 'C-BORRADOR');
  previewDate = computed(() => new Date().toLocaleDateString('es-MX'));
  previewValidUntil = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + (Number(this.draftValidDays()) || 7));
    return d.toLocaleDateString('es-MX');
  });

  ngOnInit() {
    this.loadSettings();
    this.loadQuoteTemplates();
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

  loadQuoteTemplates() {
    this.crm.getQuoteTemplates().subscribe({
      next: (tpl) => {
        if (tpl.includes?.length) this.draftIncludesText.set(tpl.includes.join('\n'));
        if (tpl.requirements?.length) this.draftRequirementsText.set(tpl.requirements.join('\n'));
        if (tpl.bonus?.length) this.draftBonusText.set(tpl.bonus.join('\n'));
      },
      error: () => { /* se quedan los defaults */ },
    });
  }

  drop(event: CdkDragDrop<PdfBlockDef[]>) {
    const currentBlocks = [...this.blocks()];
    moveItemInArray(currentBlocks, event.previousIndex, event.currentIndex);
    this.blocks.set(currentBlocks);
  }

  onPdfLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.message.set('Selecciona una imagen (JPG, PNG o WebP).');
      setTimeout(() => this.message.set(''), 3000);
      return;
    }
    this.pdfLogoCropFile.set(file);
  }

  onPdfLogoCropConfirmed(result: CropResult) {
    const file = new File([result.blob], 'pdf-logo.jpg', { type: 'image/jpeg' });
    this.pdfLogoCropFile.set(null);
    this.isUploadingLogo.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: res => {
        this.pdfLogoUrl.set(res.url);
        this.isUploadingLogo.set(false);
        this.save();
      },
      error: err => {
        this.isUploadingLogo.set(false);
        this.message.set(err?.error?.error || 'Error al subir el logo.');
        setTimeout(() => this.message.set(''), 4000);
      },
    });
  }

  onPdfLogoCropCancelled() {
    this.pdfLogoCropFile.set(null);
  }

  clearPdfLogo() {
    this.pdfLogoUrl.set(null);
    this.save();
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

  downloadAdhocPdf() {
    const clientName = this.draftClientName().trim();
    const title = this.draftTitle().trim();
    const total = Number(this.draftTotal());

    if (!clientName) {
      this.message.set('Escribe el nombre del cliente para descargar.');
      this.mode.set('crear');
      return;
    }
    if (!title) {
      this.message.set(this.isGestor() ? 'Escribe el trámite.' : 'Escribe el vehículo.');
      this.mode.set('crear');
      return;
    }
    if (!Number.isFinite(total) || total < 0) {
      this.message.set('Indica un monto válido.');
      this.mode.set('crear');
      return;
    }

    const includes = checklistToPayload(
      linesToList(this.draftIncludesText()).map((text, i) => ({ id: `i-${i}`, text, checked: true })),
    );
    const requirements = checklistToPayload(
      linesToList(this.draftRequirementsText()).map((text, i) => ({ id: `r-${i}`, text, checked: true })),
    );
    const bonus = checklistToPayload(
      linesToList(this.draftBonusText()).map((text, i) => ({ id: `b-${i}`, text, checked: true })),
    );

    this.isDownloading.set(true);
    this.message.set('');
    this.crm.downloadAdhocQuotePdf({
      clientName,
      clientPhone: this.draftClientPhone().trim() || undefined,
      clientEmail: this.draftClientEmail().trim() || undefined,
      title,
      total,
      validDays: Number(this.draftValidDays()) || 7,
      includes: this.isGestor() ? includes : undefined,
      requirements: this.isGestor() ? requirements : undefined,
      bonus: this.isGestor() ? bonus : undefined,
      downPayment: !this.isGestor() ? (Number(this.draftDownPayment()) || 0) : undefined,
      termMonths: !this.isGestor() ? (Number(this.draftTermMonths()) || 0) : undefined,
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cotizacion-${clientName.replace(/\s+/g, '-').slice(0, 24)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.isDownloading.set(false);
        this.message.set('PDF descargado. Ya lo puedes enviar por WhatsApp o correo.');
        setTimeout(() => this.message.set(''), 4000);
      },
      error: async (err) => {
        this.isDownloading.set(false);
        let msg = 'No se pudo generar el PDF';
        try {
          const text = await err?.error?.text?.();
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed?.error) msg = parsed.error;
          }
        } catch { /* ignore */ }
        this.message.set(msg);
      },
    });
  }
}
