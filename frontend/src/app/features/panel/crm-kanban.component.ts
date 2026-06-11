import { Component, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CrmDeal } from '../../models';

@Component({
  selector: 'app-crm-kanban',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './crm-kanban.component.html',
  styleUrl: './panel-dashboard.css',
})
export class CrmKanbanComponent {
  stages = input.required<string[]>();
  stageLabels = input.required<Record<string, string>>();
  deals = input.required<CrmDeal[]>();
  showValue = input(false);

  dealSelect = output<CrmDeal>();
  stageChange = output<{ deal: CrmDeal; stage: string }>();

  dragOverStage = signal<string | null>(null);
  private draggedDealId: string | null = null;
  private didDrag = false;

  dealsInStage(stage: string) {
    return this.deals().filter(d => d.stage === stage);
  }

  onDragStart(event: DragEvent, deal: CrmDeal) {
    this.didDrag = false;
    this.draggedDealId = deal.id;
    const dt = event.dataTransfer;
    if (!dt) return;
    dt.effectAllowed = 'move';
    dt.setData('text/plain', deal.id);
    dt.setData('application/x-deal-id', deal.id);
    if (event.target instanceof HTMLElement) {
      dt.setDragImage(event.target, 10, 10);
    }
  }

  onDragEnd() {
    this.draggedDealId = null;
    this.dragOverStage.set(null);
    setTimeout(() => { this.didDrag = false; }, 100);
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

    const dealId =
      this.draggedDealId ||
      event.dataTransfer?.getData('application/x-deal-id') ||
      event.dataTransfer?.getData('text/plain');

    if (!dealId) return;

    const deal = this.deals().find(d => d.id === dealId);
    if (deal && deal.stage !== stage) {
      this.stageChange.emit({ deal, stage });
    }
    this.draggedDealId = null;
  }

  onCardClick(deal: CrmDeal) {
    if (!this.didDrag) this.dealSelect.emit(deal);
  }

  onSelectStage(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    const select = event.target as HTMLSelectElement;
    const stage = select.value;
    if (stage && stage !== deal.stage) {
      this.stageChange.emit({ deal, stage });
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
