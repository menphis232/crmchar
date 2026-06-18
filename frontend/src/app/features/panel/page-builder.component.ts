import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { PageBlock, PageBuilderConfig } from '../../models';
import { UploadService } from '../../core/api.service';
import { PAGE_BUILDER_FONTS } from '../../shared/theme-fonts';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';

@Component({
  selector: 'app-page-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, PanelColorPaletteComponent],
  templateUrl: './page-builder.component.html',
  styleUrl: './page-builder.component.css'
})
export class PageBuilderComponent implements OnInit {
  private uploadService = inject(UploadService);
  isUploading = signal(false);

  @Input() config: PageBuilderConfig | null = null;
  @Input() profile: any = null; // Either Gestor or Auto
  @Output() configChange = new EventEmitter<PageBuilderConfig>();

  availableBlocks: PageBlock[] = [
    { id: 't-hero', type: 'hero', data: { title: 'Tu Título Aquí', subtitle: 'Un subtítulo atractivo', bgUrl: '', buttonText: 'Contáctanos' } },
    { id: 't-stats', type: 'stats', data: { showRating: true, showCount: true, showExperience: true } },
    { id: 't-text', type: 'text', data: { content: 'Escribe tu descripción aquí.' } },
    { id: 't-gallery', type: 'gallery', data: { images: [] } },
    { id: 't-services', type: 'services', data: { title: 'Nuestros Servicios', showPrices: true } },
    { id: 't-reviews', type: 'reviews', data: { title: 'Reseñas Destacadas' } },
    { id: 't-form', type: 'form', data: { title: '¿Necesitas ayuda?', subtitle: 'Cotiza sin compromiso' } },
    { id: 't-tracker', type: 'tracker', data: { title: 'Rastrea tu Trámite', subtitle: 'Ingresa tu código de seguimiento.' } }
  ];

  theme = signal<{primaryColor?: string, fontFamily?: string, buttonTextColor?: string}>({ 
    primaryColor: '#00d084', 
    fontFamily: 'Spartan',
    buttonTextColor: '#1a1d24'
  });
  
  previewMode = signal<'desktop' | 'mobile'>('desktop');
  selectedBlock = signal<PageBlock | null>(null);

  mainBlocks = signal<PageBlock[]>([]);
  sidebarBlocks = signal<PageBlock[]>([]);

  readonly builderColorFields: ColorPaletteFieldDef[] = [
    { key: 'primary', label: 'Color principal' },
    { key: 'buttonText', label: 'Texto de botones' },
  ];

  get builderColors(): Record<string, string> {
    const t = this.theme();
    return {
      primary: t.primaryColor || '#00d084',
      buttonText: t.buttonTextColor || '#1a1d24',
    };
  }

  applyBuilderColors(map: Record<string, string>) {
    this.theme.update(t => ({
      ...t,
      primaryColor: map['primary'] ?? t.primaryColor,
      buttonTextColor: map['buttonText'] ?? t.buttonTextColor,
    }));
    this.emitChange();
  }

  readonly blockCatalog: Record<string, { label: string; desc: string }> = {
    hero: { label: 'Banner', desc: 'Portada con imagen y botón' },
    stats: { label: 'Estadísticas', desc: 'Números y logros' },
    text: { label: 'Texto', desc: 'Descripción o párrafo' },
    gallery: { label: 'Galería', desc: 'Grid de imágenes' },
    services: { label: 'Servicios', desc: 'Lista de tarifas' },
    reviews: { label: 'Reseñas', desc: 'Opiniones destacadas' },
    form: { label: 'Formulario', desc: 'Cotización / contacto' },
    tracker: { label: 'Rastreador', desc: 'Seguimiento de trámite' },
  };

  readonly builderFonts = PAGE_BUILDER_FONTS;

