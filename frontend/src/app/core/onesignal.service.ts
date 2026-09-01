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
const ONESIGNAL_SW_UPDATER = 'push/onesignal/OneSignalSDKUpdaterWorker.js';
const ONESIGNAL_SW_SCOPE = '/push/onesignal/';
const SDK_SCRIPT = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  private instance: OneSignalClient | null = null;
  private initPromise: Promise<OneSignalClient | null> | null = null;
  private initialized = false;
  readonly permissionState = signal<PushPermissionState>('default');
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
        if (Notification.permission === 'granted') {
          await this.ensureSubscribed(OS);
        }
      } else {
        await OS.logout();
      }
      await this.refreshPermissionState(OS);
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
      await this.registerServiceWorker();

      const OS = await this.getInstance();
      if (!OS) {
        return { ok: false, error: 'No se pudo cargar OneSignal. Revisa tu internet e intenta de nuevo.' };
      }

      if (OS.Notifications?.isPushSupported && !OS.Notifications.isPushSupported()) {
        return { ok: false, error: 'Este navegador no soporta notificaciones push' };
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

      const native = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (native === 'denied') {
        return { ok: false, error: 'Permiso bloqueado. Ve a Ajustes → Notificaciones → Trámites MX y actívalo.' };
      }

      if (native !== 'granted' && OS.Notifications?.requestPermission) {
        const granted = await OS.Notifications.requestPermission();
        if (!granted) {
          return { ok: false, error: 'Debes tocar Permitir en el mensaje del sistema' };
        }
      }

      try {
        await this.ensureSubscribed(OS);
      } catch (optErr) {
        const msg = optErr instanceof Error ? optErr.message : 'optIn';
        return { ok: false, error: `No se pudo suscribir: ${msg}` };
      }

      const subscribed = await this.waitForSubscription(OS, 15000);
      await this.refreshPermissionState(OS);

      if (subscribed) {
        return { ok: true };
      }

      return {
        ok: false,
        error: 'Permiso OK pero OneSignal no registró la suscripción. Cierra la PWA, ábrela de nuevo y toca Activar.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[OneSignal] enablePush:', err);
      return { ok: false, error: msg || 'Error al activar notificaciones' };
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
        this.delay(8000).then(() => null),
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

  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers no disponibles en este navegador');
    }

    try {
      const existing = await navigator.serviceWorker.getRegistration(ONESIGNAL_SW_SCOPE);
      if (existing?.active) return;

      await navigator.serviceWorker.register(`/${ONESIGNAL_SW_PATH}`, {
        scope: ONESIGNAL_SW_SCOPE,
        type: 'classic',
      });
      await navigator.serviceWorker.ready;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Service worker: ${msg}`);
    }
  }

  private async ensureSubscribed(OS: OneSignalClient): Promise<void> {
    const sub = OS.User?.PushSubscription;
    if (!sub) {
      throw new Error('PushSubscription no disponible en OneSignal');
    }

    if (sub.optedIn && sub.id) return;

    if (sub.optIn) {
      await sub.optIn();
      return;
    }

    if (OS.Notifications?.requestPermission) {
      await OS.Notifications.requestPermission();
      return;
    }

    throw new Error('No hay método de suscripción disponible');
  }

  private async waitForSubscription(OS: OneSignalClient, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const sub = OS.User?.PushSubscription;
      if (sub?.optedIn === true || sub?.id) {
        return true;
      }
      await this.delay(500);
    }
    const sub = OS.User?.PushSubscription;
    return !!(sub?.optedIn || sub?.id);
  }

  private async getInstance(): Promise<OneSignalClient | null> {
    if (!isPlatformBrowser(this.platformId) || !environment.onesignalAppId) return null;
    if (this.instance && this.initialized) return this.instance;
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
        reject(new Error('OneSignal tardó demasiado en iniciar'));
      }, 30000);

      const runInit = async (OneSignal: OneSignalClient) => {
        clearTimeout(timeout);
        try {
          if (!this.initialized) {
            await OneSignal.init({
              appId: environment.onesignalAppId,
              serviceWorkerPath: ONESIGNAL_SW_PATH,
              serviceWorkerUpdaterPath: ONESIGNAL_SW_UPDATER,
              serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
              notifyButton: { enable: false },
              allowLocalhostAsSecureOrigin: !environment.production,
            });
            this.initialized = true;
          }
          this.instance = OneSignal;
          window.OneSignal = OneSignal;
          await this.refreshPermissionState(OneSignal);
          resolve(this.instance);
        } catch (err) {
          this.permissionState.set('unsupported');
          reject(err);
        }
      };

      if (window.OneSignal && this.initialized) {
        void runInit(window.OneSignal);
        return;
      }

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(runInit);
    });
  }

  private ensureSdkScript(): Promise<void> {
    if (window.OneSignalDeferred || window.OneSignal) {
      return Promise.resolve();
    }

    const existing = document.querySelector(`script[src="${SDK_SCRIPT}"]`);
    if (existing) {
      return this.waitForSdk(15000);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_SCRIPT;
      script.defer = true;
      script.onload = () => this.waitForSdk(15000).then(resolve).catch(reject);
      script.onerror = () => reject(new Error('No se pudo descargar el SDK de OneSignal'));
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
          reject(new Error('SDK de OneSignal no respondió'));
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
