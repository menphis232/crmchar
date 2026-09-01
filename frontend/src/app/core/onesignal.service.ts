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
const ONESIGNAL_SW_SCOPE = '/push/onesignal/';
const SDK_SCRIPT = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  private instance: OneSignalClient | null = null;
  private initPromise: Promise<OneSignalClient | null> | null = null;
  readonly permissionState = signal<PushPermissionState>('default');

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
        await OS.login(userId);
        if (role && OS.User?.addTag) {
          await OS.User.addTag('role', role);
        }
      } else {
        await OS.logout();
      }
      await this.refreshPermissionState(OS);
    } catch (err) {
      console.warn('[OneSignal] syncUser:', err);
    }
  }

  /**
   * Pedir permiso en el mismo gesto del usuario: primero el prompt nativo,
   * luego sincronizar con OneSignal (iOS PWA pierde el gesto si hay awaits antes).
   */
  async enablePushFromUserGesture(): Promise<{ ok: boolean; error?: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { ok: false, error: 'Entorno no compatible' };
    }
    if (!environment.onesignalAppId) {
      return { ok: false, error: 'OneSignal no configurado' };
    }

    if (typeof Notification === 'undefined') {
      return { ok: false, error: 'Este dispositivo no soporta notificaciones web' };
    }

    if (Notification.permission === 'denied') {
      return { ok: false, error: 'Permiso bloqueado. Actívalo en Ajustes del teléfono → Notificaciones → Trámites MX' };
    }

    try {
      if (Notification.permission === 'default') {
        const native = await Promise.race([
          Notification.requestPermission(),
          this.delay(45000).then(() => 'default' as NotificationPermission),
        ]);
        if (native !== 'granted') {
          return { ok: false, error: native === 'denied' ? 'Permiso denegado' : 'No se completó el permiso' };
        }
      }

      const OS = await Promise.race([
        this.getInstance(),
        this.delay(15000).then(() => null),
      ]);

      if (!OS) {
        await this.refreshPermissionState();
        if (Notification.permission === 'granted') {
          return { ok: true };
        }
        return { ok: false, error: 'No se pudo conectar con el servicio de notificaciones. Intenta de nuevo.' };
      }

      if (OS.User?.PushSubscription?.optIn) {
        await Promise.race([
          OS.User.PushSubscription.optIn(),
          this.delay(12000),
        ]);
      } else if (OS.Notifications?.requestPermission) {
        await Promise.race([
          OS.Notifications.requestPermission(),
          this.delay(12000),
        ]);
      }

      await this.refreshPermissionState(OS);
      const granted = Notification.permission === 'granted' || OS.Notifications?.permission === true;
      return granted
        ? { ok: true }
        : { ok: false, error: 'Permiso concedido pero no se pudo activar la suscripción' };
    } catch (err) {
      console.warn('[OneSignal] enablePush:', err);
      await this.refreshPermissionState();
      if (Notification.permission === 'granted') {
        return { ok: true };
      }
      return { ok: false, error: 'Error al activar notificaciones' };
    }
  }

  async refreshPermissionState(oneSignal?: OneSignalClient): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const read = (OS?: OneSignalClient | null) => {
      if (typeof Notification === 'undefined') {
        this.permissionState.set('unsupported');
        return;
      }
      const notif = OS?.Notifications;
      if (notif?.isPushSupported && !notif.isPushSupported()) {
        this.permissionState.set('unsupported');
        return;
      }
      const native = notif?.permissionNative ?? Notification.permission;
      this.permissionState.set(
        native === 'granted' ? 'granted' : native === 'denied' ? 'denied' : 'default',
      );
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
    return this.permissionState() === 'default';
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
      }, 20000);

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
    if (window.OneSignal || window.OneSignalDeferred?.length) {
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