  ngOnInit() {
    if (this.config && this.config.blocks?.length > 0) {
      this.mainBlocks.set(this.config.blocks.filter(b => b.region !== 'sidebar'));
      this.sidebarBlocks.set(this.config.blocks.filter(b => b.region === 'sidebar'));
      if (this.config.theme) {
        this.theme.set({ 
          primaryColor: this.config.theme.primaryColor || '#00d084', 
          fontFamily: this.config.theme.fontFamily || 'Spartan',
          buttonTextColor: this.config.theme.buttonTextColor || '#1a1d24'
        });
      }
    } else if (this.profile) {
      // Default layout mimics classic layout
      const isAuto = 'price' in this.profile; // simple heuristic to distinguish auto from gestor
      
      const defaultBlocks: PageBlock[] = [
        { 
          id: `block-${Date.now()}-1`, 
          type: 'hero',
          region: 'main',
          data: { 
            title: isAuto ? `${this.profile.brand} ${this.profile.model} ${this.profile.year}` : (this.profile.name || 'Mi Perfil'), 
            subtitle: this.profile.location || '', 
            bgUrl: isAuto ? (this.profile.images?.[0] || '') : (this.profile.bannerUrl || ''), 
            buttonText: 'Contáctanos' 
          } 
        },
        ...(!isAuto ? [
          { id: `block-${Date.now()}-2`, type: 'stats' as const, region: 'main' as const, data: { showRating: true, showCount: true, showExperience: true } },
          { id: `block-${Date.now()}-4`, type: 'services' as const, region: 'main' as const, data: { title: 'Servicios y Tarifas', showPrices: true } },
          { id: `block-${Date.now()}-5`, type: 'reviews' as const, region: 'main' as const, data: { title: 'Reseñas Destacadas' } }
        ] : [
          { id: `block-${Date.now()}-g`, type: 'gallery' as const, region: 'main' as const, data: { images: this.profile.images || [] } }
        ]),
        { 
          id: `block-${Date.now()}-3`, 
          type: 'text',
          region: 'main',
          data: { content: this.profile.bio || this.profile.description || 'Bienvenido...' } 
        },
        { 
          id: `block-${Date.now()}-6`, 
          type: 'tracker',
          region: 'sidebar',
          data: { title: 'Rastrea tu Trámite', subtitle: 'Ingresa tu código de seguimiento actual.' } 
        },
        { 
          id: `block-${Date.now()}-7`, 
          type: 'form',
          region: 'sidebar',
          data: { title: '¿Necesitas ayuda?', subtitle: 'Cotiza sin compromiso.' } 
        }
      ];
      this.mainBlocks.set(defaultBlocks.filter(b => b.region !== 'sidebar'));
      this.sidebarBlocks.set(defaultBlocks.filter(b => b.region === 'sidebar'));
      setTimeout(() => this.emitChange(), 100);
    }
  }

  togglePreview() {
    this.previewMode.set(this.previewMode() === 'desktop' ? 'mobile' : 'desktop');
  }

  drop(event: CdkDragDrop<PageBlock[]>, targetRegion: 'main' | 'sidebar') {
    if (event.previousContainer === event.container) {
      // Reordering within the same region
      const targetList = targetRegion === 'main' ? this.mainBlocks() : this.sidebarBlocks();
      moveItemInArray(targetList, event.previousIndex, event.currentIndex);
      targetRegion === 'main' ? this.mainBlocks.set([...targetList]) : this.sidebarBlocks.set([...targetList]);
      this.emitChange();
    } else {
      if (event.previousContainer.id === 'toolbarList') {
        // Adding new from toolbar
        const item = event.previousContainer.data[event.previousIndex];
        const newBlock: PageBlock = {
          id: `block-${Date.now()}`,
          type: item.type,
          region: targetRegion,
          data: JSON.parse(JSON.stringify(item.data)) // Deep copy
        };
        const targetList = targetRegion === 'main' ? this.mainBlocks() : this.sidebarBlocks();
        targetList.splice(event.currentIndex, 0, newBlock);
        targetRegion === 'main' ? this.mainBlocks.set([...targetList]) : this.sidebarBlocks.set([...targetList]);
        this.emitChange();
      } else {
        // Transferring between main and sidebar
        const sourceList = targetRegion === 'main' ? this.sidebarBlocks() : this.mainBlocks();
        const targetList = targetRegion === 'main' ? this.mainBlocks() : this.sidebarBlocks();
        
        const item = sourceList[event.previousIndex];
        item.region = targetRegion;
        transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);
        
        this.mainBlocks.set([...this.mainBlocks()]);
        this.sidebarBlocks.set([...this.sidebarBlocks()]);
        this.emitChange();
      }
    }
  }

  selectBlock(b: PageBlock) {
    this.selectedBlock.set(b);
  }

  removeBlock(b: PageBlock) {
    if (b.region === 'main') {
      this.mainBlocks.set(this.mainBlocks().filter(x => x.id !== b.id));
    } else {
      this.sidebarBlocks.set(this.sidebarBlocks().filter(x => x.id !== b.id));
    }
    if (this.selectedBlock()?.id === b.id) this.selectedBlock.set(null);
    this.emitChange();
  }

  // Gallery
  addGalleryImage(b: PageBlock) {
    if (!b.data.images) b.data.images = [];
    b.data.images.push('https://via.placeholder.com/600x400?text=Nueva+Imagen');
    this.emitChange();
  }

  uploadGalleryImage(event: Event, b: PageBlock) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.isUploading.set(true);
      this.uploadService.uploadFile(input.files[0]).subscribe({
        next: (res) => {
          if (!b.data.images) b.data.images = [];
          b.data.images.push(res.url);
          this.isUploading.set(false);
          this.emitChange();
        },
        error: (err) => {
          console.error('Error uploading gallery image:', err);
          this.isUploading.set(false);
        }
      });
    }
  }

  uploadHeroImage(event: Event, b: PageBlock) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.isUploading.set(true);
      this.uploadService.uploadFile(input.files[0]).subscribe({
        next: (res) => {
          b.data.bgUrl = res.url;
          this.isUploading.set(false);
          this.emitChange();
        },
        error: (err) => {
          console.error('Error uploading hero image:', err);
          this.isUploading.set(false);
        }
      });
    }
  }

  removeGalleryImage(b: PageBlock, index: number) {
    b.data.images.splice(index, 1);
    this.emitChange();
  }

  emitChange() {
    this.configChange.emit({
      theme: this.theme(),
      blocks: [...this.mainBlocks(), ...this.sidebarBlocks()]
    });
  }
}

