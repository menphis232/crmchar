import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly cartOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly query = signal('');

  openCart(): void {
    this.searchOpen.set(false);
    this.menuOpen.set(false);
    this.cartOpen.set(true);
  }

  closeAll(): void {
    this.cartOpen.set(false);
    this.searchOpen.set(false);
    this.menuOpen.set(false);
  }
}
