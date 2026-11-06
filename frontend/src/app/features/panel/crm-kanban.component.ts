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
import { CrmStageConfig, isDealPaymentLocked, isPaidDealBackwardMoveBlocked, isPaymentStage } from '../../shared/payment-stage.utils';
import { ToastService } from '../../core/toast.service';
import { PERITO_STAGE_LABELS, PeritoStageId } from '../../shared/perito-stages';

export interface KanbanStage extends CrmStageConfig {}

@Component({
  selector: 'app-crm-kanban',
  standalone: true,
  imports: [DecimalPipe, LucideLightbulb, LucideChevronLeft, LucideChevronRight, LucideBanknote, LucideClock, LucidePlus, LucideTrash2],
  templateUrl: './crm-kanban.component.html',
  styleUrl: './panel-dashboard.css',
  styles: [`
    .kanban-stage-select {
      color-scheme: light;
      background-color: #fff !important;
      border: 1px solid #e6e9ef !important;
      color: #323338 !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      padding: 5px 8px !important;
      width: 100% !important;
      cursor: pointer !important;
      margin-top: 4px !important;
    }
    .kanban-stage-select option { background: #fff; color: #323338; }
    .kanban-stage-select:focus {
      border-color: #0073ea;
      color: #323338;
      outline: none;
      background: #fff !important;
    }
    .kanban-select-label { color: #676879 !important; font-size: 9px !important; }

    /* ── Editable column header ── */
    .kanban-col-header { position: relative; user-select: none; }
    .col-header-draggable { cursor: grab; }
    .col-header-draggable:active { cursor: grabbing; }
    .col-title-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      white-space: normal;
      text-transform: none;
      letter-spacing: -0.01em;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.25;
      color: #323338;
    }
    .col-title-text.editable-hint { cursor: grab; }
    .col-title-text.editable-hint:hover { opacity: 0.80; }
    .col-title-input {
      flex: 1;
      background: #fff !important;
      border: 1px solid #0073ea !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 5px !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      padding: 3px 7px !important;
      outline: none !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      width: 100% !important;
    }
    .kanban-col.col-drag-over-left  { border-left: 3px solid #0073ea !important; }
    .kanban-col.col-drag-over-right { border-right: 3px solid #0073ea !important; }
    .kanban-col.col-dragging        { opacity: 0.40; }

    /* ── Add column modal (Monday light) ── */
    .add-col-overlay {
      position: fixed; inset: 0;
      background: rgba(50, 51, 56, 0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .add-col-modal {
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      padding: 28px 24px 20px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 16px 48px rgba(50, 51, 56, 0.18);
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-family: Figtree, system-ui, sans-serif;
    }
    .add-col-modal h3 {
      margin: 0;
      color: #323338;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      text-transform: none;
    }
    .add-col-modal p {
      margin: 0;
      color: #676879;
      font-size: 13px;
      line-height: 1.5;
    }
    .add-col-input {
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-family: Figtree, system-ui, sans-serif !important;
      padding: 11px 12px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      outline: none !important;
    }
    .add-col-input:focus {
      border-color: #0073ea !important;
      box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.15) !important;
    }
    .add-col-input::placeholder { color: #9ca0ad !important; }
    .add-col-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-add-col-cancel {
      background: #fff;
      border: 1px solid #e6e9ef;
      color: #323338;
      font: 600 13px Figtree, system-ui, sans-serif;
      padding: 9px 14px;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-add-col-cancel:hover { border-color: #0073ea; color: #0073ea; }
    .btn-add-col-confirm {
      background: #0073ea;
      border: 1px solid #0073ea;
      color: #fff;
      font: 600 13px Figtree, system-ui, sans-serif;
      padding: 9px 16px;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-add-col-confirm:hover { background: #0060c2; }
    .btn-add-col-confirm:disabled { opacity: 0.45; cursor: not-allowed; }

    .kanban-add-col {
      flex: 0 0 48px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12px;
    }
    .btn-add-col {
      background: #fff;
      border: 1px dashed #c5c7d0;
      color: #676879;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-add-col:hover { border-color: #0073ea; color: #0073ea; background: #e5f4ff; }

    .kanban-card.payment-locked {
      border-color: #ffd8a8;
      box-shadow: inset 0 0 0 1px rgba(199, 119, 0, 0.08);
    }
    .kanban-payment-lock {
      display: block;
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.35;
      color: #c77700;
      font-weight: 600;
    }
    .kanban-col-payment { border-top-color: #fdab3d !important; }
    .kanban-col-payment .kanban-col-header { border-bottom-color: #ffe8c2 !important; }
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
      color: #9ca0ad;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .col-action-btn:hover { color: #0073ea; background: #e5f4ff; }
    .col-action-btn.active { color: #c77700; background: #fff4e5; }
    .col-action-btn.danger:hover { color: #dc2626; background: #fee2e2; }
    .kanban-col-header { display: flex; align-items: center; gap: 6px; }

    .kanban-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .kanban-card-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .kanban-card-delete {
      border: none;
      background: transparent;
      color: #c5c7d0;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kanban-card-delete:hover { color: #dc2626; background: #fee2e2; }

    /* Monday light — embudo Acuerdos */
    .kanban-hint,
    .kanban-scroll-hint {
      background: #f7f8fa !important;
      color: #676879 !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 8px !important;
      font-family: Figtree, system-ui, sans-serif !important;
    }
    .kanban-col {
      flex: 0 0 260px !important;
      background: #f0f1f5 !important;
      border: 1px solid #e6e9ef !important;
      border-top: 3px solid #0073ea !important;
      border-radius: 10px !important;
      scrollbar-color: #c5c7d0 transparent;
    }
    .kanban-col.drag-over {
      border-color: #0073ea !important;
      background: #e5f4ff !important;
    }
    .kanban-col-header {
      color: #323338 !important;
      border-bottom: 1px solid #e6e9ef !important;
      font-family: Figtree, system-ui, sans-serif !important;
      text-transform: none !important;
      letter-spacing: 0 !important;
      font-size: 13px !important;
      margin-bottom: 12px !important;
      padding-bottom: 10px !important;
    }
    .kanban-col-header span:first-child { color: #323338 !important; font-weight: 700 !important; }
    .kanban-count {
      background: #fff !important;
      color: #676879 !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 999px !important;
      font-weight: 700 !important;
    }
    .kanban-card {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-left: 3px solid #0073ea !important;
      border-radius: 8px !important;
      color: #323338 !important;
      box-shadow: 0 1px 3px rgba(50, 51, 56, 0.06) !important;
      font-family: Figtree, system-ui, sans-serif !important;
    }
    .kanban-card:hover {
      border-left-color: #0073ea !important;
      box-shadow: 0 4px 12px rgba(0, 115, 234, 0.1) !important;
      transform: translateY(-1px);
    }
    .kanban-empty {
      border: 1px dashed #c5c7d0 !important;
      border-radius: 8px !important;
      color: #9ca0ad !important;
      background: transparent !important;
      text-transform: none !important;
      letter-spacing: 0 !important;
      font-family: Figtree, system-ui, sans-serif !important;
    }
    .kanban-col.drag-over .kanban-empty {
      border-color: #0073ea !important;
      color: #0073ea !important;
      background: rgba(0, 115, 234, 0.04) !important;
    }
    .kanban-contact { color: #323338 !important; }
    .kanban-meta, .kanban-days { color: #676879 !important; }
    .kanban-value { color: #323338 !important; font-weight: 600 !important; }
    .kanban-card-top strong { color: #323338 !important; }
    .kanban-assignee {
      color: #0073ea !important;
      background: #e5f4ff !important;
      border-color: #b3dbfd !important;
      text-transform: none !important;
      letter-spacing: 0 !important;
      font-weight: 600 !important;
    }
    .kanban-perito-badge {
      color: #676879 !important;
      background: #f7f8fa !important;
      border-color: #e6e9ef !important;
    }
    .kanban-perito-poliza {
      color: #c77700 !important;
      background: #fff4e5 !important;
      text-transform: none !important;
    }
    .kanban-perito-poliza.paid {
      color: #00854d !important;
      background: #e7f8ef !important;
    }
    .kanban-next {
      border-radius: 6px !important;
      border-color: #e6e9ef !important;
      color: #676879 !important;
    }
    .kanban-next:hover {
      background: #0073ea !important;
      border-color: #0073ea !important;
      color: #fff !important;
    }
    .kanban-select-label {
      display: block !important;
      margin: 10px 0 4px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      text-transform: none !important;
      letter-spacing: 0 !important;
      color: #676879 !important;
    }
    .kanban-stage-select {
      background-color: #fff !important;
      border-radius: 6px !important;
      font-family: Figtree, system-ui, sans-serif !important;
    }
    .kanban-stage-select option { background: #fff; }
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
  dealDelete   = output<CrmDeal>();

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
  cleanLabel(text: string): string {
    return (text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

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
    const newLabel = this.cleanLabel(this.editingLabel());
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
    const label = this.cleanLabel(this.newColLabel());
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
    const dealId =
      this.draggedDealId ||
      event.dataTransfer?.getData('application/x-deal-id') ||
      event.dataTransfer?.getData('text/plain');
    const deal = dealId ? this.deals().find(d => d.id === dealId) : null;
    if (deal && !this.canMoveToStage(deal, stage)) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
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
    if (!this.canMoveToStage(deal, stage)) {
      if (this.isPaymentLocked(deal)) {
        this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      } else {
        this.toast.warning('Los trámites ya pagados solo pueden avanzar, no retroceder en el embudo.', 'Solo hacia adelante');
      }
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
    if (!this.canMoveToStage(deal, stage)) {
      select.value = deal.stage;
      if (this.isPaymentLocked(deal)) {
        this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      } else if (stage && stage !== deal.stage) {
        this.toast.warning('Los trámites ya pagados solo pueden avanzar, no retroceder en el embudo.', 'Solo hacia adelante');
      }
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

  peritoStageLabel(stage: string | null | undefined): string {
    return PERITO_STAGE_LABELS[(stage || 'tramite') as PeritoStageId] || 'Trámite';
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
    if (idx < 0 || idx >= stages.length - 1) return false;
    return this.canMoveToStage(deal, stages[idx + 1].id);
  }

  selectableStages(deal: CrmDeal): KanbanStage[] {
    const stages = this.localStages();
    if (deal.paymentStatus !== 'paid') return stages;
    const idx = stages.findIndex(s => s.id === deal.stage);
    if (idx < 0) return stages;
    return stages.slice(idx);
  }

  canMoveToStage(deal: CrmDeal, targetStage: string): boolean {
    if (this.isPaymentLocked(deal)) return false;
    if (!targetStage || targetStage === deal.stage) return true;
    return !isPaidDealBackwardMoveBlocked(deal, this.paymentStagesConfig(), targetStage);
  }

  moveDeal(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    const stages = this.localStages();
    const idx = stages.findIndex(s => s.id === deal.stage);
    if (idx >= 0 && idx < stages.length - 1) {
      this.stageChange.emit({ deal, stage: stages[idx + 1].id });
    }
  }

  requestDeleteDeal(deal: CrmDeal, event: Event) {
    event.stopPropagation();
    const label = deal.contact?.name ? `${deal.title} (${deal.contact.name})` : deal.title;
    void this.confirmAndDeleteDeal(deal, label);
  }

  private async confirmAndDeleteDeal(deal: CrmDeal, label: string) {
    const ok = await this.toast.confirmDelete(label);
    if (ok) this.dealDelete.emit(deal);
  }

  stopClick(event: Event) { event.stopPropagation(); }
}
