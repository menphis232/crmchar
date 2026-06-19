import { Component, OnInit, OnDestroy, HostListener, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { CAR_LUCIDE_ICONS } from '../../shared/car-lucide-icons';
import { CarCardCarouselComponent } from '../../shared/car-card-carousel.component';
import { ConcesionariaService } from '../../core/api.service';
import { DealerProfile, Auto } from '../../models';
import { hasSpecialPrice } from '../../shared/auto-price.util';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WhatsappLeadModalComponent } from '../../shared/whatsapp-lead-modal.component';
import { WhatsappIconComponent } from '../../shared/whatsapp-icon.component';
import { AUTO_SHARE_TAGLINE } from '../../shared/brand.constants';
import { MetaTagsService } from '../../shared/meta-tags.service';
import { ToastService } from '../../core/toast.service';

type DealerFilterTab = 'marca' | 'verificado' | 'estado';

@Component({
  selector: 'app-dealer-profile',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, DatePipe, FormsModule, WhatsappLeadModalComponent, WhatsappIconComponent, CarCardCarouselComponent, ...CAR_LUCIDE_ICONS],
  templateUrl: './dealer-profile.component.html',
  styleUrl: './dealer-profile.component.css',
})
export class DealerProfileComponent implements OnInit, OnDestroy {
  private metaTags = inject(MetaTagsService);
  private toast = inject(ToastService);

  dealer = signal<DealerProfile | null>(null);
  autos = signal<Auto[]>([]);
  loading = signal(true);
  autosLoading = signal(true);
  error = signal('');
  showWaModal = signal(false);

  searchQuery = signal('');
  selectedMakes = signal<Set<string>>(new Set());
  selectedCities = signal<Set<string>>(new Set());
  verifiedFilter = signal<'all' | 'yes' | 'no'>('all');
  filtersOpen = signal(false);
  filterTab = signal<DealerFilterTab>('marca');

  pendingMakes = signal<Set<string>>(new Set());
  pendingCities = signal<Set<string>>(new Set());
  pendingVerified = signal<'all' | 'yes' | 'no'>('all');

  makeSearch = signal('');
  citySearch = signal('');
  makeShowAll = signal(false);
  cityShowAll = signal(false);
  readonly FILTER_PREVIEW_LIMIT = 8;

  readonly PAGE_SIZE = 9;
  currentPage = signal(1);

  chatOpen = false;
  chatMessage = '';
  chatHistory: { role: 'user' | 'model'; content: string }[] = [];
  isChatLoading = false;

  private slug = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private ignoreNextDocClick = false;

