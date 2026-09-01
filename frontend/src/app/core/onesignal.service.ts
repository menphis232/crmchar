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
    addEventListener?: (
      event: 'permissionChange' | 'foregroundWillDisplay' | 'click',
      listener: (event: unknown) => void,
    ) => void;
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
  private listenersRegistered = false;
  private pendingUser: { id: string; role?: string | null } | null = null;

  readonly permissionState = signal<PushPermissionState>('default');
  readonly subscribed = signal(false);
  readonly lastError = signal('');

  init(): void {
    if (!isPlatformBrowser(this.platformId) || !environment.onesignalAppId) return;
    void this.registerListeners().catch(err => console.warn('[OneSignal] listeners:', err));
    void this.refreshPermissionState().catch(err => console.warn('[OneSignal] init:', err));
    void this.repairBrokenSubscription().catch(err => console.warn('[OneSignal] repair:', err));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const user = this.pendingUser;
      if (user?.id) {
        void this.syncUser(user.id, user.role);
      }
    });
  }

  async syncUser(userId: string | null, role?: string | null): Promise<void> {
    if (!environment.onesignalAppId) return;

    if (userId) {
      this.pendingUser = { id: String(userId), role };
    } else {
      this.pendingUser = null;
    }

    try {
      await this.withOneSignal(async OS => {
        if (userId) {
          // Vincular siempre el usuario CRM (OneSignal v16: login en cada sesión).
          await OS.login(String(userId));
          if (role && OS.User?.addTag) {
            await OS.User.addTag('role', role);
          }

          if (this.nativePermission() === 'granted') {
            await this.ensureSubscribed(OS);
            await this.waitForSubscription(OS, 12000);
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
        error: this.formatInitError(window.__onesignalInitError),
      });
    }

    // Android: disparar el diálogo nativo en la pila del clic (antes de encolar OneSignal).
    if (this.nativePermission() === 'default' && typeof Notification !== 'undefined') {
      void Notification.requestPermission();
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve({
          ok: false,
          error: 'Tiempo agotado. Tras tocar Subscribe, también debes tocar Permitir en el mensaje del sistema Android.',
        });
      }, 55000);

      const finish = (result: { ok: boolean; error?: string }) => {
        clearTimeout(timeout);
        if (result.error) this.lastError.set(result.error);
        resolve(result);
      };

      const run = async (OS: OneSignalClient) => {
        try {
          finish(await this.completeSubscription(OS, userId, role));
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
    if (this.permissionState() === 'granted') return 'Permiso OK, falta token push — toca Activar';
    if (this.permissionState() === 'unsupported') return 'No soportadas aquí';
    return 'Sin activar';
  }

  private async repairBrokenSubscription(): Promise<void> {
    if (this.nativePermission() !== 'granted') return;

    await this.withOneSignal(async OS => {
      const user = this.pendingUser;
      if (user?.id) {
        await OS.login(String(user.id));
        if (user.role && OS.User?.addTag) {
          await OS.User.addTag('role', user.role);
        }
      }

      const sub = OS.User?.PushSubscription;
      if (sub?.token && sub.optedIn === true) return;

      await this.ensureSubscribed(OS);
      const ok = await this.waitForSubscription(OS, 15000);
      if (ok && user?.id) {
        await OS.login(String(user.id));
        if (user.role && OS.User?.addTag) {
          await OS.User.addTag('role', user.role);
        }
      }
      this.readState(OS);
    });
  }

  private async registerListeners(): Promise<void> {
    if (this.listenersRegistered) return;

    await this.withOneSignal(OS => {
      if (this.listenersRegistered) return Promise.resolve();

      OS.Notifications?.addEventListener?.('permissionChange', granted => {
        if (!granted) return;
        const user = this.pendingUser;
        void this.withOneSignal(inner =>
          this.completeSubscription(inner, user?.id, user?.role).then(result => {
            if (!result.ok && result.error) this.lastError.set(result.error);
          }),
        ).catch(() => {});
      });

      OS.Notifications?.addEventListener?.('foregroundWillDisplay', (event: unknown) => {
        const detail = event as { notification?: { display?: () => void } };
        // Android/Chrome: con la app abierta hay que mostrar la notificación explícitamente.
        detail.notification?.display?.();
      });

      OS.Notifications?.addEventListener?.('click', (event: unknown) => {
        const detail = event as { notification?: { launchUrl?: string } };
        const url = detail?.notification?.launchUrl;
        if (url) window.location.href = url;
      });

      OS.User?.PushSubscription?.addEventListener?.('change', (event: PushSubscriptionChangeEvent) => {
        this.readState(OS);
        const user = this.pendingUser;
        if (!user?.id || !this.hasActiveSubscription(event.current)) return;
        void this.withOneSignal(async inner => {
          await inner.login(String(user.id));
          if (user.role && inner.User?.addTag) {
            await inner.User.addTag('role', user.role);
          }
        }).catch(() => {});
      });

      this.listenersRegistered = true;
      return Promise.resolve();
    });
  }

  private async completeSubscription(
    OS: OneSignalClient,
    userId?: string | null,
    role?: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    if (OS.Notifications?.isPushSupported && !OS.Notifications.isPushSupported()) {
      return { ok: false, error: 'Este dispositivo no soporta notificaciones push aquí.' };
    }

    if (this.nativePermission() === 'denied') {
      return { ok: false, error: this.blockedPermissionMessage() };
    }

    if (this.nativePermission() !== 'granted') {
      let granted = false;
      try {
        const native = await Notification.requestPermission();
        granted = native === 'granted';
      } catch {
        granted = false;
      }
      if (!granted && OS.Notifications?.requestPermission) {
        granted = await OS.Notifications.requestPermission();
      }
      if (!granted && this.nativePermission() !== 'granted') {
        return {
          ok: false,
          error: 'Después de Activar, debes tocar Permitir en el mensaje del sistema Android.',
        };
      }
    }

    // Token FCM primero; login después (evita suscripción inválida en Android PWA).
    await this.ensureSubscribed(OS);
    const hasToken = await this.waitForSubscription(OS, 30000);
    if (!hasToken) {
      this.readState(OS);
      const sub = OS.User?.PushSubscription;
      const detail = [
        sub?.optedIn ? 'optedIn' : 'no-optedIn',
        sub?.id ? `id=${sub.id}` : 'sin-id',
        sub?.token ? 'token' : 'sin-token',
        `permiso=${this.nativePermission()}`,
      ].join(', ');
      return {
        ok: false,
        error: `No se obtuvo token push (${detail}). Borra datos del sitio, reinstala la PWA y vuelve a activar.`,
      };
    }

    if (userId) {
      await OS.login(String(userId));
      if (role && OS.User?.addTag) {
        await OS.User.addTag('role', role);
      }
      this.pendingUser = { id: String(userId), role };
    }

    this.readState(OS);
    this.lastError.set('');
    return { ok: true };
  }

  private formatInitError(raw: string): string {
    const match = raw.match(/Can only be used on:\s*(https?:\/\/[^\s]+)/i);
    if (match) {
      return `OneSignal está configurado para ${match[1]}, pero esta app usa https://central.tramitesvehicularesdemexico.com. Cambia Site URL en OneSignal dashboard.`;
    }
    return `OneSignal no inició: ${raw}`;
  }

  private nativePermission(): NotificationPermission {
    return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
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
    const isSubscribed = this.hasActiveSubscription(sub);
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

  private blockedPermissionMessage(): string {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) {
      return 'En Android: Ajustes → Apps → Trámites MX → Notificaciones → Permitir.';
    }
    return 'Permiso bloqueado en el teléfono. Actívalo en Ajustes → Notificaciones.';
  }

  private iosPwaRequiredMessage(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIos) return null;
    if (this.isStandalonePwa()) return null;
    return 'En iPhone: instala la app (Compartir → Añadir a inicio) y activa notificaciones desde el icono de la PWA.';
  }

  private isStandalonePwa(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  deviceHint(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    const ua = navigator.userAgent || '';
    const parts = [this.isStandalonePwa() ? 'PWA instalada' : 'Navegador (no PWA)'];
    if (/Android/i.test(ua)) parts.push('Android');
    else if (/iPhone|iPad/i.test(ua)) parts.push('iOS');
    else parts.push(navigator.platform || 'desconocido');
    return parts.join(' · ');
  }

  private async ensureSubscribed(OS: OneSignalClient): Promise<void> {
    const sub = OS.User?.PushSubscription;
    if (!sub?.optIn) {
      throw new Error('OneSignal no está listo. Recarga la app e intenta de nuevo.');
    }

    if (sub.token && sub.optedIn === true) return;

    if (sub.optOut && (sub.id || sub.optedIn)) {
      try {
        await sub.optOut();
      } catch {
        /* re-suscribir desde cero */
      }
    }

    await sub.optIn();
  }

  private waitForSubscription(OS: OneSignalClient, timeoutMs: number): Promise<boolean> {
    const sub = OS.User?.PushSubscription;
    if (!sub) return Promise.resolve(false);
    if (this.hasActiveSubscription(sub)) return Promise.resolve(true);

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
        if (this.hasActiveSubscription(event.current)) {
          finish(true);
        }
      };

      if (sub.addEventListener) {
        sub.addEventListener('change', listener);
      }

      const timer = setTimeout(() => {
        finish(this.hasActiveSubscription(OS.User?.PushSubscription));
      }, timeoutMs);
    });
  }

  private hasActiveSubscription(sub?: OneSignalPushSubscription | PushSubscriptionChangeEvent['current']): boolean {
    if (!sub) return false;
    return !!(sub.token && sub.optedIn === true);
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
