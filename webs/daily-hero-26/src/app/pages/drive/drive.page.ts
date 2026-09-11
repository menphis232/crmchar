import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CARS } from '../../core/cars';

@Component({
  selector: 'app-drive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './drive.page.html',
  styleUrl: './drive.page.scss',
})
export class DrivePage {
  private readonly pink = viewChild<ElementRef<HTMLElement>>('pink');
  readonly cars = CARS;
  readonly brand = signal(CARS[0].id);
  readonly menu = signal(false);
  readonly playing = signal(false);

  constructor() {
    afterNextRender(() => {
      // keep page scroll at top on enter
      window.scrollTo({ top: 0 });
    });
  }

  pick(id: string): void {
    this.brand.set(id);
  }

  goPink(): void {
    this.playing.set(true);
    this.pink()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  active() {
    return this.cars.find((car) => car.id === this.brand()) ?? CARS[0];
  }
}
