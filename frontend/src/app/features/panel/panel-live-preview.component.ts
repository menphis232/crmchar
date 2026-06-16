import { Component, ElementRef, Input, OnChanges } from '@angular/core';
import { ThemeService } from '../../core/api.service';
import { SiteSettings } from '../../models';

@Component({
  selector: 'app-panel-live-preview',
  standalone: true,
  templateUrl: './panel-live-preview.component.html',
  styleUrls: ['./panel-live-preview.component.css', './panel-dashboard.css'],
})
export class PanelLivePreviewComponent implements OnChanges {
  @Input() theme: SiteSettings = {};
  @Input() pageKey = 'panel-gestor';

  constructor(
    private el: ElementRef<HTMLElement>,
    private themeService: ThemeService,
  ) {}

  ngOnChanges() {
    const root = this.el.nativeElement.querySelector('.panel-preview-root') as HTMLElement | null;
    if (root) this.themeService.applyToElement(root, this.theme, true);
  }

  get isConcesionaria() {
    return this.pageKey === 'panel-concesionaria';
  }
}
