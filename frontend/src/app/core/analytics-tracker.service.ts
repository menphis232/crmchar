import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackerService {
  private http = inject(HttpClient);
  private loaded = false;

  init() {
    if (this.loaded || typeof document === 'undefined') return;
    this.http.get<{ measurementId: string | null }>(`${environment.apiUrl}/site/analytics-id`).subscribe({
      next: (res) => {
        if (!res.measurementId || this.loaded) return;
        this.injectGtag(res.measurementId);
        this.loaded = true;
      },
      error: () => {},
    });
  }

  private injectGtag(id: string) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);

    const inline = document.createElement('script');
    inline.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}');
    `;
    document.head.appendChild(inline);
  }
}
