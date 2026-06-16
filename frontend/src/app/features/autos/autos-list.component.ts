import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { AutosService, SiteService, ThemeService } from '../../core/api.service';
import { PreviewThemeService } from '../../core/preview-theme.service';
import { Auto, MakeFilter, SiteSettings } from '../../models';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-autos-list',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './autos-list.component.html',
  styleUrl: './autos-list.component.css',
})
export class AutosListComponent implements OnInit, OnDestroy {
  // Data
  autos = signal<Auto[]>([]);
  makes = signal<MakeFilter[]>([]);
  loading = signal(true);
  error = signal('');
  theme = signal<SiteSettings>({});
  isPreview = signal(false);

  private readonly previewPageKey = 'autos';
  private unsubscribePreview?: () => void;

  // Filters
  searchQuery = signal('');
  selectedMakes = signal<Set<string>>(new Set());
  priceRange = signal('');
  selectedCities = signal<Set<string>>(new Set());
  filtersOpen = signal(false);
  makeSectionOpen = signal(false);
  citySectionOpen = signal(false);
  priceSectionOpen = signal(true);
  makeSearch = signal('');
  citySearch = signal('');
  makeShowAll = signal(false);
  cityShowAll = signal(false);
  readonly FILTER_PREVIEW_LIMIT = 8;

  // Pagination
  readonly PAGE_SIZE = 9;
  currentPage = signal(1);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Derived: unique cities from data
  availableCities = computed(() => {
    const cities = this.autos()
      .map(a => a.location)
      .filter((c): c is string => !!c);
    return [...new Set(cities)].sort();
  });

  // Client-side filtering
  filteredAutos = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const makes = this.selectedMakes();
    const cities = this.selectedCities();
    const range = this.priceRange();

