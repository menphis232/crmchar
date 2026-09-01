import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

type OneSignalClient = {
  init: (config: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User?: {
    addTag: (key: string, value: string) => Promise<void>;
    PushSubscription?: {
      optedIn?: boolean;
      id?: string | null;
      token?: string | null;
      optIn?: () => Promise<void>;
      optOut?: () => Promise<void>;
      addEventListener?: (event: string, listener: (e: { current?: { optedIn?: boolean; id?: string } }) => void) => void;
    };
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
  }
}

const ONESIGNAL_SW_PATH = 'push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SW_SCOPE = '/push/onesignal/';
const SDK_SCRIPT = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  private instance: OneSignalClient | null = null;
  private initPromise: Promise<OneSignalClient | null> | null = null;
  readonly permissionState = signal<PushPermissionState>('default');
  /** Suscripción real en OneSignal (no solo permiso del navegador). */
  readonly subscribed = signal(false);

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!environment.onesignalAppId) return;
    void this.getInstance().catch(err => console.warn('[OneSignal] init:', err));
  }

  async syncUser(userId: string | null, role?: string | null): Promise<void> {
    if (!environment.onesignalAppId) return;

    try {
      const OS = await this.getInstance();
      if (!OS) return;

      if (userId) {
        await OS.login(String(userId));
        if (role && OS.User?.addTag) {
          await OS.User.addTag('role', role);
        }
        await this.ensureSubscribed(OS);
      } else {
        await OS.logout();
      }
      await this.refreshPermissionState(OS);
    } catch (err) {
      console.warn('[OneSignal] syncUser:', err);
    }
  }

  /**
   * Flujo completo OneSignal: login → permiso → optIn → verificar suscripción.
   * El permiso nativo solo NO registra al usuario en OneSignal.
   */
  async enablePushFromUserGesture(
    userId?: string | null,
    role?: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { ok: false, error: 'Entorno no compatible' };
    }
    if (!environment.onesignalAppId) {
      return { ok: false, error: 'OneSignal no configurado' };
    }

    try {
      const OS = await Promise.race([
        this.getInstance(),
        this.delay(12000).then(() => null),
      ]);
      if (!OS) {
        return { ok: false, error: 'No se pudo cargar OneSignal. Revisa tu conexión e intenta de nuevo.' };
      }

      if (OS.Notifications?.isPushSupported && !OS.Notifications.isPushSupported()) {
        return { ok: false, error: 'Este dispositivo no soporta notificaciones push web' };
      }

      if (userId) {
        await OS.login(String(userId));
        if (role && OS.User?.addTag) {
          await OS.User.addTag('role', role);
        }
      }

      const native = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (native === 'denied') {
        return { ok: false, error: 'Permiso bloqueado. Actívalo en Ajustes → Notificaciones → Trámites MX' };
      }

      if (native !== 'granted' && OS.Notifications?.requestPermission) {
        const granted = await Promise.race([
          OS.Notifications.requestPermission(),
          this.delay(60000).then(() => false),
        ]);
        if (!granted) {
          return { ok: false, error: 'Permiso denegado o no completado' };
        }
      }

      await this.ensureSubscribed(OS);

      const subscribed = await this.waitForSubscription(OS, 10000);
      await this.refreshPermissionState(OS);

      if (subscribed) {
        return { ok: true };
      }

      return {
        ok: false,
        error: 'Permiso concedido pero OneSignal no completó la suscripción. Cierra la app, ábrela de nuevo y toca Activar otra vez.',
      };
    } catch (err) {
      console.warn('[OneSignal] enablePush:', err);
      return { ok: false, error: 'Error al activar notificaciones push' };
    }
  }

  async refreshPermissionState(oneSignal?: OneSignalClient): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const read = (OS?: OneSignalClient | null) => {
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

      const optedIn = OS?.User?.PushSubscription?.optedIn === true;
      const hasSubId = !!OS?.User?.PushSubscription?.id;
      const isSubscribed = optedIn || hasSubId;
      this.subscribed.set(isSubscribed);

      const native = notif?.permissionNative ?? Notification.permission;
      if (isSubscribed || native === 'granted') {
        this.permissionState.set('granted');
      } else if (native === 'denied') {
        this.permissionState.set('denied');
      } else {
        this.permissionState.set('default');
      }
    };

    if (oneSignal) {
      read(oneSignal);
      return;
    }

    try {
      const OS = await Promise.race([
        this.getInstance(),
        this.delay(5000).then(() => null),
      ]);
      read(OS);
    } catch {
      read(null);
    }
  }

  shouldShowPrompt(): boolean {
    if (this.permissionState() === 'denied') return false;
    return !this.subscribed();
  }

  private async ensureSubscribed(OS: OneSignalClient): Promise<void> {
    const sub = OS.User?.PushSubscription;
    if (!sub) return;

    if (sub.optedIn && sub.id) return;

    if (sub.optIn) {
      await Promise.race([
        sub.optIn(),
        this.delay(15000),
      ]);
    } else if (OS.Notifications?.requestPermission) {
      await Promise.race([
        OS.Notifications.requestPermission(),
        this.delay(15000),
      ]);
    }
  }

  private async waitForSubscription(OS: OneSignalClient, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const sub = OS.User?.PushSubscription;
      if (sub?.optedIn === true || sub?.id) {
        return true;
      }
      await this.delay(400);
    }
    return !!(OS.User?.PushSubscription?.optedIn || OS.User?.PushSubscription?.id);
  }

  private async getInstance(): Promise<OneSignalClient | null> {
    if (!isPlatformBrowser(this.platformId) || !environment.onesignalAppId) return null;
    if (this.instance) return this.instance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.bootstrap().finally(() => {
      if (!this.instance) this.initPromise = null;
    });
    return this.initPromise;
  }

  private async bootstrap(): Promise<OneSignalClient | null> {
    await this.ensureSdkScript();

    return new Promise<OneSignalClient | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OneSignal init timeout'));
      }, 25000);

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        clearTimeout(timeout);
        try {
          if (!this.instance) {
            await OneSignal.init({
              appId: environment.onesignalAppId,
              serviceWorkerPath: ONESIGNAL_SW_PATH,
              serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
              notifyButton: { enable: false },
              allowLocalhostAsSecureOrigin: !environment.production,
            });
            this.instance = OneSignal;
            window.OneSignal = OneSignal;
          }
          await this.refreshPermissionState(OneSignal);
          resolve(this.instance);
        } catch (err) {
          this.permissionState.set('unsupported');
          reject(err);
        }
      });
    });
  }

  private ensureSdkScript(): Promise<void> {
    if (window.OneSignalDeferred) {
      return Promise.resolve();
    }

    const existing = document.querySelector(`script[src="${SDK_SCRIPT}"]`);
    if (existing) {
      return this.waitForSdk(12000);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_SCRIPT;
      script.async = true;
      script.onload = () => this.waitForSdk(12000).then(resolve).catch(reject);
      script.onerror = () => reject(new Error('No se pudo cargar OneSignal'));
      document.head.appendChild(script);
    });
  }

  private waitForSdk(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (window.OneSignalDeferred) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('OneSignal SDK timeout'));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
