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
  private readonly reel = viewChild<ElementRef<HTMLVideoElement>>('reel');
  readonly cars = CARS;
  readonly brand = signal(CARS[0].id);
  readonly scale = signal(1);
  readonly menu = signal(false);

  constructor() {
    afterNextRender(() => {
      this.fit();
      window.addEventListener('resize', () => this.fit());
    });
  }

  pick(id: string): void {
    this.brand.set(id);
  }

  replay(): void {
    const video = this.reel()?.nativeElement;
    if (!video) {
      return;
    }
    video.currentTime = 0;
    void video.play();
  }

  active() {
    return this.cars.find((car) => car.id === this.brand()) ?? CARS[0];
  }

  private fit(): void {
    const next = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.scale.set(Number(Math.max(next, 0.28).toFixed(4)));
  }
}
