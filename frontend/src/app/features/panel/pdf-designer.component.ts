import { Component, OnInit, signal, inject } from '@angular/core';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

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
  imports: [DragDropModule, FormsModule],
  templateUrl: './pdf-designer.component.html',
  styleUrl: './pdf-designer.component.css'
})
export class PdfDesignerComponent implements OnInit {
  auth = inject(AuthService);
  
  blocks = signal<PdfBlockDef[]>([...DEFAULT_BLOCKS]);
  primaryColor = signal('#c8a94a');
  footerText = signal('Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.');
  isSaving = signal(false);
  message = signal('');

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

  save() {
    this.isSaving.set(true);
    const layout = this.blocks().map(b => b.id);
    
    this.auth.updateMe({
      pdf_settings: {
        layout,
        primaryColor: this.primaryColor(),
        footerText: this.footerText()
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
