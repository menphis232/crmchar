import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

type OneSignalClient = {
  init: (config: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User?: {
    addTag: (key: string, value: string) => Promise<void>;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void | Promise<void>>;
  }
}

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  private ready: Promise<void> | null = null;

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!environment.onesignalAppId) return;
    if (this.ready) return;

    this.ready = new Promise<void>(resolve => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({
          appId: environment.onesignalAppId,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: !environment.production,
        });
        resolve();
      });
    });
  }

  async syncUser(userId: string | null, role?: string | null): Promise<void> {
    if (!environment.onesignalAppId || !this.ready) return;

    try {
      await this.ready;
      await new Promise<void>(resolve => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (OneSignal) => {
          if (userId) {
            await OneSignal.login(userId);
            if (role && OneSignal.User?.addTag) {
              await OneSignal.User.addTag('role', role);
            }
          } else {
            await OneSignal.logout();
          }
          resolve();
        });
      });
    } catch (err) {
      console.warn('[OneSignal] syncUser:', err);
    }
  }
}
