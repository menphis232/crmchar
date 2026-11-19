import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

/** Una sola conexión Socket.IO por sesión (evita múltiples handshakes). */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private identifiedKey: string | null = null;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;

  connect(userId: string, orgId?: string): Socket {
    const identifyKey = `${userId}:${orgId || userId}`;
    const payload = { userId, orgId: orgId || userId };

    if (this.socket?.connected) {
      if (this.identifiedKey !== identifyKey) {
        this.socket.emit('identify', payload);
        this.identifiedKey = identifyKey;
      }
      this.startPresencePing();
      return this.socket;
    }

    this.socket = io(environment.apiUrl.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      timeout: 10000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('identify', payload);
      this.startPresencePing();
    });

    this.identifiedKey = identifyKey;
    if (this.socket.connected) {
      this.socket.emit('identify', payload);
      this.startPresencePing();
    }

    return this.socket;
  }

  private startPresencePing() {
    if (this.presenceTimer) return;
    this.presenceTimer = setInterval(() => {
      if (this.socket?.connected) this.socket.emit('presence_ping');
    }, 45000);
  }

  private stopPresencePing() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  on<T = unknown>(event: string, handler: (payload: T) => void): void {
    this.socket?.on(event, handler as (...args: unknown[]) => void);
  }

  off(event: string, handler?: (...args: unknown[]) => void): void {
    if (handler) this.socket?.off(event, handler);
    else this.socket?.off(event);
  }

  emit(event: string, ...args: unknown[]): void {
    this.socket?.emit(event, ...args);
  }

  disconnect(): void {
    this.stopPresencePing();
    this.socket?.disconnect();
    this.socket?.removeAllListeners();
    this.socket = null;
    this.identifiedKey = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
