import { Injectable, computed, signal } from '@angular/core';
import { SHAKES, type Shake } from './catalog';

export interface CartLine {
  shake: Shake;
  qty: number;
}

export interface Toast {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly linesState = signal<CartLine[]>([]);
  private readonly toastsState = signal<Toast[]>([]);
  private seq = 0;

  readonly lines = this.linesState.asReadonly();
  readonly toasts = this.toastsState.asReadonly();
  readonly count = computed(() => this.linesState().reduce((sum, line) => sum + line.qty, 0));
  readonly total = computed(() =>
    this.linesState().reduce((sum, line) => sum + line.qty * line.shake.price, 0),
  );

  add(shake: Shake): void {
    this.linesState.update((lines) => {
      const found = lines.find((line) => line.shake.id === shake.id);
      if (!found) {
        return [...lines, { shake, qty: 1 }];
      }
      return lines.map((line) =>
        line.shake.id === shake.id ? { ...line, qty: line.qty + 1 } : line,
      );
    });
    this.flash(`${shake.name} added to cart`);
  }

  setQty(id: string, qty: number): void {
    if (qty < 1) {
      this.remove(id);
      return;
    }
    this.linesState.update((lines) =>
      lines.map((line) => (line.shake.id === id ? { ...line, qty } : line)),
    );
  }

  remove(id: string): void {
    this.linesState.update((lines) => lines.filter((line) => line.shake.id !== id));
  }

  clear(): void {
    this.linesState.set([]);
    this.flash('Cart cleared');
  }

  dismiss(id: number): void {
    this.toastsState.update((items) => items.filter((item) => item.id !== id));
  }

  notify(message: string): void {
    this.flash(message);
  }

  private flash(message: string): void {
    const id = ++this.seq;
    this.toastsState.update((items) => [...items, { id, message }]);
    window.setTimeout(() => this.dismiss(id), 2800);
  }
}

export function featuredShake(): Shake {
  return SHAKES[0];
}
