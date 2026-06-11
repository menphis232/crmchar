import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { NavComponent } from '../../shared/nav.component';
import { GestoresService, SiteService, ThemeService } from '../../core/api.service';
import { Gestor, StateFilter, SiteSettings } from '../../models';

@Component({
  selector: 'app-gestores-list',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe],
  templateUrl: './gestores-list.component.html',
  styleUrl: './gestores-list.component.css',
})
export class GestoresListComponent implements OnInit {
  gestores = signal<Gestor[]>([]);
  states = signal<StateFilter[]>([]);
  loading = signal(true);
  selectedState = signal('');
  minRating = signal(0);

  theme = signal<SiteSettings>({});

  constructor(
    private gestoresService: GestoresService,
    private siteService: SiteService,
    private themeService: ThemeService,
  ) {}

  ngOnInit() {
    this.siteService.get('gestores').subscribe(t => {
      this.theme.set(t);
      this.themeService.apply(t);
    });
    this.gestoresService.getStates().subscribe(s => this.states.set(s));
    this.loadGestores();
  }

  loadGestores() {
    this.loading.set(true);
    const filters: { state?: string; minRating?: number } = {};
    if (this.selectedState()) filters.state = this.selectedState();
    if (this.minRating()) filters.minRating = this.minRating();

    this.gestoresService.list(filters).subscribe({
      next: data => { this.gestores.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onStateChange(state: string, checked: boolean) {
    this.selectedState.set(checked ? state : '');
    this.loadGestores();
  }

  onRatingChange(rating: number) {
    this.minRating.set(rating);
    this.loadGestores();
  }
}
