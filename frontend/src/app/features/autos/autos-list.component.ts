import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { NavComponent } from '../../shared/nav.component';
import { AutosService, SiteService, ThemeService } from '../../core/api.service';
import { Auto, MakeFilter, SiteSettings } from '../../models';

@Component({
  selector: 'app-autos-list',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe],
  templateUrl: './autos-list.component.html',
  styleUrl: './autos-list.component.css',
})
export class AutosListComponent implements OnInit {
  autos = signal<Auto[]>([]);
  makes = signal<MakeFilter[]>([]);
  loading = signal(true);
  error = signal('');
  selectedMake = signal('');
  priceRange = signal('');

  theme = signal<SiteSettings>({});

  constructor(
    private autosService: AutosService,
    private siteService: SiteService,
    private themeService: ThemeService,
  ) {}

  ngOnInit() {
    this.siteService.get('autos').subscribe(t => {
      this.theme.set(t);
      this.themeService.apply(t);
    });
    this.autosService.getMakes().subscribe(m => this.makes.set(m));
    this.loadAutos();
  }

  loadAutos() {
    this.loading.set(true);
    const filters: { make?: string; minPrice?: number; maxPrice?: number } = {};
    if (this.selectedMake()) filters.make = this.selectedMake();

    const range = this.priceRange();
    if (range === 'low') { filters.maxPrice = 500000; }
    else if (range === 'mid') { filters.minPrice = 500000; filters.maxPrice = 1000000; }
    else if (range === 'high') { filters.minPrice = 1000000; }

    this.autosService.list(filters).subscribe({
      next: data => { this.autos.set(data); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar el catálogo'); this.loading.set(false); },
    });
  }

  onMakeChange(make: string, checked: boolean) {
    this.selectedMake.set(checked ? make : '');
    this.loadAutos();
  }

  onPriceChange(range: string) {
    this.priceRange.set(range);
    this.loadAutos();
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }
}
