import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SHAKES, formatMoney } from '../../core/catalog';
import { CartService } from '../../core/cart.service';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-shakes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './shakes.page.html',
  styleUrl: './shakes.page.scss',
})
export class ShakesPage {
  private readonly cart = inject(CartService);
  readonly shakes = SHAKES;
  readonly money = formatMoney;
  readonly filter = signal('All');
  readonly filters = ['All', 'Fresh', 'Sweet', 'Irresistible'];

  visible() {
    const tag = this.filter();
    if (tag === 'All') {
      return this.shakes;
    }
    return this.shakes.filter((shake) => shake.tags.includes(tag));
  }

  add(id: string): void {
    const shake = this.shakes.find((item) => item.id === id);
    if (shake) {
      this.cart.add(shake);
    }
  }
}
