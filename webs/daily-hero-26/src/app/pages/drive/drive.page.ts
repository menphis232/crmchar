import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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

  pick(id: string): void {
    this.brand.set(id);
  }

  goPink(): void {
    this.pink()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  active() {
    return this.cars.find((car) => car.id === this.brand()) ?? CARS[0];
  }
}
