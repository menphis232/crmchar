import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { KnowledgeService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { KnowledgePost } from '../../models';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import {
  LucideArrowLeft,
  LucideBookOpen,
  LucideHeart,
  LucideShare2,
} from '@lucide/angular';

@Component({
  selector: 'app-knowledge-article',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideArrowLeft, LucideBookOpen, LucideHeart, LucideShare2],
  template: `
    <div class="ka-page">
      <header class="ka-top">
          <a routerLink="/panel/cliente" [queryParams]="{ tab: 'conocimiento' }" class="ka-back">
            <svg lucideArrowLeft [size]="18" aria-hidden="true"></svg>
            <span>Volver</span>
          </a>
        <a [href]="tvmMainSite" class="ka-brand" target="_blank" rel="noopener">
          <img [src]="tvmLogo" alt="Trámites Vehiculares de México" />
        </a>
      </header>

      @if (loading()) {
        <div class="ka-state">Cargando artículo…</div>
      } @else if (error()) {
        <div class="ka-state">
          <strong>{{ error() }}</strong>
          <a routerLink="/panel/cliente" class="ka-link">Ir al panel</a>
        </div>
      } @else if (post()) {
        @if (post(); as article) {
        <article class="ka-article">
          @if (coverFor(article)) {
            <div class="ka-hero">
              <img [src]="coverFor(article)" [alt]="article.title" />
            </div>
          }

          <div class="ka-body-wrap">
            <div class="ka-meta">
              <span class="ka-chip">
                <svg lucideBookOpen [size]="12" aria-hidden="true"></svg>
                Artículo
              </span>
              @if (article.createdAt) {
                <time>{{ article.createdAt | date:'dd MMMM yyyy' }}</time>
              }
            </div>

            <h1>{{ article.title }}</h1>

            <div class="ka-content" [innerHTML]="articleHtml(article)"></div>

            <footer class="ka-footer">
              <button type="button" class="ka-action" [class.liked]="article.likedByMe" (click)="toggleLike()">
                <svg lucideHeart [size]="16" aria-hidden="true"></svg>
                {{ article.likesCount || 0 }} Me gusta
              </button>
              <button type="button" class="ka-action" (click)="shareWhatsApp()">
                <svg lucideShare2 [size]="16" aria-hidden="true"></svg>
                Compartir WhatsApp
              </button>
              <a routerLink="/panel/cliente" [queryParams]="{ tab: 'conocimiento' }" class="ka-done">Volver al dashboard</a>
            </footer>
          </div>
        </article>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #050505;
      color: #fff;
    }

    .ka-page {
      min-height: 100vh;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.06), transparent 55%),
        #050505;
    }

    .ka-top {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px;
      background: rgba(5, 5, 5, 0.88);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .ka-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 8px 4px 8px 0;
      color: #fff;
      text-decoration: none;
      font-family: var(--f-display);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ka-back:hover { color: #fff; }

    @media (max-width: 720px) {
      .ka-back span { font-size: 11px; }
      .ka-top { padding: 10px 14px; }
    }

    .ka-brand img {
      height: 28px;
      width: auto;
      display: block;
    }

    .ka-state {
      max-width: 480px;
      margin: 80px auto;
      text-align: center;
      color: rgba(255,255,255,0.55);
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: center;
    }

    .ka-link {
      color: #fff;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .ka-article {
      max-width: 760px;
      margin: 0 auto;
      padding: 0 16px 48px;
    }

    .ka-hero {
      margin: 20px 0 0;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      background: #0d0d0d;
      aspect-ratio: 16 / 9;
    }

    .ka-hero img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .ka-body-wrap {
      padding: 28px 4px 0;
    }

    .ka-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      font-size: 12px;
      color: rgba(255,255,255,0.45);
    }

    .ka-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.9);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 22px;
      font-family: var(--f-display);
      font-size: clamp(26px, 5vw, 40px);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.01em;
      color: #fff;
    }

    .ka-content {
      font-size: 16px;
      line-height: 1.75;
      color: rgba(255,255,255,0.84);
    }

    .ka-content :where(p, ul, ol) { margin: 0 0 1.1em; }
    .ka-content :where(p:last-child, ul:last-child, ol:last-child) { margin-bottom: 0; }
    .ka-content :where(ul, ol) { padding-left: 1.4em; }
    .ka-content :where(strong, b) { color: #fff; font-weight: 700; }
    .ka-content :where(a) { color: #93c5fd; }
    .ka-content :where(h1, h2, h3) {
      color: #fff;
      font-family: var(--f-display);
      line-height: 1.25;
      margin: 1.4em 0 0.55em;
    }

    .ka-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    .ka-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.85);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--f-display);
    }

    .ka-action:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.3);
    }

    .ka-action.liked {
      color: #ff5a7a;
      border-color: rgba(255,90,122,0.45);
      background: rgba(255,90,122,0.12);
    }

    .ka-done {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      border-radius: 999px;
      background: #fff;
      color: #111;
      text-decoration: none;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-family: var(--f-display);
    }

    @media (max-width: 640px) {
      .ka-top { padding: 12px 14px; }
      .ka-body-wrap { padding-top: 20px; }
      .ka-done { margin-left: 0; width: 100%; }
      .ka-content { font-size: 15px; }
    }
  `],
})
export class KnowledgeArticleComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private knowledge = inject(KnowledgeService);
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  post = signal<KnowledgePost | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Artículo no encontrado');
      this.loading.set(false);
      return;
    }
    this.knowledge.getById(id).subscribe({
      next: post => {
        if (post.type !== 'article') {
          // Videos / links: abrir destino y volver
          if (post.externalUrl) {
            window.open(post.externalUrl, '_blank', 'noopener');
          }
          this.router.navigate(['/panel/cliente']);
          return;
        }
        this.post.set(post);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar este artículo');
        this.loading.set(false);
      },
    });
  }

  coverFor(post: KnowledgePost): string {
    if (post.coverUrl) return post.coverUrl;
    return '';
  }

  articleHtml(post: KnowledgePost): SafeHtml {
    const raw = post.body || '';
    if (!raw.trim()) return this.sanitizer.bypassSecurityTrustHtml('<p>Sin contenido.</p>');
    if (/<\/?[a-z][\s\S]*>/i.test(raw)) {
      return this.sanitizer.bypassSecurityTrustHtml(raw);
    }
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(`<p>${escaped}</p>`);
  }

  plainSnippet(html: string | undefined, max = 120): string {
    const text = (html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  toggleLike() {
    const article = this.post();
    if (!article) return;
    this.knowledge.toggleLike(article.id).subscribe({
      next: res => this.post.set({ ...article, likedByMe: res.likedByMe, likesCount: res.likesCount }),
      error: () => this.toast.error('No se pudo guardar el me gusta', 'Error'),
    });
  }

  shareWhatsApp() {
    const article = this.post();
    if (!article) return;
    const link = `${window.location.origin}/panel/cliente/conocimiento/${article.id}`;
    const text = `${article.title}\n${this.plainSnippet(article.body)}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
}
