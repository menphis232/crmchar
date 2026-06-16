import { Injectable } from '@angular/core';
import { SiteSettings } from '../models';

type PreviewListener = (pageKey: string, settings: SiteSettings) => void;

@Injectable({ providedIn: 'root' })
export class PreviewThemeService {
  private static readonly channelName = 'site_preview_theme';
  private listeners = new Set<PreviewListener>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(PreviewThemeService.channelName);
      this.channel.addEventListener('message', (event: MessageEvent) => {
        const { pageKey, settings } = event.data || {};
        if (!pageKey || !settings) return;
        sessionStorage.setItem(PreviewThemeService.storageKey(pageKey), JSON.stringify(settings));
        this.emit(pageKey, settings);
      });
    }
  }

  static storageKey(pageKey: string) {
    return `site_preview_${pageKey}`;
  }

  onPreviewChange(listener: PreviewListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setPreview(pageKey: string, settings: SiteSettings) {
    sessionStorage.setItem(PreviewThemeService.storageKey(pageKey), JSON.stringify(settings));
    this.channel?.postMessage({ pageKey, settings });
    this.emit(pageKey, settings);
  }

  getPreview(pageKey: string): SiteSettings | null {
    const raw = sessionStorage.getItem(PreviewThemeService.storageKey(pageKey));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearPreview(pageKey: string) {
    sessionStorage.removeItem(PreviewThemeService.storageKey(pageKey));
  }

  private emit(pageKey: string, settings: SiteSettings) {
    for (const listener of this.listeners) listener(pageKey, settings);
  }
}
