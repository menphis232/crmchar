import { Component, input, output, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideBanknote, LucideChevronLeft, LucideChevronRight, LucideLightbulb } from '@lucide/angular';
import { PeritoDeal } from '../../models';
import { PERITO_STAGES, PERITO_STAGE_LABELS } from '../../shared/perito-stages';

@Component({
  selector: 'app-perito-kanban',
  standalone: true,
  imports: [DecimalPipe, FormsModule, LucideLightbulb, LucideChevronLeft, LucideChevronRight, LucideBanknote],
  templateUrl: './perito-kanban.component.html',
  styleUrl: '../panel/panel-dashboard.css',
})
export class PeritoKanbanComponent {
  deals = input.required<PeritoDeal[]>();
  stages = input<{ id: string; label: string }[]>([]);
  dealClick = output<PeritoDeal>();
  stageChange = output<{ deal: PeritoDeal; stage: string }>();

  private platformId = inject(PLATFORM_ID);
  dragDealId = signal<string | null>(null);
  dragOverStage = signal<string | null>(null);

  isTouchDevice() {
    return isPlatformBrowser(this.platformId) && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  stageList() {
    const fromInput = this.stages();
    if (fromInput.length) return fromInput;
    return PERITO_STAGES.map((id) => ({ id, label: PERITO_STAGE_LABELS[id] }));
  }

  dealsInStage(stageId: string) {
    return this.deals().filter((d) => (d.peritoStage || 'tramite') === stageId);
  }

  onDragStart(e: DragEvent, deal: PeritoDeal) {
    this.dragDealId.set(deal.id);
    e.dataTransfer?.setData('text/plain', deal.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd() {
    this.dragDealId.set(null);
    this.dragOverStage.set(null);
  }

  onDragOver(e: DragEvent, stageId: string) {
    e.preventDefault();
    this.dragOverStage.set(stageId);
  }

  onDrop(e: DragEvent, stageId: string) {
    e.preventDefault();
    const id = e.dataTransfer?.getData('text/plain') || this.dragDealId();
    const deal = this.deals().find((d) => d.id === id);
    this.dragDealId.set(null);
    this.dragOverStage.set(null);
    if (deal && (deal.peritoStage || 'tramite') !== stageId) {
      this.stageChange.emit({ deal, stage: stageId });
    }
  }

  onStageSelect(deal: PeritoDeal, stage: string) {
    if ((deal.peritoStage || 'tramite') !== stage) {
      this.stageChange.emit({ deal, stage });
    }
  }

  onCardClick(deal: PeritoDeal) {
    this.dealClick.emit(deal);
  }

  nextStage(deal: PeritoDeal, e: Event) {
    e.stopPropagation();
    const list = this.stageList();
    const idx = list.findIndex((s) => s.id === (deal.peritoStage || 'tramite'));
    if (idx >= 0 && idx < list.length - 1) {
      this.stageChange.emit({ deal, stage: list[idx + 1].id });
    }
  }

  canAdvance(deal: PeritoDeal) {
    const list = this.stageList();
    const idx = list.findIndex((s) => s.id === (deal.peritoStage || 'tramite'));
    return idx >= 0 && idx < list.length - 1;
  }
}
