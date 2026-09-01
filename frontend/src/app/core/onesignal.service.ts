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
  Slidedown?: {
    promptPush?: (options?: { force?: boolean }) => Promise<void>;
  };
};

declare global {
  interface Window {
    OneSignal?: OneSignalClient;
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void | Promise<void>>;
    __onesignalInitDone?: boolean;
    __onesignalInitError?: string;
  }
}

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly permissionState = signal<PushPermissionState>('default');
  readonly subscribed = signal(false);
  readonly lastError = signal('');

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

  /**
   * Encolar en el mismo click del usuario (sin await antes). Android PWA lo exige.
   */
  activatePushFromClick(
    userId?: string | null,
    role?: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve({ ok: false, error: 'Entorno no compatible' });
    }
    if (!environment.onesignalAppId) {
      return Promise.resolve({ ok: false, error: 'OneSignal no configurado en la app' });
    }

    const iosHint = this.iosPwaRequiredMessage();
    if (iosHint) {
      return Promise.resolve({ ok: false, error: iosHint });
    }

    if (window.__onesignalInitError) {
      return Promise.resolve({
        ok: false,
        error: `OneSignal no inició: ${window.__onesignalInitError}`,
      });
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve({ ok: false, error: 'OneSignal tardó demasiado. Cierra la app por completo y vuelve a abrirla.' });
      }, 50000);

      const finish = (result: { ok: boolean; error?: string }) => {
        clearTimeout(timeout);
        if (result.error) this.lastError.set(result.error);
        resolve(result);
      };

      const run = async (OS: OneSignalClient) => {
        try {
          if (OS.Notifications?.isPushSupported && !OS.Notifications.isPushSupported()) {
            finish({ ok: false, error: 'Este dispositivo no soporta notificaciones push aquí.' });
            return;
          }

          const nativeBefore = typeof Notification !== 'undefined' ? Notification.permission : 'default';
          if (nativeBefore === 'denied') {
            finish({ ok: false, error: this.blockedPermissionMessage() });
            return;
          }

          await this.requestPermissionWithOneSignal(OS);

          const nativeAfter = typeof Notification !== 'undefined' ? Notification.permission : 'default';
          if (nativeAfter !== 'granted') {
            finish({
              ok: false,
              error: nativeAfter === 'denied'
                ? this.blockedPermissionMessage()
                : 'No apareció el permiso del sistema. Toca Activar otra vez y elige Permitir.',
            });
            return;
          }

          await this.ensureSubscribed(OS);

          if (userId) {
            await OS.login(String(userId));
            if (role && OS.User?.addTag) {
              await OS.User.addTag('role', role);
            }
          }

          const subscribed = await this.waitForSubscription(OS, 25000);
          this.readState(OS);

          if (subscribed) {
            this.lastError.set('');
            finish({ ok: true });
            return;
          }

          const sub = OS.User?.PushSubscription;
          const detail = sub?.id ? `id=${sub.id}` : (sub?.token ? 'token sin id' : 'sin token');
          finish({
            ok: false,
            error: `Suscripción incompleta (${detail}). ${this.blockedPermissionMessage()}`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          finish({ ok: false, error: msg || 'Error al activar notificaciones' });
        }
      };

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(run);
    });
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
    return !this.subscribed();
  }

  statusLabel(): string {
    if (this.subscribed()) return 'Activadas';
    if (this.permissionState() === 'denied') return 'Bloqueadas en el teléfono';
    if (this.permissionState() === 'granted') return 'Permiso OK, falta suscripción';
    if (this.permissionState() === 'unsupported') return 'No soportadas aquí';
    return 'Sin activar';
  }

  private nativePermission(): NotificationPermission {
    return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  }

  private async requestPermissionWithOneSignal(OS: OneSignalClient): Promise<void> {
    if (typeof Notification === 'undefined') return;
    if (this.nativePermission() === 'granted') return;

    if (OS.Slidedown?.promptPush) {
      try {
        await OS.Slidedown.promptPush({ force: true });
      } catch {
        // Slidedown puede fallar si ya se mostró; seguimos con permiso nativo.
      }
    }

    if (this.nativePermission() === 'granted') return;

    if (OS.Notifications?.requestPermission) {
      await OS.Notifications.requestPermission();
    }

    if (this.nativePermission() === 'default') {
      await Notification.requestPermission();
    }
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
    if (isSubscribed) {
      this.permissionState.set('granted');
    } else if (native === 'denied') {
      this.permissionState.set('denied');
    } else if (native === 'granted') {
      this.permissionState.set('granted');
    } else {
      this.permissionState.set('default');
    }
  }

  private blockedPermissionMessage(): string {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      return 'En Android: Ajustes → Apps → Trámites MX → Notificaciones → Permitir. Luego vuelve y toca Activar.';
    }
    return 'Permiso bloqueado. Actívalo en Ajustes del teléfono → Notificaciones → Trámites MX.';
  }

  private iosPwaRequiredMessage(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIos) return null;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return null;
    return 'En iPhone: instala la app primero (Compartir → Añadir a inicio) y activa notificaciones desde el icono de la PWA.';
  }

  private async ensureSubscribed(OS: OneSignalClient): Promise<void> {
    const sub = OS.User?.PushSubscription;
    if (!sub?.optIn) {
      throw new Error('OneSignal no está listo. Recarga la app e intenta de nuevo.');
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
