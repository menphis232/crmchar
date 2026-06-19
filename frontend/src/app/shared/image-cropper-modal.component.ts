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

export interface CropResult {
  blob: Blob;
  previewUrl: string;
}

/**
 * Modal de recorte de imagen sin dependencias externas.
 * Relación de aspecto configurable (default 16:9).
 * Uso:
 *   <app-image-cropper-modal
 *     [imageFile]="fileToProcess"
 *     [aspect]="16/9"
 *     (cropped)="onCropped($event)"
 *     (cancelled)="onCancelled()" />
 */
@Component({
  selector: 'app-image-cropper-modal',
  standalone: true,
  template: `
    <div class="crop-overlay" (click)="cancel()">
      <div class="crop-card" (click)="$event.stopPropagation()">
        <div class="crop-header">
          <span class="crop-title">Recortar imagen</span>
          <span class="crop-ratio-label">Proporción {{ ratioLabel() }}</span>
        </div>

        <div class="crop-canvas-wrap" #canvasWrap>
          <canvas #canvas
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp()"
            (mouseleave)="onMouseUp()"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onMouseUp()">
          </canvas>
        </div>

        <div class="crop-hint">Arrastra para mover · Esquinas para redimensionar</div>

        <div class="crop-actions">
          <button class="crop-btn-cancel" type="button" (click)="cancel()">Cancelar</button>
          <button class="crop-btn-confirm" type="button" (click)="confirm()">✔ Usar esta foto</button>
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
      border-radius: 12px; padding: 20px; width: 100%; max-width: 680px;
      display: flex; flex-direction: column; gap: 14px;
      font-family: 'Spartan', sans-serif;
    }
    .crop-header {
      display: flex; justify-content: space-between; align-items: center;
    }
    .crop-title { color: #fff; font-size: 15px; font-weight: 700; }
    .crop-ratio-label { color: rgba(255,255,255,.45); font-size: 12px; }
    .crop-canvas-wrap {
      width: 100%; background: #000; border-radius: 8px; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      max-height: 400px;
    }
    .crop-canvas-wrap canvas { display: block; max-width: 100%; cursor: move; touch-action: none; }
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
  cropped   = output<CropResult>();
  cancelled = output<void>();

  ratioLabel = computed(() => {
    const a = this.aspect();
    if (Math.abs(a - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(a - 3 / 2) < 0.01)  return '3:2';
    if (Math.abs(a - 4 / 3) < 0.01)  return '4:3';
    if (Math.abs(a - 1) < 0.01)      return '1:1';
    return `${a.toFixed(2)}`;
  });

  private img = new Image();
  private cx!: CanvasRenderingContext2D;
  private scale = 1;

  // crop box in canvas coords
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private drag: 'move' | 'tl' | 'tr' | 'bl' | 'br' | null = null;
  private dragStart = { mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  private HANDLE = 12;

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
    this.img.onload = () => {
      URL.revokeObjectURL(url);
      this.setupCanvas();
    };
    this.img.src = url;
  }

  private setupCanvas() {
    const cv = this.canvasRef.nativeElement;
    const maxW = cv.parentElement!.clientWidth || 640;
    const maxH = 380;
    this.scale = Math.min(maxW / this.img.naturalWidth, maxH / this.img.naturalHeight, 1);
    cv.width  = Math.round(this.img.naturalWidth  * this.scale);
    cv.height = Math.round(this.img.naturalHeight * this.scale);

    // initial crop box: centred, fills width
    const a = this.aspect();
    let bw = cv.width;
    let bh = bw / a;
    if (bh > cv.height) { bh = cv.height; bw = bh * a; }
    this.box = {
      x: (cv.width  - bw) / 2,
      y: (cv.height - bh) / 2,
      w: bw, h: bh,
    };
    this.draw();
  }

  private draw() {
    const cv = this.canvasRef.nativeElement;
    this.cx.clearRect(0, 0, cv.width, cv.height);
    this.cx.drawImage(this.img, 0, 0, cv.width, cv.height);

    // darken outside crop
    this.cx.fillStyle = 'rgba(0,0,0,.55)';
    const { x, y, w, h } = this.box;
    this.cx.fillRect(0, 0, cv.width, y);
    this.cx.fillRect(0, y + h, cv.width, cv.height - y - h);
    this.cx.fillRect(0, y, x, h);
    this.cx.fillRect(x + w, y, cv.width - x - w, h);

    // border
    this.cx.strokeStyle = 'rgba(255,255,255,.9)';
    this.cx.lineWidth = 1.5;
    this.cx.strokeRect(x, y, w, h);

    // rule-of-thirds grid
    this.cx.strokeStyle = 'rgba(255,255,255,.25)';
    this.cx.lineWidth = 0.7;
    for (let i = 1; i <= 2; i++) {
      this.cx.beginPath(); this.cx.moveTo(x + w * i / 3, y); this.cx.lineTo(x + w * i / 3, y + h); this.cx.stroke();
      this.cx.beginPath(); this.cx.moveTo(x, y + h * i / 3); this.cx.lineTo(x + w, y + h * i / 3); this.cx.stroke();
    }

    // corner handles
    const H = this.HANDLE;
    this.cx.fillStyle = '#fff';
    [[x, y], [x + w - H, y], [x, y + h - H], [x + w - H, y + h - H]].forEach(([hx, hy]) => {
      this.cx.fillRect(hx, hy, H, H);
    });
  }

  private hitTest(mx: number, my: number): 'tl' | 'tr' | 'bl' | 'br' | 'move' | null {
    const { x, y, w, h } = this.box;
    const H = this.HANDLE + 4;
    if (mx >= x && mx <= x + H && my >= y && my <= y + H)             return 'tl';
    if (mx >= x + w - H && mx <= x + w && my >= y && my <= y + H)     return 'tr';
    if (mx >= x && mx <= x + H && my >= y + h - H && my <= y + h)     return 'bl';
    if (mx >= x + w - H && mx <= x + w && my >= y + h - H && my <= y + h) return 'br';
    if (mx >= x && mx <= x + w && my >= y && my <= y + h)             return 'move';
    return null;
  }

  private pos(e: MouseEvent | Touch) {
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    return { mx: e.clientX - r.left, my: e.clientY - r.top };
  }

  onMouseDown(e: MouseEvent) { this.startDrag(this.pos(e)); }
  onTouchStart(e: TouchEvent) { e.preventDefault(); this.startDrag(this.pos(e.touches[0])); }

  private startDrag({ mx, my }: { mx: number; my: number }) {
    this.drag = this.hitTest(mx, my);
    this.dragStart = { mx, my, bx: this.box.x, by: this.box.y, bw: this.box.w, bh: this.box.h };
  }

  onMouseMove(e: MouseEvent) { this.doDrag(this.pos(e)); }
  onTouchMove(e: TouchEvent) { e.preventDefault(); this.doDrag(this.pos(e.touches[0])); }

  private doDrag({ mx, my }: { mx: number; my: number }) {
    if (!this.drag) return;
    const cv = this.canvasRef.nativeElement;
    const dx = mx - this.dragStart.mx;
    const dy = my - this.dragStart.my;
    const a = this.aspect();
    const { bx, by, bw, bh } = this.dragStart;
    let { x, y, w, h } = this.box;
    const MIN = 60;

    if (this.drag === 'move') {
      x = Math.max(0, Math.min(bx + dx, cv.width - bw));
      y = Math.max(0, Math.min(by + dy, cv.height - bh));
      w = bw; h = bh;
    } else if (this.drag === 'br') {
      w = Math.max(MIN, bw + dx); h = w / a;
      if (bx + w > cv.width)  { w = cv.width - bx;  h = w / a; }
      if (by + h > cv.height) { h = cv.height - by; w = h * a; }
      x = bx; y = by;
    } else if (this.drag === 'tr') {
      w = Math.max(MIN, bw + dx); h = w / a;
      if (bx + w > cv.width)  { w = cv.width - bx;  h = w / a; }
      x = bx; y = by + bh - h;
      if (y < 0) { y = 0; h = by + bh; w = h * a; }
    } else if (this.drag === 'bl') {
      w = Math.max(MIN, bw - dx); h = w / a;
      x = bx + bw - w;
      if (x < 0) { x = 0; w = bx + bw; h = w / a; }
      y = by;
      if (by + h > cv.height) { h = cv.height - by; w = h * a; x = bx + bw - w; }
    } else if (this.drag === 'tl') {
      w = Math.max(MIN, bw - dx); h = w / a;
      x = bx + bw - w; y = by + bh - h;
      if (x < 0) { x = 0; w = bx + bw; h = w / a; y = by + bh - h; }
      if (y < 0) { y = 0; h = by + bh; w = h * a; x = bx + bw - w; }
    }

    this.box = { x, y, w, h };
    this.draw();
  }

  onMouseUp() { this.drag = null; }

  confirm() {
    const { x, y, w, h } = this.box;
    const s = 1 / this.scale;

    // Cap output at 1600px wide to stay under the 5MB server limit
    const MAX_W = 1600;
    const rawW  = Math.round(w * s);
    const rawH  = Math.round(h * s);
    const ratio = Math.min(1, MAX_W / rawW);
    const outW  = Math.round(rawW * ratio);
    const outH  = Math.round(rawH * ratio);

    const out = document.createElement('canvas');
    out.width  = outW;
    out.height = outH;
    out.getContext('2d')!.drawImage(
      this.img,
      x * s, y * s, rawW, rawH,
      0, 0, outW, outH,
    );
    out.toBlob(blob => {
      if (!blob) {
        alert('No se pudo procesar la imagen. Intenta con otro archivo.');
        return;
      }
      this.cropped.emit({ blob, previewUrl: URL.createObjectURL(blob) });
    }, 'image/jpeg', 0.88);
  }

  cancel() { this.cancelled.emit(); }
}
