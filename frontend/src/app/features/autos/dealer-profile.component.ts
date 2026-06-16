import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { ConcesionariaService } from '../../core/api.service';
import { DealerProfile, Auto } from '../../models';
import { hasSpecialPrice, effectivePrice } from '../../shared/auto-price.util';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-dealer-profile',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './dealer-profile.component.html',
  styleUrl: './dealer-profile.component.css',
})
export class DealerProfileComponent implements OnInit {
  dealer = signal<DealerProfile | null>(null);
  autos = signal<Auto[]>([]);
  loading = signal(true);
  autosLoading = signal(true);
  error = signal('');

  // Filters
  searchQuery = signal('');
  priceRange = signal('');

  // Pagination
  readonly PAGE_SIZE = 9;
  currentPage = signal(1);

  // Chat
  chatOpen = false;
  chatMessage = '';
  chatHistory: { role: 'user' | 'model'; content: string }[] = [];
  isChatLoading = false;

  private slug = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Derived
  availableMakes = computed(() => {
    const makes = this.autos().map(a => a.make).filter(Boolean);
    return [...new Set(makes)].sort();
  });

  filteredAutos = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const range = this.priceRange();
    return this.autos().filter(car => {
      const matchesSearch = !q ||
        car.make.toLowerCase().includes(q) ||
        car.model.toLowerCase().includes(q) ||
        car.location?.toLowerCase().includes(q);
      const matchesPrice =
        range === 'low' ? effectivePrice(car) < 500000 :
        range === 'mid' ? effectivePrice(car) >= 500000 && effectivePrice(car) <= 1000000 :
        range === 'high' ? effectivePrice(car) > 1000000 : true;
      return matchesSearch && matchesPrice;
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredAutos().length / this.PAGE_SIZE)));
  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  paginatedAutos = computed(() => {
    const start = (this.currentPage() - 1) * this.PAGE_SIZE;
    return this.filteredAutos().slice(start, start + this.PAGE_SIZE);
  });

  safeMapUrl = computed((): SafeResourceUrl | null => {
    const url = this.dealer()?.mapEmbedUrl;
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

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
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile() {
    this.concesionariaService.getDealerBySlug(this.slug).subscribe({
      next: d => { this.dealer.set(d); this.loading.set(false); },
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

  onPriceChange(range: string) {
    this.priceRange.set(range);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.priceRange.set('');
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  hasSpecialPrice = hasSpecialPrice;

  get hasActiveFilters() { return !!this.searchQuery() || !!this.priceRange(); }

  // Chat
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

  initials(name?: string) {
    return (name || 'DC').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  shareDealer() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: this.dealer()?.name, url });
    } else {
      navigator.clipboard.writeText(url);
      alert('¡Enlace copiado al portapapeles!');
    }
  }

  whatsappLink() {
    const d = this.dealer();
    const phone = d?.phone?.replace(/\D/g, '');
    if (!phone) return '#';
    const text = encodeURIComponent(`Hola, te contacto desde el directorio. Quisiera información sobre sus vehículos.`);
    return `https://wa.me/${phone}?text=${text}`;
  }
}
