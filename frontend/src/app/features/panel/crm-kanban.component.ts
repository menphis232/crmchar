import { Component, input, output, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { CrmDeal } from '../../models';

@Component({
  selector: 'app-crm-kanban',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './crm-kanban.component.html',
  styleUrl: './panel-dashboard.css',
  styles: [`
    .kanban-stage-select {
      color-scheme: dark;
      background-color: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      color: rgba(255,255,255,0.80) !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      padding: 5px 8px !important;
      width: 100% !important;
      cursor: pointer !important;
      margin-top: 4px !important;
    }
    .kanban-stage-select option { background: #1a1a1a; color: #ffffff; }
    .kanban-stage-select:focus {
      border-color: var(--brand-black);
      color: var(--brand-black);
      outline: none;
      background: transparent !important;
    }
    .kanban-select-label { color: rgba(255,255,255,0.38) !important; font-size: 9px !important; }
  `],
})
export class CrmKanbanComponent {
  stages = input.required<string[]>();
  stageLabels = input.required<Record<string, string>>();
  deals = input.required<CrmDeal[]>();
  showValue = input(false);

  dealSelect = output<CrmDeal>();
  stageChange = output<{ deal: CrmDeal; stage: string; fromDrag?: boolean }>();

  dragOverStage = signal<string | null>(null);
  isTouchDevice = signal(false);
  private platformId = inject(PLATFORM_ID);
  private draggedDealId: string | null = null;
  private didDrag = false;
  private suppressClickUntil = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isTouchDevice.set(
        'ontouchstart' in window || navigator.maxTouchPoints > 0
      );
    }
  }

  dealsInStage(stage: string) {
    return this.deals().filter(d => d.stage === stage);
  }

  onDragStart(event: DragEvent, deal: CrmDeal) {
    this.didDrag = true;
    this.suppressClickUntil = Date.now() + 600;
    this.draggedDealId = deal.id;
    const dt = event.dataTransfer;
    if (!dt) return;
    dt.effectAllowed = 'move';
    dt.setData('text/plain', deal.id);
    dt.setData('application/x-deal-id', deal.id);
    if (event.target instanceof HTMLElement) {
      const card = event.target.closest('.kanban-card') as HTMLElement || event.target;
      dt.setDragImage(card, 12, 12);
    }
  }

  onDragEnd() {
    this.draggedDealId = null;
    this.dragOverStage.set(null);
    this.suppressClickUntil = Date.now() + 600;
    setTimeout(() => { this.didDrag = false; }, 600);
  }

  onDragOver(event: DragEvent, stage: string) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverStage.set(stage);
  }

  onDragLeave(event: DragEvent, stage: string) {
    const related = event.relatedTarget as Node | null;
    const current = event.currentTarget as Node;
    if (related && current.contains(related)) return;
    if (this.dragOverStage() === stage) this.dragOverStage.set(null);
  }

  onDrop(event: DragEvent, stage: string) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverStage.set(null);
    this.didDrag = true;
    this.suppressClickUntil = Date.now() + 600;

    const dealId =
      this.draggedDealId ||
      event.dataTransfer?.getData('application/x-deal-id') ||
      event.dataTransfer?.getData('text/plain');

    this.draggedDealId = null;

    if (!dealId) return;

    const deal = this.deals().find(d => d.id === dealId);
    if (deal && deal.stage !== stage) {
      this.stageChange.emit({ deal, stage, fromDrag: true });
    }
  }

  onCardClick(deal: CrmDeal) {
    if (this.didDrag || Date.now() < this.suppressClickUntil) return;
    this.dealSelect.emit(deal);
  }

  onCardClickIfDesktop(deal: CrmDeal) {
    if (!this.isTouchDevice()) this.onCardClick(deal);
  }

  onSelectStage(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    if (!(event as InputEvent).isTrusted) return;
    const select = event.target as HTMLSelectElement;
    const stage = select.value;
    if (stage && stage !== deal.stage && this.stages().includes(stage)) {
      this.stageChange.emit({ deal, stage, fromDrag: false });
    } else if (stage && stage !== deal.stage) {
      select.value = deal.stage;
    }
  }

  moveDeal(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    const stages = this.stages();
    const idx = stages.indexOf(deal.stage);
    if (idx >= 0 && idx < stages.length - 1) {
      this.stageChange.emit({ deal, stage: stages[idx + 1] });
    }
  }

  stopClick(event: Event) {
    event.stopPropagation();
  }
}
