import { Component, OnInit, output, signal, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { CrmService, UploadService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PeritoAccount, PeritoOverviewItem, PeritoPerformance } from '../../models';
import { PERITO_STAGE_LABELS } from '../../shared/perito-stages';

@Component({
  selector: 'app-crm-peritos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, LucidePlus],
  templateUrl: './crm-peritos.component.html',
  styleUrl: './crm-peritos.component.css',
})
export class CrmPeritosComponent implements OnInit {
  openDeal = output<string>();

  private crmService = inject(CrmService);
  private uploadService = inject(UploadService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  peritos = signal<PeritoAccount[]>([]);
  performance = signal<PeritoPerformance[]>([]);
  overview = signal<PeritoOverviewItem[]>([]);
  overviewTab = signal<'pendiente' | 'pagado'>('pendiente');
  overviewPage = signal(1);
  overviewPages = signal(1);
  overviewTotal = signal(0);
  overviewTotals = signal({ pendiente: 0, pagado: 0 });
  overviewLoading = signal(false);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  message = signal('');
  impersonatingId = signal<string | null>(null);
  markingPaidId = signal<string | null>(null);
  payModalItem = signal<PeritoOverviewItem | null>(null);
  payReceiptFile: File | null = null;
  payUploading = signal(false);
  form = { name: '', phone: '', password: '' };

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.crmService.getPeritos().subscribe({
      next: (p) => this.peritos.set(p),
      error: () => {},
    });
    this.crmService.getPeritoPerformance().subscribe({
      next: (p) => this.performance.set(p),
      error: () => {},
    });
    this.loadOverview();
  }

  loadOverview() {
    this.overviewLoading.set(true);
    this.crmService.getPeritoOverview({
      status: this.overviewTab(),
      page: this.overviewPage(),
      limit: 15,
    }).subscribe({
      next: (res) => {
        this.overview.set(res.items || []);
        this.overviewTotals.set(res.totals || { pendiente: 0, pagado: 0 });
        this.overviewTotal.set(res.total || 0);
        this.overviewPages.set(res.pages || 1);
        this.overviewPage.set(res.page || 1);
        this.overviewLoading.set(false);
      },
      error: () => {
        this.overview.set([]);
        this.overviewLoading.set(false);
      },
    });
  }

  setOverviewTab(tab: 'pendiente' | 'pagado') {
    if (this.overviewTab() === tab) return;
    this.overviewTab.set(tab);
    this.overviewPage.set(1);
    this.loadOverview();
  }

  setOverviewPage(page: number) {
    const next = Math.min(Math.max(1, page), this.overviewPages());
    if (next === this.overviewPage()) return;
    this.overviewPage.set(next);
    this.loadOverview();
  }

  overviewRangeLabel(): string {
    const total = this.overviewTotal();
    if (!total) return '0 trámites';
    const page = this.overviewPage();
    const limit = 15;
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    return `${from}–${to} de ${total}`;
  }

  openPayModal(item: PeritoOverviewItem, event: Event) {
    event.stopPropagation();
    if (item.peritoServicePaid === 'pagado' || this.markingPaidId()) return;
    this.payReceiptFile = null;
    this.payModalItem.set(item);
  }

  closePayModal() {
    if (this.payUploading() || this.markingPaidId()) return;
    this.payModalItem.set(null);
    this.payReceiptFile = null;
  }

  onPayReceiptSelected(input: HTMLInputElement) {
    this.payReceiptFile = input.files?.[0] || null;
  }

  confirmMarkPaid() {
    const item = this.payModalItem();
    if (!item || this.markingPaidId()) return;
    const file = this.payReceiptFile;
    if (file) {
      this.payUploading.set(true);
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      const upload$ = isPdf
        ? this.uploadService.uploadDocument(file)
        : this.uploadService.uploadFile(file);
      upload$.subscribe({
        next: (res) => {
          this.payUploading.set(false);
          this.doMarkPaid(item.id, {
            receiptUrl: res.url,
            receiptName: file.name,
          });
        },
        error: () => {
          this.payUploading.set(false);
          this.toast.error('No se pudo subir el comprobante');
        },
      });
      return;
    }
    this.doMarkPaid(item.id);
  }

  private doMarkPaid(dealId: string, data?: { receiptUrl?: string; receiptName?: string }) {
    this.markingPaidId.set(dealId);
    this.crmService.markPeritoServicePaid(dealId, data).subscribe({
      next: () => {
        this.markingPaidId.set(null);
        this.payModalItem.set(null);
        this.payReceiptFile = null;
        this.toast.success('Marcado como pagado');
        this.loadOverview();
      },
      error: (err) => {
        this.markingPaidId.set(null);
        this.toast.error(err?.error?.error || 'No se pudo marcar como pagado');
      },
    });
  }

  openForm(perito?: PeritoAccount) {
    this.showForm.set(true);
    if (perito) {
      this.editingId.set(perito.id);
      this.form = { name: perito.name, phone: perito.phone || '', password: '' };
    } else {
      this.editingId.set(null);
      this.form = { name: '', phone: '', password: '' };
    }
    this.message.set('');
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
    if (!this.form.name.trim()) {
      this.message.set('Faltan datos: nombre requerido');
      return;
    }
    const phone = this.form.phone.replace(/\D/g, '');
    if (phone && phone.length !== 10) {
      this.message.set('Faltan datos: el teléfono debe tener 10 dígitos');
      return;
    }
    if (this.form.password && this.form.password.length < 6) {
      this.message.set('Faltan datos: la contraseña debe tener al menos 6 caracteres');
      return;
    }
    const id = this.editingId();
    if (id) {
      const payload: { name?: string; phone?: string; password?: string } = { name: this.form.name.trim() };
      if (phone) payload.phone = phone;
      if (this.form.password) payload.password = this.form.password;
      this.crmService.updatePerito(id, payload).subscribe({
        next: () => {
          this.message.set('Perito actualizado');
          this.closeForm();
          this.reload();
        },
        error: (e) => this.message.set(e.error?.error || 'Error al actualizar'),
      });
    } else {
      if (!phone || !this.form.password) {
        this.message.set('Faltan datos: teléfono y contraseña requeridos');
        return;
      }
      this.crmService.createPerito({
        name: this.form.name.trim(),
        phone,
        password: this.form.password,
      }).subscribe({
        next: () => {
          this.message.set('Perito creado');
          this.closeForm();
          this.reload();
        },
        error: (e) => this.message.set(e.error?.error || 'Error al crear perito'),
      });
    }
  }

  remove(perito: PeritoAccount) {
    if (!confirm(`¿Eliminar a ${perito.name}? Se quitará la asignación de sus trámites.`)) return;
    this.crmService.deletePerito(perito.id).subscribe({
      next: () => {
        this.message.set('Perito eliminado');
        this.reload();
      },
      error: (e) => this.message.set(e.error?.error || 'Error al eliminar'),
    });
  }

  enterPeritoPanel(perito: PeritoAccount) {
    if (!perito?.id || this.impersonatingId()) return;
    this.impersonatingId.set(perito.id);
    this.crmService.impersonatePerito(perito.id).subscribe({
      next: (res) => {
        this.impersonatingId.set(null);
        this.auth.startImpersonation(res.token, res.user);
      },
      error: (err) => {
        this.impersonatingId.set(null);
        this.toast.error(err?.error?.error || 'No se pudo abrir el panel del perito');
      },
    });
  }

  formatLastSeen(value: string | null | undefined): string {
    if (!value) return 'Nunca';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Nunca';
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  stageLabel(stage: string) {
    return PERITO_STAGE_LABELS[stage as keyof typeof PERITO_STAGE_LABELS] || stage;
  }

  initials(name: string) {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }
}
