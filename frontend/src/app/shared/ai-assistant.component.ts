import {
  Component, OnInit, OnDestroy, signal, computed, Input, inject, NgZone, PLATFORM_ID, effect
} from '@angular/core';
import { isPlatformBrowser, DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

const GOOGLE_FONTS: Record<string, string> = {
  'Inter': 'Inter:wght@400;600;700',
  'Montserrat': 'Montserrat:wght@400;600;700',
  'Poppins': 'Poppins:wght@400;600;700',
  'Roboto': 'Roboto:wght@400;500;700',
  'Open Sans': 'Open+Sans:wght@400;600;700',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TourStep {
  title: string;
  speech: string;
  emoji: string;
  selector: string;
  mood: string;
  gesture: string;
}

const TOUR_STEPS: Record<string, TourStep[]> = {
  gestor: [
    { emoji: '👋', title: '¡Bienvenido!', speech: '¡Hola! Soy tu asistente de panel. ¡Déjame mostrarte todo lo que puedes hacer aquí!', selector: '', mood: 'wave', gesture: 'bounce' },
    { emoji: '📊', title: 'Panel CRM', speech: 'Tu Dashboard CRM muestra trámites activos, sin respuesta, tareas y conversión.', selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point' },
    { emoji: '🎯', title: 'Embudo de Ventas', speech: 'El Embudo Kanban: arrastra trámites entre etapas y chatea con clientes.', selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'happy', gesture: 'wiggle' },
    { emoji: '🛠', title: 'Servicios', speech: 'Define qué trámites ofreces con nombre, precio y tiempo estimado.', selector: '.dash-sidebar .dash-link:nth-of-type(3)', mood: 'excited', gesture: 'bounce' },
    { emoji: '💰', title: 'Finanzas', speech: 'Controla ingresos, gastos y exporta reportes CSV o PDF.', selector: '.dash-sidebar .dash-link:nth-of-type(4)', mood: 'happy', gesture: 'jump' },
    { emoji: '🎉', title: '¡Listo!', speech: '¡Tour completado! Escríbeme si tienes dudas.', selector: '', mood: 'happy', gesture: 'jump' },
  ],
  concesionaria: [
    { emoji: '👋', title: '¡Bienvenido!', speech: '¡Hola! Te muestro tu panel de concesionaria.', selector: '', mood: 'wave', gesture: 'bounce' },
    { emoji: '📊', title: 'Panel CRM', speech: 'Dashboard con leads activos, vehículos publicados y consultas.', selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point' },
    { emoji: '🎯', title: 'Embudo', speech: 'Kanban de ventas: sigue cada lead hasta el cierre.', selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'happy', gesture: 'wiggle' },
    { emoji: '🚗', title: 'Inventario', speech: 'Tu catálogo: publicados, borradores y dados de baja.', selector: '.dash-sidebar .dash-link:nth-of-type(3)', mood: 'excited', gesture: 'bounce' },
    { emoji: '🎉', title: '¡Listo!', speech: '¡Eso es todo! Escríbeme si necesitas ayuda.', selector: '', mood: 'happy', gesture: 'spin' },
  ],
  admin: [
    { emoji: '👋', title: '¡Bienvenido!', speech: 'Panel de administración. Te explico las secciones principales.', selector: '', mood: 'wave', gesture: 'bounce' },
    { emoji: '📊', title: 'Estadísticas', speech: 'Vista global: usuarios, gestores, concesionarias y autos.', selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point' },
    { emoji: '👥', title: 'Usuarios', speech: 'Gestiona usuarios, contraseñas y audita conversaciones.', selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'thinking', gesture: 'wiggle' },
    { emoji: '🎉', title: '¡Listo!', speech: 'Tienes el control total. ¡Aquí estoy si necesitas ayuda!', selector: '', mood: 'happy', gesture: 'bounce' },
  ],
};

const QUICK_QUESTIONS: Record<string, string[]> = {
  gestor: [
    '¿Cuánto he vendido hoy?',
    'Muéstrame mis trámites activos',
    'Crea un lead nuevo',
    '¿Cuál es mi balance en finanzas?',
  ],
  concesionaria: [
    '¿Cuántos vehículos tengo en inventario?',
    '¿Cuánto he vendido hoy?',
    'Registra un ingreso',
    'Crea un lead nuevo',
  ],
  admin: [
    '¿Cómo gestiono usuarios?',
    '¿Cómo configuro la API de IA global?',
    '¿Cómo personalizo el sitio?',
  ],
};

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.css',
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  @Input() panelRole: 'gestor' | 'concesionaria' | 'admin' = 'gestor';

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT) as Document;

  isTourActive = signal(false);
  isChatOpen = signal(false);
  currentTourStep = signal(0);
  speechText = signal('');
  showSpeech = signal(false);
  isTypingSpeech = signal(false);
  hasAi = signal(false);

  messages = signal<ChatMessage[]>([]);
  inputValue = '';
  isLoading = signal(false);

  highlightRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  highlightActive = signal(false);

  tourSteps = computed(() => {
    const steps = TOUR_STEPS[this.panelRole] || [];
    if (!steps.length) return steps;
    const name = this.assistantName();
    return steps.map((step, index) => {
      if (index !== 0) return step;
      return {
        ...step,
        speech: `¡Hola! Soy ${name}, tu asistente de panel. ¡Déjame mostrarte todo lo que puedes hacer aquí!`,
      };
    });
  });
  quickQuestions = computed(() => QUICK_QUESTIONS[this.panelRole] || []);
  readonly TOUR_KEY = computed(() => `vega_tour_done_${this.panelRole}`);

  isEnabled = computed(() => {
    const u = this.auth.user();
    if (!u) return false;
    const val = u.panel_assistant_enabled;
    return val === undefined || val === null || val === true || val === 1;
  });

  assistantName = computed(() => this.auth.user()?.panel_assistant_name?.trim() || 'VEGA');
  bgColor = computed(() => this.auth.user()?.panel_assistant_bg_color || '#0f172a');
  btnColor = computed(() => this.auth.user()?.panel_assistant_btn_color || '#4F46E5');
  textColor = computed(() => this.auth.user()?.panel_assistant_text_color || '#FFFFFF');
  assistantFont = computed(() => this.auth.user()?.panel_assistant_font || 'League Spartan');

  positionClass = computed(() => {
    const pos = this.auth.user()?.panel_assistant_position || 'bottom-right';
    return `pos-${pos}`;
  });

  private speechTimeout: ReturnType<typeof setTimeout> | undefined;
  private lastAssistantName = '';

  constructor() {
    effect(() => {
      const name = this.assistantName();
      if (this.lastAssistantName && this.lastAssistantName !== name) {
        this.messages.update(list => {
          if (list.length === 1 && list[0].role === 'assistant' && list[0].content.includes(this.lastAssistantName)) {
            return [{ ...list[0], content: this.welcomeMessage() }];
          }
          return list;
        });
      }
      this.lastAssistantName = name;
    });

    effect(() => {
      const font = this.assistantFont();
      if (isPlatformBrowser(this.platformId) && GOOGLE_FONTS[font]) {
        const id = `gf-${font.replace(/ /g, '-').toLowerCase()}`;
        if (!this.doc.getElementById(id)) {
          const link = this.doc.createElement('link');
          link.id = id;
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[font]}&display=swap`;
          this.doc.head.appendChild(link);
        }
      }
    });
  }

  private welcomeMessage() {
    return `¡Hola! 👋 Soy ${this.assistantName()}. Pregúntame lo que quieras sobre el panel.`;
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.http.get<{ provider: string | null }>(`${environment.apiUrl}/ai/config`).subscribe({
      next: (cfg) => this.hasAi.set(!!cfg.provider),
      error: () => this.hasAi.set(false),
    });

    setTimeout(() => this.checkAndStartTour(), 2000);
  }

  ngOnDestroy() {
    this.clearHighlight();
    clearTimeout(this.speechTimeout);
  }

  private checkAndStartTour() {
    if (!this.isEnabled()) return;
    const done = localStorage.getItem(this.TOUR_KEY());
    if (!done) this.startTour();
  }

  startTour() {
    this.isChatOpen.set(true);
    this.isTourActive.set(true);
    this.currentTourStep.set(0);
    this.goToStep(0);
  }

  goToStep(index: number) {
    const steps = this.tourSteps();
    if (index < 0 || index >= steps.length) return;
    this.currentTourStep.set(index);
    const step = steps[index];
    if (step.selector) {
      setTimeout(() => this.highlightElement(step.selector), 300);
    } else {
      this.clearHighlight();
    }
    this.typeSpeech(step.speech);
  }

  nextStep() {
    const next = this.currentTourStep() + 1;
    if (next >= this.tourSteps().length) this.finishTour();
    else this.goToStep(next);
  }

  prevStep() {
    const prev = this.currentTourStep() - 1;
    if (prev >= 0) this.goToStep(prev);
  }

  skipTour() { this.finishTour(); }

  private finishTour() {
    localStorage.setItem(this.TOUR_KEY(), '1');
    this.clearHighlight();
    this.isTourActive.set(false);
    this.showSpeech.set(false);
    this.typeSpeech('¡Tour completado! Escríbeme si tienes dudas.');
    setTimeout(() => this.showSpeech.set(false), 4000);
  }

  private highlightElement(selector: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) { this.clearHighlight(); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('.vega-highlight-target').forEach(e => e.classList.remove('vega-highlight-target'));
    el.classList.add('vega-highlight-target');
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      this.zone.run(() => {
        this.highlightRect.set({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
        this.highlightActive.set(true);
      });
    }, 400);
  }

  private clearHighlight() {
    this.highlightActive.set(false);
    this.highlightRect.set(null);
    document.querySelectorAll('.vega-highlight-target').forEach(e => e.classList.remove('vega-highlight-target'));
  }

  typeSpeech(text: string) {
    clearTimeout(this.speechTimeout);
    this.showSpeech.set(true);
    this.isTypingSpeech.set(true);
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1');
    this.speechText.set('');
    let i = 0;
    const typeChar = () => {
      if (i < clean.length) {
        this.speechText.set(clean.slice(0, ++i));
        this.speechTimeout = setTimeout(typeChar, 24);
      } else {
        this.isTypingSpeech.set(false);
      }
    };
    setTimeout(typeChar, 80);
  }

  toggleChat() {
    if (this.isTourActive()) {
      this.finishTour();
      return;
    }
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen() && this.messages().length === 0) {
      this.addAssistantMessage(this.welcomeMessage());
    }
  }

  closePanel() {
    if (this.isTourActive()) this.finishTour();
    this.isChatOpen.set(false);
  }

  sendMessage() {
    const text = this.inputValue.trim();
    if (!text || this.isLoading() || this.isTourActive()) return;

    this.messages.update(m => [...m, { role: 'user', content: text, timestamp: new Date() }]);
    this.inputValue = '';
    this.isLoading.set(true);

    const history = this.messages().slice(-10).map(m => ({ role: m.role, content: m.content }));
    const roleName = this.panelRole === 'gestor' ? 'Gestor de Trámites'
      : this.panelRole === 'concesionaria' ? 'Concesionaria' : 'Administrador';

    const context = `Eres ${this.assistantName()}, asistente inteligente del panel de TrámitesVehicularesdeMéxico.mx para un ${roleName}.
Responde en español mexicano, breve y amigable. Usa emojis ocasionalmente.
Tienes acceso en tiempo real a datos del negocio: inventario, leads activos, finanzas (ingresos, gastos, balance) y perfil del usuario.
Puedes ejecutar acciones directamente: crear leads, registrar ingresos/gastos, agregar vehículos al inventario, actualizar el perfil, enviar correos y mensajes de chat.
Si preguntan cómo hacer algo en el panel, da pasos numerados claros.`;

    this.http.post<{ reply: string }>(`${environment.apiUrl}/ai/chat`, {
      message: text,
      history: history.slice(0, -1),
      context,
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.addAssistantMessage(res.reply);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.addAssistantMessage(`⚠️ ${err.error?.error || 'No pude conectarme. Intenta de nuevo.'}`);
      },
    });
  }

  private addAssistantMessage(content: string) {
    this.messages.update(m => [...m, { role: 'assistant', content, timestamp: new Date() }]);
  }

  quickAsk(q: string) {
    if (this.isTourActive()) this.finishTour();
    this.isChatOpen.set(true);
    this.inputValue = q;
    this.sendMessage();
  }

  formatMessage(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  get totalSteps() { return this.tourSteps().length; }
}
