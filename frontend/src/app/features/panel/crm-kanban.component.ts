import { Component, input, output, signal, PLATFORM_ID, inject, effect, ElementRef, viewChildren } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import {
  LucideBanknote,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideLightbulb,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { CrmDeal } from '../../models';
import { CrmStageConfig, isDealPaymentLocked, isPaymentStage } from '../../shared/payment-stage.utils';
import { ToastService } from '../../core/toast.service';

export interface KanbanStage extends CrmStageConfig {}

@Component({
  selector: 'app-crm-kanban',
  standalone: true,
  imports: [DecimalPipe, LucideLightbulb, LucideChevronLeft, LucideChevronRight, LucideBanknote, LucideClock, LucidePlus, LucideTrash2],
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

    /* ── Editable column header ── */
    .kanban-col-header { position: relative; user-select: none; }
    .col-header-draggable { cursor: grab; }
    .col-header-draggable:active { cursor: grabbing; }
    .col-title-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .col-title-text.editable-hint { cursor: grab; }
    .col-title-text.editable-hint:hover { opacity: 0.80; }
    .col-title-input {
      flex: 1;
      background: rgba(255,255,255,0.08) !important;
      border: 1px solid rgba(255,255,255,0.35) !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      border-radius: 5px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      letter-spacing: 0.10em !important;
      text-transform: uppercase !important;
      padding: 3px 7px !important;
      outline: none !important;
      font-family: var(--f-display) !important;
      width: 100% !important;
    }
    .kanban-col.col-drag-over-left  { border-left: 3px solid rgba(255,255,255,0.60) !important; }
    .kanban-col.col-drag-over-right { border-right: 3px solid rgba(255,255,255,0.60) !important; }
    .kanban-col.col-dragging        { opacity: 0.40; }

    /* ── Add column modal ── */
    .add-col-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.72);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .add-col-modal {
      background: #0d0d0d;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 32px 28px 24px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.80);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .add-col-modal h3 {
      margin: 0;
      color: #ffffff;
      font-family: var(--f-display);
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .add-col-modal p {
      margin: 0;
      color: rgba(255,255,255,0.45);
      font-size: 13px;
      font-family: var(--f-ui);
      line-height: 1.5;
    }
    .add-col-input {
      background: #111 !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
      border-radius: 10px !important;
      font-size: 15px !important;
      font-family: var(--f-ui) !important;
      padding: 12px 14px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      outline: none !important;
      transition: border-color 0.2s !important;
    }
    .add-col-input:focus { border-color: rgba(255,255,255,0.50) !important; }
    .add-col-input::placeholder { color: rgba(255,255,255,0.28) !important; }
    .add-col-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-add-col-cancel {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.18);
      color: rgba(255,255,255,0.60);
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }
    .btn-add-col-cancel:hover { border-color: rgba(255,255,255,0.45); color: #fff; }
    .btn-add-col-confirm {
      background: #ffffff;
      border: 2px solid #ffffff;
      color: #000000;
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      padding: 9px 20px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }
    .btn-add-col-confirm:hover { background: transparent; color: #fff; }
    .btn-add-col-confirm:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Add column button ── */
    .kanban-add-col {
      flex: 0 0 48px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12px;
    }
    .btn-add-col {
      background: transparent;
      border: 1px dashed rgba(255,255,255,0.22);
      color: rgba(255,255,255,0.45);
      font-size: 22px;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
      line-height: 1;
    }
    .btn-add-col:hover {
      border-color: rgba(255,255,255,0.60);
      color: #ffffff;
      background: rgba(255,255,255,0.06);
    }
    .kanban-card.payment-locked {
      border-color: rgba(251, 191, 36, 0.45);
      box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.15);
    }
    .kanban-payment-lock {
      display: block;
      margin-top: 6px;
      font-size: 10px;
      line-height: 1.35;
      color: #fbbf24;
      font-weight: 600;
    }
    .kanban-col-payment .kanban-col-header {
      border-bottom-color: rgba(251, 191, 36, 0.35);
    }
    .col-header-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      margin-left: 4px;
    }
    .col-action-btn {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: color 0.15s, background 0.15s;
    }
    .col-action-btn:hover { color: #fff; background: rgba(255,255,255,0.10); }
    .col-action-btn.active { color: #fbbf24; }
    .col-action-btn.active:hover { color: #fcd34d; background: rgba(251,191,36,0.12); }
    .col-action-btn.danger:hover { color: #f87171; background: rgba(248,113,113,0.12); }
    .kanban-col-header { display: flex; align-items: center; gap: 4px; }
  `],
})
export class CrmKanbanComponent {
  stages      = input.required<string[]>();
  stageLabels = input.required<Record<string, string>>();
  stagesConfig = input<KanbanStage[] | null>(null);
  deals       = input.required<CrmDeal[]>();
  showValue   = input(false);
  editable    = input(false);
  paymentStageEditable = input(false);

  dealSelect   = output<CrmDeal>();
  stageChange  = output<{ deal: CrmDeal; stage: string; fromDrag?: boolean }>();
  stagesChange = output<KanbanStage[]>();

  // ── local editable stage list ──
  localStages = signal<KanbanStage[]>([]);

  // ── inline edit ──
  editingStageId = signal<string | null>(null);
  editingLabel   = signal('');

  // ── add column modal ──
  showAddCol   = signal(false);
  newColLabel  = signal('');

  // ── column drag state ──
  colDraggingId  = signal<string | null>(null);
  colDragOverId  = signal<string | null>(null);
  colDragSide    = signal<'left' | 'right'>('right');

  // ── card drag state ──
  dragOverStage   = signal<string | null>(null);
  isTouchDevice   = signal(false);
  private platformId     = inject(PLATFORM_ID);
  private toast          = inject(ToastService);
  private draggedDealId: string | null = null;
  private didDrag = false;
  private suppressClickUntil = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isTouchDevice.set('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
    // Sync localStages from inputs whenever they change
    effect(() => {
      const config = this.stagesConfig();
      if (config?.length) {
        this.localStages.set(config.map(s => ({ ...s })));
        return;
      }
      const ids    = this.stages();
      const labels = this.stageLabels();
      this.localStages.set(ids.map(id => ({ id, label: labels[id] || id })));
    });
  }

  // ── helpers ──
  dealsInStage(stage: string, stageIndex = 0) {
    const stageIds = new Set(this.stages());
    const inStage = this.deals().filter(d => d.stage === stage);
    if (stageIndex === 0) {
      const orphans = this.deals().filter(d => !stageIds.has(d.stage));
      return [...orphans, ...inStage];
    }
    return inStage;
  }

  private emitStagesChange() {
    this.stagesChange.emit([...this.localStages()]);
  }

  // ════════════════════════════════════════
  // INLINE EDIT — column title
  // ════════════════════════════════════════
  startEdit(stageId: string, event: Event) {
    if (!this.editable()) return;
    event.preventDefault();
    event.stopPropagation();
    const label = this.localStages().find(s => s.id === stageId)?.label ?? stageId;
    this.editingStageId.set(stageId);
    this.editingLabel.set(label);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.col-title-input');
      input?.focus();
      input?.select();
    }, 0);
  }

  saveEdit(stageId: string) {
    const newLabel = this.editingLabel().trim();
    if (newLabel) {
      this.localStages.update(list =>
        list.map(s => s.id === stageId ? { ...s, label: newLabel } : s)
      );
      this.emitStagesChange();
    }
    this.editingStageId.set(null);
  }

  cancelEdit() { this.editingStageId.set(null); }

  onEditKeydown(stageId: string, event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); this.saveEdit(stageId); }
    if (event.key === 'Escape') { this.cancelEdit(); }
  }

  // ════════════════════════════════════════
  // COLUMN DRAG & DROP — reorder
  // ════════════════════════════════════════
  onColDragStart(event: DragEvent, stageId: string) {
    if (!this.editable()) return;
    this.colDraggingId.set(stageId);
    event.dataTransfer?.setData('text/x-col-id', stageId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onColDragEnd() { this.colDraggingId.set(null); this.colDragOverId.set(null); }

  onColDragOver(event: DragEvent, stageId: string) {
    if (!event.dataTransfer?.types.includes('text/x-col-id')) return;
    event.preventDefault();
    event.stopPropagation();
    this.colDragOverId.set(stageId);
    // Determine side
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.colDragSide.set(event.clientX < rect.left + rect.width / 2 ? 'left' : 'right');
  }

  onColDragLeave(event: DragEvent, stageId: string) {
    if (this.colDragOverId() === stageId) this.colDragOverId.set(null);
  }

  onColDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    const fromId = event.dataTransfer?.getData('text/x-col-id');
    this.colDraggingId.set(null);
    this.colDragOverId.set(null);
    if (!fromId || fromId === targetId) return;

    const list = [...this.localStages()];
    const fromIdx   = list.findIndex(s => s.id === fromId);
    const targetIdx = list.findIndex(s => s.id === targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    const [moved] = list.splice(fromIdx, 1);
    const insertAt = this.colDragSide() === 'left' ? targetIdx : targetIdx + 1;
    list.splice(fromIdx < targetIdx ? insertAt - 1 : insertAt, 0, moved);
    this.localStages.set(list);
    this.emitStagesChange();
  }

  // ════════════════════════════════════════
  // ADD COLUMN modal
  // ════════════════════════════════════════
  addColumn() {
    this.newColLabel.set('');
    this.showAddCol.set(true);
    setTimeout(() => document.getElementById('new-col-input')?.focus(), 0);
  }

  confirmAddColumn() {
    const label = this.newColLabel().trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    this.localStages.update(list => [...list, { id, label }]);
    this.emitStagesChange();
    this.showAddCol.set(false);
  }

  cancelAddColumn() { this.showAddCol.set(false); }

  togglePaymentStage(stageId: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.editable() || !this.paymentStageEditable()) return;
    const isCurrentlyPayment = this.localStages().find(s => s.id === stageId)?.isPayment === true;
    this.localStages.update(list =>
      list.map(s => ({ ...s, isPayment: isCurrentlyPayment ? false : s.id === stageId }))
    );
    this.emitStagesChange();
    if (!isCurrentlyPayment) {
      this.toast.success('Columna marcada como etapa de pago. Los trámites aquí quedarán bloqueados hasta registrar el cobro.');
    }
  }

  deleteColumn(stageId: string, stageIndex: number, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.editable()) return;
    const count = this.dealsInStage(stageId, stageIndex).length;
    if (count > 0) {
      this.toast.warning(
        `No se puede eliminar: hay ${count} trámite${count === 1 ? '' : 's'} en esta columna. Muévelos antes de borrarla.`,
        'Columna con trámites',
      );
      return;
    }
    if (this.localStages().length <= 1) {
      this.toast.warning('Debe existir al menos una columna en el embudo.', 'No se puede eliminar');
      return;
    }
    this.localStages.update(list => list.filter(s => s.id !== stageId));
    this.emitStagesChange();
    this.toast.success('Columna eliminada');
  }

  // ════════════════════════════════════════
  // CARD DRAG & DROP  (existing logic)
  // ════════════════════════════════════════
  onDragStart(event: DragEvent, deal: CrmDeal) {
    if (this.isPaymentLocked(deal)) {
      event.preventDefault();
      this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      return;
    }
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
    if (event.dataTransfer?.types.includes('text/x-col-id')) return; // ignore col drags
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
    if (event.dataTransfer?.types.includes('text/x-col-id')) return;
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
    if (!deal || deal.stage === stage) return;
    if (this.isPaymentLocked(deal)) {
      this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      return;
    }
    this.stageChange.emit({ deal, stage, fromDrag: true });
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
    if (this.isPaymentLocked(deal)) {
      select.value = deal.stage;
      return;
    }
    if (stage && stage !== deal.stage && this.localStages().map(s=>s.id).includes(stage)) {
      this.stageChange.emit({ deal, stage, fromDrag: false });
    } else if (stage && stage !== deal.stage) {
      select.value = deal.stage;
    }
  }

  isPaymentLocked(deal: CrmDeal): boolean {
    return isDealPaymentLocked(deal, this.paymentStagesConfig());
  }

  isPaymentStageCol(stageId: string): boolean {
    return isPaymentStage(stageId, this.paymentStagesConfig());
  }

  private paymentStagesConfig(): KanbanStage[] | Record<string, string> {
    if (this.localStages().length) return this.localStages();
    const config = this.stagesConfig();
    if (config?.length) return config;
    return this.stageLabels();
  }

  canAdvance(deal: CrmDeal): boolean {
    if (this.isPaymentLocked(deal)) return false;
    const stages = this.localStages();
    const idx = stages.findIndex(s => s.id === deal.stage);
    return idx >= 0 && idx < stages.length - 1;
  }

  moveDeal(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    const stages = this.localStages();
    const idx = stages.findIndex(s => s.id === deal.stage);
    if (idx >= 0 && idx < stages.length - 1) {
      this.stageChange.emit({ deal, stage: stages[idx + 1].id });
    }
  }

  stopClick(event: Event) { event.stopPropagation(); }
}