    return this.autos().filter(car => {
      const matchesSearch = !q ||
        car.make.toLowerCase().includes(q) ||
        car.model.toLowerCase().includes(q) ||
        car.dealerName?.toLowerCase().includes(q) ||
        car.location?.toLowerCase().includes(q);
      const matchesMake = makes.size === 0 || makes.has(car.make);
      const matchesCity = cities.size === 0 || cities.has(car.location ?? '');
      const matchesPrice =
        range === 'low' ? car.price < 500000 :
        range === 'mid' ? car.price >= 500000 && car.price <= 1000000 :
        range === 'high' ? car.price > 1000000 : true;
      return matchesSearch && matchesMake && matchesCity && matchesPrice;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAutos().length / this.PAGE_SIZE))
  );

  paginatedAutos = computed(() => {
    const start = (this.currentPage() - 1) * this.PAGE_SIZE;
    return this.filteredAutos().slice(start, start + this.PAGE_SIZE);
  });

  pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  selectedMakesArray = computed(() => [...this.selectedMakes()]);
  selectedCitiesArray = computed(() => [...this.selectedCities()]);

  activeFilterCount = computed(() =>
    this.selectedMakes().size + this.selectedCities().size + (this.priceRange() ? 1 : 0)
  );

  filteredMakes = computed(() => {
    const q = this.makeSearch().toLowerCase().trim();
    const list = this.makes();
    if (!q) return list;
    return list.filter(m => m.make.toLowerCase().includes(q));
  });

  filteredCities = computed(() => {
    const q = this.citySearch().toLowerCase().trim();
    const list = this.availableCities();
    if (!q) return list;
    return list.filter(c => c.toLowerCase().includes(q));
  });

  visibleMakes = computed(() => {
    const list = this.filteredMakes();
    if (this.makeShowAll() || this.makeSearch().trim() || list.length <= this.FILTER_PREVIEW_LIMIT) {
      return list;
    }
    const selected = this.selectedMakes();
    const preview = list.slice(0, this.FILTER_PREVIEW_LIMIT);
    const extras = list.filter(m => selected.has(m.make) && !preview.some(p => p.make === m.make));
    return [...preview, ...extras];
  });

  visibleCities = computed(() => {
    const list = this.filteredCities();
    if (this.cityShowAll() || this.citySearch().trim() || list.length <= this.FILTER_PREVIEW_LIMIT) {
      return list;
    }
    const selected = this.selectedCities();
    const preview = list.slice(0, this.FILTER_PREVIEW_LIMIT);
    const extras = list.filter(c => selected.has(c) && !preview.includes(c));
    return [...preview, ...extras];
  });

  hiddenMakesCount = computed(() =>
    Math.max(0, this.filteredMakes().length - this.visibleMakes().length)
  );

  hiddenCitiesCount = computed(() =>
    Math.max(0, this.filteredCities().length - this.visibleCities().length)
  );

  constructor(
    private autosService: AutosService,
    private siteService: SiteService,
    private themeService: ThemeService,
    private route: ActivatedRoute,
    private previewTheme: PreviewThemeService,
  ) {}

  ngOnInit() {
    const previewMode = this.route.snapshot.queryParamMap.get('preview') === '1';
    if (previewMode) {
      this.isPreview.set(true);
      this.applyPreviewTheme();
      this.unsubscribePreview = this.previewTheme.onPreviewChange((key, t) => {
        if (key === this.previewPageKey) {
          this.theme.set(t);
          this.themeService.apply(t);
        }
      });
    } else {
      this.siteService.get('autos').subscribe(t => {
        this.theme.set(t);
        this.themeService.apply(t);
      });
    }
    this.autosService.getMakes().subscribe(m => this.makes.set(m));
    this.loadAutos();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(q => {
      this.searchQuery.set(q);
      this.currentPage.set(1);
    });
  }

  ngOnDestroy() {
    this.unsubscribePreview?.();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyPreviewTheme() {
    const t = this.previewTheme.getPreview(this.previewPageKey);
    if (!t) return;
    this.theme.set(t);
    this.themeService.apply(t);
  }

  loadAutos() {
    this.loading.set(true);
    this.autosService.list().subscribe({
      next: data => { this.autos.set(data); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar el catálogo'); this.loading.set(false); },
    });
  }

  onSearch(q: string) { this.searchSubject.next(q); }

  onMakeToggle(make: string, checked: boolean) {
    const s = new Set(this.selectedMakes());
    if (checked) s.add(make); else s.delete(make);
    this.selectedMakes.set(s);
    this.currentPage.set(1);
  }

  onCityToggle(city: string, checked: boolean) {
    const s = new Set(this.selectedCities());
    if (checked) s.add(city); else s.delete(city);
    this.selectedCities.set(s);
    this.currentPage.set(1);
  }

  onPriceChange(range: string) {
    this.priceRange.set(range);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedMakes.set(new Set());
    this.selectedCities.set(new Set());
    this.priceRange.set('');
    this.makeSearch.set('');
    this.citySearch.set('');
    this.makeShowAll.set(false);
    this.cityShowAll.set(false);
    this.currentPage.set(1);
  }

  toggleFiltersPanel() {
    this.filtersOpen.update(v => !v);
  }

  toggleMakeSection() {
    this.makeSectionOpen.update(v => !v);
  }

  toggleCitySection() {
    this.citySectionOpen.update(v => !v);
  }

  togglePriceSection() {
    this.priceSectionOpen.update(v => !v);
  }

  onMakeSearchChange(q: string) {
    this.makeSearch.set(q);
    this.makeShowAll.set(!!q.trim());
  }

  onCitySearchChange(q: string) {
    this.citySearch.set(q);
    this.cityShowAll.set(!!q.trim());
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  isMakeSelected(make: string) { return this.selectedMakes().has(make); }
  isCitySelected(city: string) { return this.selectedCities().has(city); }

  get hasActiveFilters(): boolean {
    return !!this.searchQuery() || this.selectedMakes().size > 0 || this.selectedCities().size > 0 || !!this.priceRange();
  }
}