  makes = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.autos()) {
      counts.set(a.make, (counts.get(a.make) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count);
  });

  availableCities = computed(() => {
    const cities = this.autos()
      .map(a => a.location)
      .filter((c): c is string => !!c);
    return [...new Set(cities)].sort();
  });

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

  filteredAutos = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const makes = this.selectedMakes();
    const cities = this.selectedCities();
    const verified = this.verifiedFilter();

    return this.autos().filter(car => {
      const matchesSearch = !q ||
        car.make.toLowerCase().includes(q) ||
        car.model.toLowerCase().includes(q) ||
        car.location?.toLowerCase().includes(q);
      const matchesMake = makes.size === 0 || makes.has(car.make);
      const matchesCity = cities.size === 0 || cities.has(car.location ?? '');
      const matchesVerified =
        verified === 'all' ||
        (verified === 'yes' && !!car.verified) ||
        (verified === 'no' && !car.verified);
      return matchesSearch && matchesMake && matchesCity && matchesVerified;
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredAutos().length / this.PAGE_SIZE)));
  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  paginatedAutos = computed(() => {
    const start = (this.currentPage() - 1) * this.PAGE_SIZE;
    return this.filteredAutos().slice(start, start + this.PAGE_SIZE);
  });

  safeMapUrl = computed((): SafeResourceUrl | null => {
    const raw = this.dealer()?.mapEmbedUrl;
    if (!raw) return null;
    const url = this.toEmbedUrl(raw);
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  /** Converts any Google Maps URL variant to an embeddable iframe URL */
  private toEmbedUrl(url: string): string | null {
    const s = url.trim();
    if (!s) return null;
    // Already an embed URL
    if (s.includes('maps/embed') || s.includes('maps?') && s.includes('output=embed')) return s;
    if (s.includes('google.com/maps') || s.includes('goo.gl/maps') || s.includes('maps.google')) {
      // Extract coordinates @lat,lng from any Google Maps URL
      const coordMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        const [, lat, lng] = coordMatch;
        return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
      }
      // Extract place name from /place/NAME
      const placeMatch = s.match(/\/place\/([^/@?&]+)/);
      if (placeMatch) {
        const q = encodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        return `https://maps.google.com/maps?q=${q}&output=embed`;
      }
      // Extract ?q= param
      const qMatch = s.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed`;
      }
    }
    // Other valid https URLs (e.g. other embed providers)
    if (s.startsWith('https://')) return s;
    return null;
  }

  constructor(
    private route: ActivatedRoute,
    private concesionariaService: ConcesionariaService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug')!;
    this.loadProfile();
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
    this.metaTags.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile() {
    this.concesionariaService.getDealerBySlug(this.slug).subscribe({
      next: d => {
        this.dealer.set(d);
        this.metaTags.setDealerShareTags(d);
        this.loading.set(false);
      },
      error: () => { this.error.set('No se encontró la concesionaria'); this.loading.set(false); },
    });
  }

  loadAutos() {
    this.autosLoading.set(true);
    this.concesionariaService.getDealerAutos(this.slug).subscribe({
      next: data => { this.autos.set(data); this.autosLoading.set(false); },
      error: () => this.autosLoading.set(false),
    });
  }

  onSearch(q: string) { this.searchSubject.next(q); }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedMakes.set(new Set());
    this.selectedCities.set(new Set());
    this.verifiedFilter.set('all');
    this.makeSearch.set('');
    this.citySearch.set('');
    this.makeShowAll.set(false);
    this.cityShowAll.set(false);
    this.syncPendingFilters();
    this.currentPage.set(1);
  }

  toggleFiltersPanel(event?: Event) {
    event?.stopPropagation();
    const opening = !this.filtersOpen();
    if (opening) {
      this.syncPendingFilters();
      this.ignoreNextDocClick = true;
    }
    this.filtersOpen.set(opening);
  }

  setFilterTab(tab: DealerFilterTab) {
    this.filterTab.set(tab);
  }

  syncPendingFilters() {
    this.pendingMakes.set(new Set(this.selectedMakes()));
    this.pendingCities.set(new Set(this.selectedCities()));
    this.pendingVerified.set(this.verifiedFilter());
  }

  applyPendingFilters() {
    this.selectedMakes.set(new Set(this.pendingMakes()));
    this.selectedCities.set(new Set(this.pendingCities()));
    this.verifiedFilter.set(this.pendingVerified());
    this.filtersOpen.set(false);
    this.currentPage.set(1);
  }

  clearPendingFilters() {
    this.pendingMakes.set(new Set());
    this.pendingCities.set(new Set());
    this.pendingVerified.set('all');
    this.makeSearch.set('');
    this.citySearch.set('');
  }

  selectAllMakes() { this.pendingMakes.set(new Set()); }
  selectAllCities() { this.pendingCities.set(new Set()); }

  togglePendingMake(make: string) {
    const s = new Set(this.pendingMakes());
    if (s.has(make)) s.delete(make); else s.add(make);
    this.pendingMakes.set(s);
  }

  togglePendingCity(city: string) {
    const s = new Set(this.pendingCities());
    if (s.has(city)) s.delete(city); else s.add(city);
    this.pendingCities.set(s);
  }

  isPendingMakeSelected(make: string) { return this.pendingMakes().has(make); }
  isPendingCitySelected(city: string) { return this.pendingCities().has(city); }

  onMakeSearchChange(q: string) {
    this.makeSearch.set(q);
    this.makeShowAll.set(!!q.trim());
  }

  onCitySearchChange(q: string) {
    this.citySearch.set(q);
    this.cityShowAll.set(!!q.trim());
  }

  @HostListener('document:click', ['$event'])
  closeFiltersOnOutsideClick(event: MouseEvent) {
    if (this.ignoreNextDocClick) {
      this.ignoreNextDocClick = false;
      return;
    }
    const target = event.target as HTMLElement;
    if (!target.closest('.filters-dropdown-wrap') && this.filtersOpen()) {
      this.filtersOpen.set(false);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  stars(rating: number) {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  hasSpecialPrice = hasSpecialPrice;

  get hasActiveFilters(): boolean {
    return !!this.searchQuery() ||
      this.selectedMakes().size > 0 ||
      this.selectedCities().size > 0 ||
      this.verifiedFilter() !== 'all';
  }

  toggleChat() {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen && this.chatHistory.length === 0) {
      const d = this.dealer();
      if (d) {
        this.chatHistory.push({
          role: 'model',
          content: `¡Hola! Bienvenido a ${d.name}. Soy tu asesor virtual. ¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre nuestro inventario, precios o agendar una cita.`
        });
      }
    }
  }

  sendChatMessage() {
    if (!this.chatMessage.trim() || this.isChatLoading) return;
    const txt = this.chatMessage.trim();
    this.chatMessage = '';
    this.chatHistory.push({ role: 'user', content: txt });
    this.isChatLoading = true;
    this.scrollChatBottom();

    this.concesionariaService.chatWithDealer(this.slug, txt, this.chatHistory.slice(0, -1)).subscribe({
      next: res => {
        this.chatHistory.push({ role: 'model', content: res.reply });
        this.isChatLoading = false;
        this.scrollChatBottom();
      },
      error: err => {
        this.chatHistory.push({ role: 'model', content: 'Lo siento, no puedo responder ahora. ' + (err.error?.error || '') });
        this.isChatLoading = false;
        this.scrollChatBottom();
      }
    });
  }

  scrollChatBottom() {
    setTimeout(() => {
      const box = document.getElementById('dealer-chat-messages');
      if (box) box.scrollTop = box.scrollHeight;
    }, 100);
  }

  shareDealer() {
    const d = this.dealer();
    const shareUrl = d
      ? `${window.location.origin}/sc/${d.slug}`
      : window.location.href;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      navigator.share({
        title: AUTO_SHARE_TAGLINE,
        text: d ? d.name : AUTO_SHARE_TAGLINE,
        url: shareUrl,
      }).catch(() => this.copyShareLink(shareUrl));
    } else {
      this.copyShareLink(shareUrl);
    }
  }

  private copyShareLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Enlace copiado');
    }).catch(() => {
      prompt('Copia este enlace:', url);
    });
  }

  waModalData = computed(() => {
    const d = this.dealer();
    if (!d) return null;
    return {
      dealerSlug: d.slug || '',
      dealerPhone: d.phone || '',
      dealerName: d.name || '',
    };
  });

  openWaModal(e: Event) {
    e.preventDefault();
    this.showWaModal.set(true);
  }
}
