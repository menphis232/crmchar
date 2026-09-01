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
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void | Promise<void>>;
  }
}

const ONESIGNAL_SW_PATH = 'push/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SW_SCOPE = '/push/onesignal/';

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private readonly platformId = inject(PLATFORM_ID);
  private initPromise: Promise<void> | null = null;
  readonly permissionState = signal<PushPermissionState>('default');

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!environment.onesignalAppId) return;
    if (this.initPromise) return;

    this.initPromise = this.runOnOneSignal(async (OneSignal) => {
      await OneSignal.init({
        appId: environment.onesignalAppId,
        serviceWorkerPath: ONESIGNAL_SW_PATH,
        serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: !environment.production,
      });
      await this.refreshPermissionState(OneSignal);
    }).catch(err => {
      console.warn('[OneSignal] init:', err);
      this.permissionState.set('unsupported');
    });
  }

  async syncUser(userId: string | null, role?: string | null): Promise<void> {
    if (!environment.onesignalAppId) return;
    await this.ensureInit();

    try {
      await this.runOnOneSignal(async (OneSignal) => {
        if (userId) {
          await OneSignal.login(userId);
          if (role && OneSignal.User?.addTag) {
            await OneSignal.User.addTag('role', role);
          }
        } else {
          await OneSignal.logout();
        }
        await this.refreshPermissionState(OneSignal);
      });
    } catch (err) {
      console.warn('[OneSignal] syncUser:', err);
    }
  }

  /** Debe llamarse desde un clic del usuario (requerido en iOS PWA y muchos móviles). */
  async enablePushFromUserGesture(): Promise<boolean> {
    if (!environment.onesignalAppId) return false;
    await this.ensureInit();

    try {
      const granted = await this.runOnOneSignal(async (OneSignal) => {
        const notif = OneSignal.Notifications;
        if (!notif?.requestPermission) return false;
        if (notif.isPushSupported && !notif.isPushSupported()) return false;

        const native = notif.permissionNative ?? Notification.permission;
        if (native === 'granted') return true;
        if (native === 'denied') return false;

        return await notif.requestPermission();
      });
      await this.refreshPermissionState();
      return granted;
    } catch (err) {
      console.warn('[OneSignal] enablePush:', err);
      return false;
    }
  }

  async refreshPermissionState(oneSignal?: OneSignalClient): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const read = async (OS: OneSignalClient) => {
      const notif = OS.Notifications;
      if (!notif) {
        this.permissionState.set('unsupported');
        return;
      }
      if (notif.isPushSupported && !notif.isPushSupported()) {
        this.permissionState.set('unsupported');
        return;
      }
      const native = notif.permissionNative ?? (typeof Notification !== 'undefined' ? Notification.permission : 'default');
      this.permissionState.set(native === 'granted' ? 'granted' : native === 'denied' ? 'denied' : 'default');
    };

    if (oneSignal) {
      await read(oneSignal);
      return;
    }

    if (!this.initPromise) {
      this.permissionState.set(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
      return;
    }

    try {
      await this.initPromise;
      await this.runOnOneSignal(read);
    } catch {
      this.permissionState.set('unsupported');
    }
  }

  shouldShowPrompt(): boolean {
    return this.permissionState() === 'default';
  }

  private async ensureInit(): Promise<void> {
    if (!this.initPromise) this.init();
    if (this.initPromise) await this.initPromise;
  }

  private runOnOneSignal<T>(fn: (oneSignal: OneSignalClient) => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          resolve(await fn(OneSignal));
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}
