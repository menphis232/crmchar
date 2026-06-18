import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';
import { formatMoney, formatPlainNumber } from './format-amount.util';
import { AmountTipService } from './amount-tip.service';

@Directive({
  selector: '[amountTip]',
  standalone: true,
})
export class AmountTipDirective implements OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly tips = inject(AmountTipService);

  @Input() amountTip: number | null | undefined = null;
  @Input() amountPlain: number | string | null | undefined = null;
  @Input() amountSuffix = '';
  @Input() amountSigned = false;
  @Input() amountDecimals = 2;
  @Input() amountMaxLen = 10;

  private fullText = '';
  private truncated = false;

  ngOnChanges(): void {
    const plain = this.amountPlain;
    const result =
      plain != null && plain !== ''
        ? formatPlainNumber(plain, {
            suffix: this.amountSuffix,
            maxLength: this.amountMaxLen,
          })
        : formatMoney(this.amountTip, {
            signed: this.amountSigned,
            decimals: this.amountDecimals,
            maxLength: this.amountMaxLen,
          });

    this.fullText = result.full;
    this.truncated = result.truncated;

    this.renderer.setProperty(this.el.nativeElement, 'textContent', result.display);

    if (result.truncated) {
      this.renderer.addClass(this.el.nativeElement, 'has-amount-tip');
    } else {
      this.renderer.removeClass(this.el.nativeElement, 'has-amount-tip');
    }
  }

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.truncated) return;
    this.tips.show(this.fullText, this.el.nativeElement.getBoundingClientRect());
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.tips.hide();
  }

  ngOnDestroy(): void {
    this.tips.hide();
  }
}
