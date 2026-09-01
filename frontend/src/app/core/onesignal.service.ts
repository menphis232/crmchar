import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

type PushSubscriptionChangeEvent = {
  previous: { id?: string | null; token?: string | null; optedIn?: boolean };
  current: { id?: string | null; token?: string | null; optedIn?: boolean };
};

type OneSignalPushSubscription = {
  id?: string | null;
  token?: string | null;
  optedIn?: boolean;
  optIn?: () => Promise<void>;
  optOut?: () => Promise<void>;
  addEventListener?: (event: 'change', listener: (e: PushSubscriptionChangeEvent) => void) => void;
  removeEventListener?: (event: 'change', listener: (e: PushSubscriptionChangeEvent) => void) => void;
};

type OneSignalClient = {
  init: (config: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User?: {
    addTag: (key: string, value: string) => Promise<void>;
    PushSubscription?: OneSignalPushSubscription;
  };
  Notifications?: {
    permission: boolean;
    permissionNative?: NotificationPermission;
    isPushSupported?: () => boolean;
    requestPermission: () => Promise<boolean>;
  };
};

declare global {
  interface Window {
    OneSignal?: OneSignalClient;
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void | Promise<void>>;
    __onesignalInitDone?: boolean;
  }
}

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly permissionState = signal<PushPermissionState>('default');
  readonly subscribed = signal(false);

  init(): void {
    if (!isPlatformBrowser(this.platformId) || !environment.onesignalAppId) return;
    void this.refreshPermissionState().catch(err => console.warn('[OneSignal] init:', err));
  }

  async syncUser(userId: string | null, role?: string | null): Promise<void> {
    if (!environment.onesignalAppId) return;

    try {
      await this.withOneSignal(async OS => {
        if (userId) {
          await OS.login(String(userId));
          if (role && OS.User?.addTag) {
            await OS.User.addTag('role', role);
          }
          if (Notification.permission === 'granted') {
            await this.ensureSubscribed(OS);
          }
        } else {
          await OS.logout();
        }
        this.readState(OS);
      });
    } catch (err) {
      console.warn('[OneSignal] syncUser:', err);
    }
  }

  async enablePushFromUserGesture(
    userId?: string | null,
    role?: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { ok: false, error: 'Entorno no compatible' };
    }
    if (!environment.onesignalAppId) {
      return { ok: false, error: 'OneSignal no configurado en la app' };
    }

    try {
      return await this.withOneSignal(async OS => {
        if (OS.Notifications?.isPushSupported && !OS.Notifications.isPushSupported()) {
          return { ok: false, error: 'Este navegador no soporta notificaciones push' };
        }

        const native = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        if (native === 'denied') {
          return { ok: false, error: 'Permiso bloqueado. Ve a Ajustes → Notificaciones → Trámites MX y actívalo.' };
        }

        if (userId) {
          try {
            await OS.login(String(userId));
            if (role && OS.User?.addTag) {
              await OS.User.addTag('role', role);
            }
          } catch (loginErr) {
            const msg = loginErr instanceof Error ? loginErr.message : 'login';
            return { ok: false, error: `No se pudo vincular tu usuario: ${msg}` };
          }
        }

        try {
          await this.ensureSubscribed(OS);
        } catch (optErr) {
          const msg = optErr instanceof Error ? optErr.message : 'optIn';
          return { ok: false, error: `No se pudo suscribir: ${msg}` };
        }

        const subscribed = await this.waitForSubscription(OS, 20000);
        this.readState(OS);

        if (subscribed) {
          return { ok: true };
        }

        const sub = OS.User?.PushSubscription;
        const detail = sub?.id ? `id=${sub.id}` : (sub?.token ? 'token sin id' : 'sin token');
        return {
          ok: false,
          error: `OneSignal no registró la suscripción (${detail}). Cierra la app, ábrela de nuevo y toca Activar.`,
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[OneSignal] enablePush:', err);
      return { ok: false, error: msg || 'Error al activar notificaciones' };
    }
  }

  async refreshPermissionState(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !environment.onesignalAppId) return;

    try {
      await this.withOneSignal(OS => {
        this.readState(OS);
        return Promise.resolve();
      });
    } catch {
      this.readState(null);
    }
  }

  shouldShowPrompt(): boolean {
    if (this.permissionState() === 'denied') return false;
    return !this.subscribed();
  }

  private readState(OS: OneSignalClient | null): void {
    if (typeof Notification === 'undefined') {
      this.permissionState.set('unsupported');
      this.subscribed.set(false);
      return;
    }

    const notif = OS?.Notifications;
    if (notif?.isPushSupported && !notif.isPushSupported()) {
      this.permissionState.set('unsupported');
      this.subscribed.set(false);
      return;
    }

    const sub = OS?.User?.PushSubscription;
    const optedIn = sub?.optedIn === true;
    const hasSubId = !!sub?.id;
    const hasToken = !!sub?.token;
    const isSubscribed = optedIn && (hasSubId || hasToken);
    this.subscribed.set(isSubscribed);

    const native = notif?.permissionNative ?? Notification.permission;
    if (isSubscribed || native === 'granted') {
      this.permissionState.set('granted');
    } else if (native === 'denied') {
      this.permissionState.set('denied');
    } else {
      this.permissionState.set('default');
    }
  }

  private async ensureSubscribed(OS: OneSignalClient): Promise<void> {
    const sub = OS.User?.PushSubscription;
    if (!sub?.optIn) {
      throw new Error('PushSubscription no disponible en OneSignal');
    }

    if (sub.optedIn && (sub.id || sub.token)) return;

    await sub.optIn();
  }

  private waitForSubscription(OS: OneSignalClient, timeoutMs: number): Promise<boolean> {
    const sub = OS.User?.PushSubscription;
    if (!sub) return Promise.resolve(false);
    if (sub.optedIn && (sub.id || sub.token)) return Promise.resolve(true);

    return new Promise(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (listener && sub.removeEventListener) {
          sub.removeEventListener('change', listener);
        }
        clearTimeout(timer);
        resolve(ok);
      };

      const listener = (event: PushSubscriptionChangeEvent) => {
        const current = event.current;
        if (current?.optedIn && (current.id || current.token)) {
          finish(true);
        }
      };

      if (sub.addEventListener) {
        sub.addEventListener('change', listener);
      }

      const timer = setTimeout(() => {
        const latest = OS.User?.PushSubscription;
        finish(!!(latest?.optedIn && (latest.id || latest.token)));
      }, timeoutMs);
    });
  }

  private withOneSignal<T>(fn: (OS: OneSignalClient) => Promise<T>): Promise<T> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('Entorno no compatible'));
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OneSignal tardó demasiado en responder'));
      }, 35000);

      const run = async (OS: OneSignalClient) => {
        try {
          const result = await fn(OS);
          clearTimeout(timeout);
          resolve(result);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(run);
    });
  }
}
