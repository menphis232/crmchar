import {
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
  computed,
  AfterViewInit,
  OnDestroy,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideZoomIn, LucideZoomOut } from '@lucide/angular';

export interface CropResult {
  blob: Blob;
  previewUrl: string;
}

@Component({
  selector: 'app-image-cropper-modal',
  standalone: true,
  imports: [FormsModule, LucideZoomOut, LucideZoomIn, LucideCheck],
  template: `
    <div class="crop-overlay" (click)="cancel()">
      <div class="crop-card" (click)="$event.stopPropagation()">
        <div class="crop-header">
          <span class="crop-title">{{ isCircle() ? 'Ajustar avatar' : 'Recortar imagen' }}</span>
          <span class="crop-ratio-label">{{ isCircle() ? 'Círculo' : 'Proporción ' + ratioLabel() }} · Arrastra y usa el zoom</span>
        </div>

        <div class="crop-canvas-wrap" #canvasWrap>
          <canvas #canvas
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp()"
            (mouseleave)="onMouseUp()"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onMouseUp()"
            (wheel)="onWheel($event)">
          </canvas>
        </div>

        <div class="crop-zoom-row">
          <span class="crop-zoom-icon"><svg lucideZoomOut [size]="16" aria-hidden="true"></svg></span>
          <input type="range" class="crop-zoom-slider"
            [min]="zoomMin" [max]="zoomMax" [step]="0.01"
            [ngModel]="zoom()" (ngModelChange)="setZoom($event)" />
          <span class="crop-zoom-icon"><svg lucideZoomIn [size]="16" aria-hidden="true"></svg></span>
        </div>

        <div class="crop-hint">Arrastra para reposicionar · Rueda del ratón o slider para acercar/alejar</div>

        <div class="crop-actions">
          <button class="crop-btn-cancel" type="button" (click)="cancel()">Cancelar</button>
          <button class="crop-btn-confirm btn-with-icon" type="button" (click)="confirm()">
            <svg lucideCheck [size]="16" aria-hidden="true"></svg>
            Usar esta foto
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crop-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,.85); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .crop-card {
      background: #111; border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px; padding: 20px; width: 100%; max-width: 520px;
      display: flex; flex-direction: column; gap: 14px;
      font-family: 'Spartan', sans-serif;
    }
    .crop-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .crop-title { color: #fff; font-size: 15px; font-weight: 700; }
    .crop-ratio-label { color: rgba(255,255,255,.45); font-size: 12px; }
    .crop-canvas-wrap {
      width: 100%; background: #000; border-radius: 8px; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .crop-canvas-wrap canvas { display: block; max-width: 100%; cursor: move; touch-action: none; }
    .crop-zoom-row { display: flex; align-items: center; gap: 10px; }
    .crop-zoom-icon { font-size: 14px; line-height: 1; user-select: none; }
    .crop-zoom-slider {
      flex: 1; -webkit-appearance: none; height: 4px;
      background: rgba(255,255,255,.2); border-radius: 4px; outline: none; cursor: pointer;
    }
    .crop-zoom-slider::-webkit-slider-thumb {
      -webkit-appearance: none; width: 16px; height: 16px;
      border-radius: 50%; background: #fff; cursor: pointer;
    }
    .crop-hint { color: rgba(255,255,255,.35); font-size: 11px; text-align: center; }
    .crop-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .crop-btn-cancel {
      padding: 9px 20px; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
      background: transparent; color: rgba(255,255,255,.6); font-size: 13px;
      font-family: inherit; cursor: pointer;
    }
    .crop-btn-cancel:hover { border-color: rgba(255,255,255,.4); color: #fff; }
    .crop-btn-confirm {
      padding: 9px 20px; border: none; border-radius: 8px;
      background: rgb(37,99,235); color: #fff; font-size: 13px;
      font-weight: 700; font-family: inherit; cursor: pointer;
    }
    .crop-btn-confirm:hover { background: rgb(29,78,216); }
  `],
})
export class ImageCropperModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  imageFile = input<File | null>(null);
  aspect    = input<number>(16 / 9);
  /** Lado máximo en px del archivo exportado (p. ej. 1080 para galería cuadrada). */
  outputMax = input<number>(1600);
  /** circle = recorte circular (PNG). rect = marco rectangular fijo (JPEG). */
  mode      = input<'circle' | 'rect'>('circle');
  cropped   = output<CropResult>();
  cancelled = output<void>();

  isCircle = computed(() => this.mode() === 'circle');

  ratioLabel = computed(() => {
    const a = this.aspect();
    if (Math.abs(a - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(a - 3 / 2) < 0.01)  return '3:2';
    if (Math.abs(a - 4 / 3) < 0.01)  return '4:3';
    if (Math.abs(a - 1) < 0.01)      return '1:1';
    return `${a.toFixed(2)}`;
  });

  zoom    = signal(1);
  zoomMin = 0.3;
  zoomMax = 3;

  private img = new Image();
  private cx!: CanvasRenderingContext2D;
  private imgX = 0;
  private imgY = 0;
  private imgW = 0;
  private imgH = 0;
  private cropX = 0;
  private cropY = 0;
  private cropW = 0;
  private cropH = 0;
  private circleR = 0;
  private dragging = false;
  private dragStart = { mx: 0, my: 0 };

  ngAfterViewInit() {
    this.cx = this.canvasRef.nativeElement.getContext('2d')!;
    if (this.imageFile()) this.loadImage(this.imageFile()!);
  }

  ngOnChanges() {
    if (this.canvasRef && this.imageFile()) this.loadImage(this.imageFile()!);
  }

  ngOnDestroy() {
    if (this.img.src) URL.revokeObjectURL(this.img.src);
  }

  private loadImage(file: File) {
    const url = URL.createObjectURL(file);
    this.img.onload = () => { URL.revokeObjectURL(url); this.setupCanvas(); };
    this.img.src = url;
  }

  private setupCanvas() {
    const cv = this.canvasRef.nativeElement;
    const maxW = Math.min(cv.parentElement!.clientWidth || 480, 480);
    const pad = 10;

    if (this.isCircle()) {
      cv.width = cv.height = maxW;
      this.circleR = maxW / 2 - pad;
      this.cropX = cv.width / 2 - this.circleR;
      this.cropY = cv.height / 2 - this.circleR;
      this.cropW = this.cropH = this.circleR * 2;
    } else {
      const maxH = 380;
      const a = this.aspect();
      let innerW = maxW - pad * 2;
      let innerH = innerW / a;
      if (innerH > maxH - pad * 2) {
        innerH = maxH - pad * 2;
        innerW = innerH * a;
      }
      cv.width = Math.round(innerW + pad * 2);
      cv.height = Math.round(innerH + pad * 2);
      this.cropX = pad;
      this.cropY = pad;
      this.cropW = innerW;
      this.cropH = innerH;
      this.circleR = 0;
    }

    this.zoom.set(1);
    this.resetImagePosition();
    this.draw();
  }

  private cropCenter() {
    return { cx: this.cropX + this.cropW / 2, cy: this.cropY + this.cropH / 2 };
  }

  private resetImagePosition() {
    const { cx, cy } = this.cropCenter();
    const z = this.zoom();
    const imgAr = this.img.naturalWidth / this.img.naturalHeight;
    const cropAr = this.cropW / this.cropH;
    let baseW: number;
    let baseH: number;
    if (imgAr >= cropAr) {
      baseH = this.cropH;
      baseW = this.cropH * imgAr;
    } else {
      baseW = this.cropW;
      baseH = this.cropW / imgAr;
    }
    this.imgW = baseW * z;
    this.imgH = baseH * z;
    this.imgX = cx - this.imgW / 2;
    this.imgY = cy - this.imgH / 2;
  }

  private draw() {
    const cv = this.canvasRef.nativeElement;
    this.cx.clearRect(0, 0, cv.width, cv.height);
    this.cx.fillStyle = '#1a1a1a';
    this.cx.fillRect(0, 0, cv.width, cv.height);

    this.cx.save();
    if (this.isCircle()) {
      const { cx, cy } = this.cropCenter();
      this.cx.beginPath();
      this.cx.arc(cx, cy, this.circleR, 0, Math.PI * 2);
      this.cx.clip();
    } else {
      this.cx.beginPath();
      this.cx.rect(this.cropX, this.cropY, this.cropW, this.cropH);
      this.cx.clip();
    }
    this.cx.drawImage(this.img, this.imgX, this.imgY, this.imgW, this.imgH);
    this.cx.restore();

    this.cx.fillStyle = 'rgba(0,0,0,.65)';
    if (this.isCircle()) {
      const { cx, cy } = this.cropCenter();
      this.cx.beginPath();
      this.cx.rect(0, 0, cv.width, cv.height);
      this.cx.arc(cx, cy, this.circleR, 0, Math.PI * 2, true);
      this.cx.fill();
      this.cx.strokeStyle = 'rgba(255,255,255,.8)';
      this.cx.lineWidth = 2;
      this.cx.beginPath();
      this.cx.arc(cx, cy, this.circleR, 0, Math.PI * 2);
      this.cx.stroke();
    } else {
      const { x, y, w, h } = { x: this.cropX, y: this.cropY, w: this.cropW, h: this.cropH };
      this.cx.fillRect(0, 0, cv.width, y);
      this.cx.fillRect(0, y + h, cv.width, cv.height - y - h);
      this.cx.fillRect(0, y, x, h);
      this.cx.fillRect(x + w, y, cv.width - x - w, h);
      this.cx.strokeStyle = 'rgba(255,255,255,.85)';
      this.cx.lineWidth = 2;
      this.cx.strokeRect(x, y, w, h);
    }
  }

  setZoom(v: number) {
    const prevZ = this.zoom();
    const newZ = Math.max(this.zoomMin, Math.min(this.zoomMax, Number(v)));
    const ratio = newZ / prevZ;
    const { cx, cy } = this.cropCenter();
    this.imgW *= ratio;
    this.imgH *= ratio;
    this.imgX = cx - (cx - this.imgX) * ratio;
    this.imgY = cy - (cy - this.imgY) * ratio;
    this.zoom.set(newZ);
    this.draw();
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.setZoom(this.zoom() - e.deltaY * 0.001);
  }

  private pos(e: MouseEvent | Touch) {
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    return { mx: e.clientX - r.left, my: e.clientY - r.top };
  }

  onMouseDown(e: MouseEvent) { this.startDrag(this.pos(e)); }
  onTouchStart(e: TouchEvent) { e.preventDefault(); this.startDrag(this.pos(e.touches[0])); }

  private startDrag({ mx, my }: { mx: number; my: number }) {
    this.dragging = true;
    this.dragStart = { mx, my };
  }

  onMouseMove(e: MouseEvent) { this.doDrag(this.pos(e)); }
  onTouchMove(e: TouchEvent) { e.preventDefault(); this.doDrag(this.pos(e.touches[0])); }

  private doDrag({ mx, my }: { mx: number; my: number }) {
    if (!this.dragging) return;
    const dx = mx - this.dragStart.mx;
    const dy = my - this.dragStart.my;
    this.imgX += dx;
    this.imgY += dy;
    this.dragStart.mx = mx;
    this.dragStart.my = my;
    this.draw();
  }

  onMouseUp() { this.dragging = false; }

  confirm() {
    const scaleToImg = this.img.naturalWidth / this.imgW;
    const srcX = (this.cropX - this.imgX) * scaleToImg;
    const srcY = (this.cropY - this.imgY) * scaleToImg;
    const srcW = this.cropW * scaleToImg;
    const srcH = this.cropH * scaleToImg;
    const MAX_OUT = this.outputMax();
    const ratio = Math.min(1, MAX_OUT / srcW);
    const outW = Math.round(srcW * ratio);
    const outH = Math.round(srcH * ratio);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const octx = out.getContext('2d')!;

    if (this.isCircle()) {
      octx.beginPath();
      octx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
      octx.clip();
    }

    octx.drawImage(this.img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    const mime = this.isCircle() ? 'image/png' : 'image/jpeg';
    const quality = this.isCircle() ? 0.92 : 0.85;
    out.toBlob(blob => {
      if (!blob) {
        alert('No se pudo procesar la imagen. Intenta con otro archivo.');
        return;
      }
      this.cropped.emit({ blob, previewUrl: URL.createObjectURL(blob) });
    }, mime, quality);
  }

  cancel() { this.cancelled.emit(); }
}
