import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { CHAT_ATTACHMENT_ACCEPT, SupportService, UploadService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { SupportMessage } from '../models';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="sc-wrap">
      <div class="sc-header">
        <div>
          <strong>{{ heading }}</strong>
          @if (subtitle) {
            <span class="sc-sub">{{ subtitle }}</span>
          }
        </div>
        <span class="sc-live">● En vivo</span>
      </div>

      <div class="sc-messages" #box>
        @if (loading()) {
          <p class="sc-empty">Cargando conversación…</p>
        } @else if (!messages().length) {
          <p class="sc-empty">Sin mensajes aún. Escribe para iniciar el soporte.</p>
        }
        @for (m of messages(); track m.id) {
          <div class="sc-row" [class.mine]="isMine(m)">
            <span class="sc-meta">{{ m.senderName }} · {{ m.createdAt | date:'d MMM, HH:mm' }}</span>
            <div class="sc-bubble">
              @if (m.message) { <span>{{ m.message }}</span> }
              @if (m.fileUrl) {
                <a [href]="m.fileUrl" target="_blank" rel="noopener">📎 Ver adjunto</a>
              }
            </div>
          </div>
        }
      </div>

      <div class="sc-input">
        <input type="file" [accept]="attachmentAccept" hidden #fileInput (change)="onFile($event)">
        <button type="button" class="sc-attach" title="Adjuntar archivo" (click)="fileInput.click()" [disabled]="uploading()">📎</button>
        <input
          type="text"
          [(ngModel)]="draft"
          placeholder="Escribe un mensaje de soporte…"
          (keyup.enter)="send()"
          [disabled]="sending()"
        >
        <button type="button" class="sc-send" (click)="send()" [disabled]="sending() || !draft.trim()">
          Enviar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sc-wrap {
      display: flex; flex-direction: column; height: 100%; min-height: 420px;
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden;
    }
    .sc-header {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25);
    }
    .sc-header strong { color: #fff; font-size: 14px; display: block; }
    .sc-sub { display: block; color: #8b93a5; font-size: 12px; margin-top: 2px; }
    .sc-live { color: #00a86b; font-size: 11px; font-weight: 700; letter-spacing: .04em; }
    .sc-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
    }
    .sc-empty { margin: auto; color: #8b93a5; font-size: 13px; text-align: center; }
    .sc-row { display: flex; flex-direction: column; align-items: flex-start; max-width: 85%; }
    .sc-row.mine { align-self: flex-end; align-items: flex-end; }
    .sc-meta { font-size: 10px; color: #8b93a5; margin-bottom: 4px; }
    .sc-bubble {
      padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.45;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0;
      white-space: pre-wrap; word-break: break-word;
    }
    .sc-row.mine .sc-bubble {
      background: rgba(200,169,74,0.12); border-color: rgba(200,169,74,0.28);
    }
    .sc-bubble a { color: #c8a94a; display: block; margin-top: 6px; font-size: 12px; }
    .sc-input {
      display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);
    }
    .sc-input input[type="text"] {
      flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
      color: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px;
    }
    .sc-attach, .sc-send {
      border: 1px solid rgba(200,169,74,0.4); background: rgba(200,169,74,0.12); color: #c8a94a;
      border-radius: 8px; padding: 0 14px; cursor: pointer; font-weight: 600; font-size: 13px;
    }
    .sc-attach:disabled, .sc-send:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class SupportChatComponent implements OnInit, OnChanges, OnDestroy {
  @Input() peerId = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() mode: 'admin' | 'user' = 'user';
  @ViewChild('box') box?: ElementRef<HTMLDivElement>;

  messages = signal<SupportMessage[]>([]);
  loading = signal(true);
  sending = signal(false);
  uploading = signal(false);
  draft = '';
  readonly attachmentAccept = CHAT_ATTACHMENT_ACCEPT;
  private socket?: Socket;
  private roomId = '';

  constructor(
    private support: SupportService,
    private upload: UploadService,
    private auth: AuthService,
  ) {}

  get heading() {
    return this.title || (this.mode === 'admin' ? 'Soporte' : 'Soporte Trámites Vehiculares');
  }

  ngOnInit() {
    this.connectSocket();
    this.load();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['peerId'] && !changes['peerId'].firstChange) {
      this.socket?.emit('leave_support', this.roomId);
      this.connectSocket();
      this.load();
    }
  }

  ngOnDestroy() {
    if (this.roomId) this.socket?.emit('leave_support', this.roomId);
    this.socket?.disconnect();
  }

  isMine(m: SupportMessage) {
    return m.senderId === this.auth.user()?.id;
  }

  send() {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.draft = '';
    const req = this.mode === 'admin'
      ? this.support.sendMessage(this.peerId, { message: text })
      : this.support.sendMyMessage({ message: text });
    req.subscribe({
      next: saved => {
        this.pushMsg(saved);
        this.socket?.emit('send_support_message', { ...saved, clientId: this.roomId });
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.upload.uploadChatAttachment(file).subscribe({
      next: res => {
        const payload = { message: `📎 ${file.name}`, fileUrl: res.url };
        const req = this.mode === 'admin'
          ? this.support.sendMessage(this.peerId, payload)
          : this.support.sendMyMessage(payload);
        req.subscribe({
          next: saved => {
            this.pushMsg(saved);
            this.socket?.emit('send_support_message', { ...saved, clientId: this.roomId });
            this.uploading.set(false);
            input.value = '';
          },
          error: () => { this.uploading.set(false); input.value = ''; },
        });
      },
      error: () => { this.uploading.set(false); input.value = ''; },
    });
  }

  private connectSocket() {
    this.roomId = this.mode === 'admin'
      ? this.peerId
      : this.supportClientId();
    if (!this.socket) {
      this.socket = io(environment.apiUrl.replace(/\/api\/?$/, '') || window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
      this.socket.on('receive_support_message', (msg: SupportMessage & { clientId?: string }) => {
        if (!msg?.id) return;
        if (msg.clientId && msg.clientId !== this.roomId) return;
        this.pushMsg(msg);
      });
    }
    this.socket.emit('join_support', this.roomId);
  }

  private supportClientId() {
    const user = this.auth.user();
    if (!user) return '';
    if (user.role === 'cliente') return user.id;
    return user.parent_id || user.id;
  }

  private load() {
    if (this.mode === 'admin' && !this.peerId) {
      this.messages.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const req = this.mode === 'admin'
      ? this.support.getMessages(this.peerId)
      : this.support.getMyMessages();
    req.subscribe({
      next: msgs => {
        this.messages.set(msgs);
        this.loading.set(false);
        this.scrollBottom();
      },
      error: () => this.loading.set(false),
    });
  }

  private pushMsg(msg: SupportMessage) {
    this.messages.update(list => list.some(m => m.id === msg.id) ? list : [...list, msg]);
    this.scrollBottom();
  }

  private scrollBottom() {
    setTimeout(() => {
      const el = this.box?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }
}
