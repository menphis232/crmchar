import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHAKES, formatMoney, type Shake } from '../../core/catalog';
import { CartService } from '../../core/cart.service';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RevealDirective],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly cart = inject(CartService);
  readonly money = formatMoney;
  readonly index = signal(0);
  readonly saved = signal<Record<string, boolean>>({});

  readonly shake = computed<Shake>(() => SHAKES[this.index()] ?? SHAKES[0]);

  step(dir: number): void {
    const next = (this.index() + dir + SHAKES.length) % SHAKES.length;
    this.index.set(next);
  }

  add(): void {
    this.cart.add(this.shake());
  }

  toggleSave(): void {
    const id = this.shake().id;
    this.saved.update((map) => ({ ...map, [id]: !map[id] }));
  }
}
