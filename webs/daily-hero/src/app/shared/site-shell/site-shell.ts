import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SHAKES, formatMoney } from '../../core/catalog';
import { CartService } from '../../core/cart.service';
import { UiService } from '../../core/ui.service';
import { SiteHeader } from '../site-header/site-header';

@Component({
  selector: 'app-site-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, SiteHeader],
  templateUrl: './site-shell.html',
  styleUrl: './site-shell.scss',
})
export class SiteShell {
  readonly cart = inject(CartService);
  readonly ui = inject(UiService);
  readonly money = formatMoney;
  readonly catalog = SHAKES;

  matches() {
    const q = this.ui.query().trim().toLowerCase();
    if (!q) {
      return this.catalog;
    }
    return this.catalog.filter((shake) =>
      `${shake.name} ${shake.blurb} ${shake.tags.join(' ')}`.toLowerCase().includes(q),
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.ui.closeAll();
  }
}
