import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { PeritoService } from '../../core/api.service';
import { PeritoDeal } from '../../models';
import { PeritoKanbanComponent } from './perito-kanban.component';
import { PeritoDealPanelComponent } from './perito-deal-panel.component';
import { PanelUserMenuComponent } from './panel-user-menu.component';
import { LucideClipboardList } from '@lucide/angular';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

@Component({
  selector: 'app-panel-perito',
  standalone: true,
  imports: [
    CommonModule, PeritoKanbanComponent, PeritoDealPanelComponent, PanelUserMenuComponent, LucideClipboardList,
  ],
  templateUrl: './panel-perito.component.html',
  styleUrls: ['./panel-dashboard.css', './panel-perito.component.css'],
})
export class PanelPeritoComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  constructor(public auth: AuthService, private peritoService: PeritoService) {}

  deals = signal<PeritoDeal[]>([]);
  stages = signal<{ id: string; label: string }[]>([]);
  loading = signal(true);
  selectedDealId = signal<string | null>(null);
  isMobileMenuOpen = signal(false);

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.peritoService.getDeals().subscribe({
      next: (res) => {
        this.deals.set(res.deals);
        this.stages.set(res.stages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDeal(deal: PeritoDeal) {
    this.selectedDealId.set(deal.id);
  }

  closeDeal() {
    this.selectedDealId.set(null);
  }

  onStageChange(ev: { deal: PeritoDeal; stage: string }) {
    this.peritoService.updateStage(ev.deal.id, ev.stage).subscribe({
      next: () => {
        this.deals.update((list) =>
          list.map((d) => (d.id === ev.deal.id ? { ...d, peritoStage: ev.stage } : d)),
        );
      },
    });
  }

  initials(name?: string | null) {
    return (name || 'P').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }

  logout() {
    this.auth.logout();
  }
}
