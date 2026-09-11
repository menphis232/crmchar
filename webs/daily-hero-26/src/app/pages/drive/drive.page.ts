import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CARS, type Car } from '../../core/cars';

@Component({
  selector: 'app-drive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './drive.page.html',
  styleUrl: './drive.page.scss',
})
export class DrivePage {
  readonly cars = CARS;
  readonly index = signal(0);
  readonly film = signal(false);
  readonly menu = signal(false);
  readonly car = computed<Car>(() => this.cars[this.index()] ?? CARS[0]);

  pick(id: string): void {
    const next = this.cars.findIndex((item) => item.id === id);
    if (next >= 0) {
      this.index.set(next);
    }
  }
}
