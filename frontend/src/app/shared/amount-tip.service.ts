import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AmountTipService {
  private tipEl: HTMLElement | null = null;

  show(text: string, anchor: DOMRect): void {
    this.hide();

    const tip = document.createElement('div');
    tip.className = 'amount-tip-portal';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = text;

    // Position off-screen first so we can measure
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';
    document.body.appendChild(tip);
    this.tipEl = tip;

    // Measure after paint so getBoundingClientRect is correct
    requestAnimationFrame(() => {
      if (!this.tipEl) return;
      const tipWidth = tip.offsetWidth;
      const tipHeight = tip.offsetHeight;

      let left = anchor.left;
      let top = anchor.top - tipHeight - 8;

      // Keep inside viewport horizontally
      if (left + tipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tipWidth - 8;
      }
      if (left < 8) left = 8;

      // If no room above, show below
      if (top < 8) {
        top = anchor.bottom + 8;
      }

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.opacity = '1';
    });
  }

  hide(): void {
    if (this.tipEl) {
      this.tipEl.remove();
      this.tipEl = null;
    }
  }
}
