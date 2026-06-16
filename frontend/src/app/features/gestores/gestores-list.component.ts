import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { GestoresService, SiteService, ThemeService } from '../../core/api.service';
import { PreviewThemeService } from '../../core/preview-theme.service';
import { Gestor, StateFilter, SiteSettings } from '../../models';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-gestores-list',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './gestores-list.component.html',
  styleUrl: './gestores-list.component.css',
})
export class GestoresListComponent implements OnInit, OnDestroy {
  // Data
  gestores = signal<Gestor[]>([]);
  states = signal<StateFilter[]>([]);
  loading = signal(true);
  theme = signal<SiteSettings>({});
  isPreview = signal(false);

  private readonly previewPageKey = 'gestores';
  private unsubscribePreview?: () => void;

  // Filters
  searchQuery = signal('');
  selectedStates = signal<Set<string>>(new Set());
  minRating = signal(0);
  filtersOpen = signal(false);
  stateSectionOpen = signal(false);
  ratingSectionOpen = signal(true);
  stateSearch = signal('');
  stateShowAll = signal(false);
  readonly FILTER_PREVIEW_LIMIT = 8;

  // Pagination
  readonly PAGE_SIZE = 9;
  currentPage = signal(1);

  // Search debounce
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Computed: filter + search client-side
  filteredGestores = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const states = this.selectedStates();
    const rating = this.minRating();
    return this.gestores().filter(g => {
      const matchesSearch = !q ||
        g.name.toLowerCase().includes(q) ||
        g.location?.toLowerCase().includes(q) ||
        g.state?.toLowerCase().includes(q);
      const matchesState = states.size === 0 || states.has(g.state);
      const matchesRating = !rating || g.rating >= rating;
      return matchesSearch && matchesState && matchesRating;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredGestores().length / this.PAGE_SIZE))
  );

  paginatedGestores = computed(() => {
    const start = (this.currentPage() - 1) * this.PAGE_SIZE;
    return this.filteredGestores().slice(start, start + this.PAGE_SIZE);
  });

  pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  selectedStatesArray = computed(() => [...this.selectedStates()]);

  activeFilterCount = computed(() =>
    this.selectedStates().size + (this.minRating() > 0 ? 1 : 0)
  );

  filteredStates = computed(() => {
    const q = this.stateSearch().toLowerCase().trim();
    const list = this.states();
    if (!q) return list;
    return list.filter(s => s.state.toLowerCase().includes(q));
  });

  visibleStates = computed(() => {
    const list = this.filteredStates();
    if (this.stateShowAll() || this.stateSearch().trim() || list.length <= this.FILTER_PREVIEW_LIMIT) {
      return list;
    }
    const selected = this.selectedStates();
    const preview = list.slice(0, this.FILTER_PREVIEW_LIMIT);
    const extras = list.filter(s => selected.has(s.state) && !preview.some(p => p.state === s.state));
    return [...preview, ...extras];
  });

  hiddenStatesCount = computed(() =>
    Math.max(0, this.filteredStates().length - this.visibleStates().length)
  );

  constructor(
    private gestoresService: GestoresService,
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
      this.siteService.get('gestores').subscribe(t => {
        this.theme.set(t);
        this.themeService.apply(t);
      });
    }
    this.gestoresService.getStates().subscribe(s => this.states.set(s));
    this.loadGestores();

    // Debounce search input
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

  loadGestores() {
    this.loading.set(true);
    this.gestoresService.list().subscribe({
      next: data => { this.gestores.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(query: string) {
    this.searchSubject.next(query);
  }

  onStateToggle(state: string, checked: boolean) {
    const current = new Set(this.selectedStates());
    if (checked) current.add(state);
    else current.delete(state);
    this.selectedStates.set(current);
    this.currentPage.set(1);
  }

  isStateSelected(state: string): boolean {
    return this.selectedStates().has(state);
  }

  onRatingChange(rating: number) {
    this.minRating.set(rating);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedStates.set(new Set());
    this.minRating.set(0);
    this.stateSearch.set('');
    this.stateShowAll.set(false);
    this.currentPage.set(1);
  }

  toggleFiltersPanel() {
    this.filtersOpen.update(v => !v);
  }

  toggleStateSection() {
    this.stateSectionOpen.update(v => !v);
  }

  toggleRatingSection() {
    this.ratingSectionOpen.update(v => !v);
  }

  onStateSearchChange(q: string) {
    this.stateSearch.set(q);
    this.stateShowAll.set(!!q.trim());
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get hasActiveFilters(): boolean {
    return !!this.searchQuery() || this.selectedStates().size > 0 || this.minRating() > 0;
  }
}
