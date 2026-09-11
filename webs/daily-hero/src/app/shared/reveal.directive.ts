import { Directive, ElementRef, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appReveal]',
})
export class RevealDirective implements OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly delay = input(0, {
  alias: 'appReveal',
  transform: (value: unknown) => Number(value) || 0,
});

  ngOnInit(): void {
    const el = this.host.nativeElement;
    el.classList.add('reveal');
    el.style.setProperty('--reveal-delay', `${this.delay()}ms`);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }
        el.classList.add('is-in');
        observer.disconnect();
      },
      { threshold: 0.18 },
    );
    observer.observe(el);
  }
}
