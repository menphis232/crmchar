import {
  Component, OnInit, OnDestroy, signal, computed, Input, inject, NgZone, PLATFORM_ID, ElementRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Each tour step targets a real sidebar link selector
interface TourStep {
  title: string;
  speech: string;
  emoji: string;
  selector: string;      // CSS selector of the sidebar button/link to highlight
  tabValue?: string;     // optional: clicking this tab value to navigate
  mood: AvatarMood;
  gesture: Gesture;
}

type AvatarMood = 'idle' | 'happy' | 'excited' | 'thinking' | 'wave' | 'point-left' | 'point-up' | 'blink' | 'shrug';
type Gesture   = 'bounce' | 'spin' | 'shake' | 'jump' | 'wiggle' | 'point' | 'none';

const TOUR_STEPS: Record<string, TourStep[]> = {
  gestor: [
    {
      emoji: '👋', title: '¡Bienvenido!',
      speech: '¡Hola! Soy VEGA, tu asistente de panel. ¡Déjame mostrarte todo lo que puedes hacer aquí!',
      selector: '', mood: 'wave', gesture: 'bounce',
    },
    {
      emoji: '📊', title: 'Panel CRM',
      speech: '¡Empezamos! Aquí está tu **Dashboard CRM** — tus métricas más importantes: trámites activos, sin respuesta, tareas y conversión. ¡Siempre a la vista!',
      selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point',
    },
    {
      emoji: '🎯', title: 'Embudo de Ventas',
      speech: 'Este es el corazón de tu negocio: el **Embudo de Ventas Kanban**. Arrastra tus trámites entre etapas y dale clic a cualquiera para ver detalles y chatear con clientes.',
      selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'happy', gesture: 'wiggle',
    },
    {
      emoji: '🛠', title: 'Tus Servicios',
      speech: '¡Define qué trámites ofreces! Cada servicio tiene nombre, precio y tiempo estimado. Esto aparece en tu **ficha pública** para que los clientes te encuentren.',
      selector: '.dash-sidebar .dash-link:nth-of-type(3)', mood: 'excited', gesture: 'bounce',
    },
    {
      emoji: '💰', title: 'Finanzas',
      speech: 'Aquí controlas el dinero: ingresos, gastos, balance neto. Puedes exportar reportes en **CSV o PDF**. ¡Tu contador te lo agradecerá!',
      selector: '.dash-sidebar .dash-link:nth-of-type(4)', mood: 'happy', gesture: 'jump',
    },
    {
      emoji: '👤', title: 'Mi Perfil',
      speech: 'Personaliza tu información: biografía, logo, teléfono, e incluso la **configuración de tu propia API de IA**.',
      selector: '.dash-sidebar .dash-link:nth-of-type(5)', mood: 'thinking', gesture: 'wiggle',
    },
    {
      emoji: '🤖', title: 'Automatizaciones',
      speech: 'Lo más poderoso: **reglas automáticas**. Ejemplo: "Si un trámite lleva 3 días sin respuesta, manda un correo". ¡Vende mientras duermes!',
      selector: '.dash-sidebar .dash-link:nth-of-type(7)', mood: 'excited', gesture: 'spin',
    },
    {
      emoji: '🎉', title: '¡Ya eres experto!',
      speech: '¡Lo lograste! Ahora conoces tu panel al 100%. Puedo seguir aquí si tienes dudas — ¡solo escríbeme! 💬',
      selector: '', mood: 'happy', gesture: 'jump',
    },
  ],
  concesionaria: [
    {
      emoji: '👋', title: '¡Bienvenido!',
      speech: '¡Hola! Soy VEGA, tu asistente de panel. ¡Déjame mostrarte todo lo que tienes disponible aquí!',
      selector: '', mood: 'wave', gesture: 'bounce',
    },
    {
      emoji: '📊', title: 'Panel CRM',
      speech: '¡Empezamos! Tu **Dashboard** muestra leads activos, vehículos publicados, consultas y más. ¡Tu negocio en tiempo real!',
      selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point',
    },
    {
      emoji: '🎯', title: 'Embudo de Ventas',
      speech: '¡El Kanban de ventas! Sigue cada lead desde la primera consulta hasta el cierre. **Arrastra, clic, responde** — todo aquí.',
      selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'happy', gesture: 'wiggle',
    },
    {
      emoji: '🚗', title: 'Inventario',
      speech: '**Tu catálogo de autos**. Ve publicados, borradores y dados de baja. Da clic en cualquier vehículo para editar, publicar o darlo de baja.',
      selector: '.dash-sidebar .dash-link:nth-of-type(3)', mood: 'excited', gesture: 'bounce',
    },
    {
      emoji: '⭐', title: 'Reputación',
      speech: 'Las **reseñas de tus clientes** construyen tu reputación. Una buena calificación atrae más compradores. ¡Cuídala!',
      selector: '.dash-sidebar .dash-link:nth-of-type(5)', mood: 'happy', gesture: 'jump',
    },
    {
      emoji: '🎉', title: '¡Todo listo!',
      speech: '¡Eso es todo! Ahora sabes cómo navegar tu panel. Cualquier duda, ¡escríbeme!',
      selector: '', mood: 'happy', gesture: 'spin',
    },
  ],
  admin: [
    {
      emoji: '👋', title: '¡Bienvenido, Admin!',
      speech: '¡Hola! Soy VEGA. Este es el **Panel de Administración** donde controlas toda la plataforma. ¡Te lo explico todo!',
      selector: '', mood: 'wave', gesture: 'bounce',
    },
    {
      emoji: '📊', title: 'Estadísticas',
      speech: '**Vista global** de la plataforma: usuarios registrados, gestores activos, concesionarias, autos y más. Siempre al día.',
      selector: '.dash-sidebar .dash-link:nth-of-type(1)', mood: 'excited', gesture: 'point',
    },
    {
      emoji: '👥', title: 'Usuarios',
      speech: 'Aquí **gestionas todos los usuarios**: edita datos, cambia contraseñas y audita conversaciones y trámites de gestores o concesionarias.',
      selector: '.dash-sidebar .dash-link:nth-of-type(2)', mood: 'thinking', gesture: 'wiggle',
    },
    {
      emoji: '🎨', title: 'Personalización',
      speech: 'Define el **diseño** de las páginas públicas y paneles: colores, fuentes, bloques de contenido. ¡Tu marca, tu estilo!',
      selector: '.dash-sidebar .dash-link:nth-of-type(3)', mood: 'happy', gesture: 'jump',
    },
    {
      emoji: '⚙️', title: 'Config Global',
      speech: 'Aquí defines las **claves de Stripe** y configuras la **API Key de IA Global** que se usará como respaldo para los usuarios.',
      selector: '.dash-sidebar .dash-link:nth-of-type(7)', mood: 'excited', gesture: 'spin',
    },
    {
      emoji: '🎉', title: '¡Eres el jefe!',
      speech: '¡Perfecto! Tienes el control total de la plataforma. Recuerda: si necesitas ayuda, aquí estoy. 😄',
      selector: '', mood: 'happy', gesture: 'bounce',
    },
  ],
};

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.css',
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  @Input() panelRole: 'gestor' | 'concesionaria' | 'admin' = 'gestor';

  private http     = inject(HttpClient);
  private auth     = inject(AuthService);
  private zone     = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  // ─── VEGA State ───────────────────────────────────────
  isTourActive     = signal(false);
  isChatOpen       = signal(false);
  currentTourStep  = signal(0);
  speechText       = signal('');
  showSpeech       = signal(false);
  avatarMood       = signal<AvatarMood>('idle');
  currentGesture   = signal<Gesture>('none');
  isTypingSpeech   = signal(false);
  showPulse        = signal(true);
  hasAi            = signal(false);
  vegaVisible      = signal(true);

  // Chat state
  messages         = signal<ChatMessage[]>([]);
  inputValue       = '';
  isLoading        = signal(false);

  // Tour highlight
  highlightRect    = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  highlightActive  = signal(false);

  // Computed
  tourSteps  = computed(() => TOUR_STEPS[this.panelRole] || []);
  currentStep = computed(() => this.tourSteps()[this.currentTourStep()] || null);
  readonly TOUR_KEY = computed(() => `vega_tour_done_${this.panelRole}`);

  private speechTimeout: any;
  private gestureTimeout: any;
  private pulseTimeout: any;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check AI config
    this.http.get<{ provider: string | null }>(`${environment.apiUrl}/ai/config`).subscribe({
      next: (cfg) => this.hasAi.set(!!cfg.provider),
      error: () => this.hasAi.set(false)
    });

    // Initial wave greeting
    setTimeout(() => this.playMood('wave', 'bounce'), 800);
    setTimeout(() => this.playMood('idle', 'none'), 2800);

    // Pulse for 10 seconds
    this.pulseTimeout = setTimeout(() => this.showPulse.set(false), 10000);

    // Auto-start tour for first-timers
    setTimeout(() => this.checkAndStartTour(), 2500);
  }

  ngOnDestroy() {
    this.clearHighlight();
    clearTimeout(this.speechTimeout);
    clearTimeout(this.gestureTimeout);
    clearTimeout(this.pulseTimeout);
  }

  // ─── Tour Logic ──────────────────────────────────────

  private checkAndStartTour() {
    const done = localStorage.getItem(this.TOUR_KEY());
    if (!done) {
      this.startTour();
    }
  }

  startTour() {
    this.isChatOpen.set(false);
    this.isTourActive.set(true);
    this.currentTourStep.set(0);
    this.showPulse.set(false);
    this.goToStep(0);
  }

  goToStep(index: number) {
    const steps = this.tourSteps();
    if (index < 0 || index >= steps.length) return;

    this.currentTourStep.set(index);
    const step = steps[index];

    // Animate avatar
    this.playMood(step.mood, step.gesture);

    // Highlight element
    if (step.selector) {
      setTimeout(() => this.highlightElement(step.selector), 300);
    } else {
      this.clearHighlight();
    }

    // Type speech bubble
    this.typeSpeech(step.speech);
  }

  nextStep() {
    const next = this.currentTourStep() + 1;
    if (next >= this.tourSteps().length) {
      this.finishTour();
    } else {
      this.goToStep(next);
    }
  }

  prevStep() {
    const prev = this.currentTourStep() - 1;
    if (prev >= 0) {
      this.goToStep(prev);
    }
  }

  skipTour() {
    this.finishTour();
  }

  private finishTour() {
    localStorage.setItem(this.TOUR_KEY(), '1');
    this.clearHighlight();
    this.isTourActive.set(false);
    this.playMood('happy', 'jump');
    this.typeSpeech('¡Tour completado! 🎉 Ya conoces todo. Puedo responder cualquier duda que tengas. ¡Solo escríbeme!');
    setTimeout(() => {
      this.showSpeech.set(false);
      this.playMood('idle', 'none');
    }, 5000);
  }

  // ─── Highlight Engine ────────────────────────────────

  private highlightElement(selector: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) {
      this.clearHighlight();
      return;
    }

    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add highlight class
    document.querySelectorAll('.vega-highlight-target').forEach(e => e.classList.remove('vega-highlight-target'));
    el.classList.add('vega-highlight-target');

    // Get bounding rect for spotlight
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      this.zone.run(() => {
        this.highlightRect.set({
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        });
        this.highlightActive.set(true);
      });
    }, 400);
  }

  private clearHighlight() {
    this.highlightActive.set(false);
    this.highlightRect.set(null);
    document.querySelectorAll('.vega-highlight-target').forEach(e => e.classList.remove('vega-highlight-target'));
  }

  // ─── Avatar Mood & Gesture ───────────────────────────

  playMood(mood: AvatarMood, gesture: Gesture) {
    this.avatarMood.set(mood);
    this.currentGesture.set(gesture);
    clearTimeout(this.gestureTimeout);
    if (gesture !== 'none') {
      this.gestureTimeout = setTimeout(() => {
        this.currentGesture.set('none');
        if (mood !== 'idle') this.avatarMood.set('idle');
      }, 1200);
    }
  }

  // ─── Speech Bubble Typewriter ────────────────────────

  typeSpeech(text: string) {
    clearTimeout(this.speechTimeout);
    this.showSpeech.set(true);
    this.isTypingSpeech.set(true);
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1');
    this.speechText.set('');

    let i = 0;
    const speed = 28; // ms per char

    const typeChar = () => {
      if (i < clean.length) {
        this.speechText.set(clean.slice(0, ++i));
        this.speechTimeout = setTimeout(typeChar, speed);
      } else {
        this.isTypingSpeech.set(false);
      }
    };
    setTimeout(typeChar, 100);
  }

  getSpeechFormatted(): string {
    const raw = this.speechText();
    // Not using innerHTML replacement here since it's just plain text during typewriter
    return raw;
  }

  // ─── Chat Mode ───────────────────────────────────────

  toggleChat() {
    if (this.isTourActive()) {
      this.skipTour();
      return;
    }
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen() && this.messages().length === 0) {
      this.playMood('happy', 'bounce');
      this.addAssistantMessage('¡Hola! 👋 Soy VEGA. Pregúntame lo que quieras sobre el panel o la plataforma.');
      setTimeout(() => this.playMood('idle', 'none'), 1500);
    }
  }

  sendMessage() {
    const text = this.inputValue.trim();
    if (!text || this.isLoading()) return;

    this.messages.update(m => [...m, { role: 'user', content: text, timestamp: new Date() }]);
    this.inputValue = '';
    this.isLoading.set(true);
    this.playMood('thinking', 'none');

    const history = this.messages()
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    const roleName = this.panelRole === 'gestor' ? 'Gestor de Trámites'
      : this.panelRole === 'concesionaria' ? 'Concesionaria'
      : 'Administrador';

    const context = `Eres VEGA, asistente animado de TrámitesVehicularesdeMéxico.mx para un panel de ${roleName}.
Responde siempre en español mexicano, de forma breve y amigable. Usa emojis ocasionalmente.
Si preguntan cómo hacer algo en el panel, da pasos numerados claros.`;

    this.http.post<{ reply: string }>(`${environment.apiUrl}/ai/chat`, {
      message: text,
      history: history.slice(0, -1),
      context
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.playMood('happy', 'bounce');
        this.addAssistantMessage(res.reply);
        setTimeout(() => this.playMood('idle', 'none'), 1500);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.playMood('shrug', 'shake');
        const errMsg = err.error?.error || 'No pude conectarme. Intenta de nuevo.';
        this.addAssistantMessage(`⚠️ ${errMsg}`);
      }
    });
  }

  private addAssistantMessage(content: string) {
    this.messages.update(m => [...m, { role: 'assistant', content, timestamp: new Date() }]);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatMessage(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // ─── Quick Ask ───────────────────────────────────────

  quickAsk(q: string) {
    if (this.isTourActive()) this.skipTour();
    this.isChatOpen.set(true);
    this.inputValue = q;
    this.sendMessage();
  }

  // Expose steps count for template
  get totalSteps() { return this.tourSteps().length; }
}
