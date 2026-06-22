import { Component, ElementRef, Input, OnChanges } from '@angular/core';
import { ThemeService } from '../../core/api.service';
import { SiteSettings } from '../../models';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import {
  LucideFunnel,
  LucideGlobe,
  LucideLandmark,
  LucideLayoutDashboard,
  LucideList,
  LucideUser,
  LucideWrench,
} from '@lucide/angular';

@Component({
  selector: 'app-panel-live-preview',
  standalone: true,
  imports: [LucideLayoutDashboard, LucideList, LucideUser, LucideGlobe, LucideFunnel, LucideWrench, LucideLandmark],
  templateUrl: './panel-live-preview.component.html',
  styleUrls: ['./panel-live-preview.component.css', './panel-dashboard.css'],
})
export class PanelLivePreviewComponent implements OnChanges {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

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
