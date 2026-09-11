import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './about.page.html',
  styleUrl: './about.page.scss',
})
export class AboutPage {
  readonly steps = [
    { n: '01', title: 'Picked', text: 'Strawberries land the same morning they are blended.' },
    { n: '02', title: 'Crushed', text: 'Fruit is pressed cold so the color stays loud.' },
    { n: '03', title: 'Poured', text: 'Cream meets berry over ice, then it is shaken once.' },
  ];
}
