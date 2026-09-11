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
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  readonly cars = CARS;
  readonly brand = signal(CARS[0].id);
  readonly scale = signal(1);
  readonly menu = signal(false);
  readonly progress = signal(0);

  constructor() {
    afterNextRender(() => {
      this.fit();
      const onScroll = () => this.scrub();
      window.addEventListener('resize', () => {
        this.fit();
        this.scrub();
      });
      window.addEventListener('scroll', onScroll, { passive: true });
      this.scrub();
    });
  }

  pick(id: string): void {
    this.brand.set(id);
  }

  onReady(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const video = this.reel()?.nativeElement;
    if (reduced) {
      void video?.play();
      return;
    }
    this.scrub();
  }

  replay(): void {
    const video = this.reel()?.nativeElement;
    if (!video) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.currentTime = 0;
      void video.play();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  active() {
    return this.cars.find((car) => car.id === this.brand()) ?? CARS[0];
  }

  private fit(): void {
    const next = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.scale.set(Number(Math.max(next, 0.28).toFixed(4)));
  }

  private scrub(): void {
    const track = this.track()?.nativeElement;
    const video = this.reel()?.nativeElement;
    if (!track) {
      return;
    }
    const total = track.offsetHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-track.getBoundingClientRect().top, 0), Math.max(total, 0));
    const next = total > 0 ? scrolled / total : 0;
    this.progress.set(Number(next.toFixed(3)));

    if (!video || !Number.isFinite(video.duration) || video.duration === 0) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const target = next * (video.duration - 0.05);
    if (Math.abs(video.currentTime - target) > 0.04) {
      video.currentTime = target;
    }
  }
}
