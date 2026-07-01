import { Component, OnInit, output, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePlus, LucideUserCheck, LucideTrophy } from '@lucide/angular';
import { CrmService } from '../../core/api.service';
import { PeritoAccount, PeritoOverviewItem, PeritoPerformance } from '../../models';
import { PERITO_STAGE_LABELS } from '../../shared/perito-stages';

@Component({
  selector: 'app-crm-peritos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, LucideUserCheck, LucidePlus, LucideTrophy],
  templateUrl: './crm-peritos.component.html',
  styleUrl: './crm-peritos.component.css',
})
export class CrmPeritosComponent implements OnInit {
  openDeal = output<string>();

  peritos = signal<PeritoAccount[]>([]);
  performance = signal<PeritoPerformance[]>([]);
  overview = signal<PeritoOverviewItem[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  message = signal('');
  form = { name: '', email: '', password: '' };

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
    this.crmService.getPeritoOverview().subscribe({
      next: (o) => this.overview.set(o),
      error: () => {},
    });
  }

  constructor(private crmService: CrmService) {}

  openForm(perito?: PeritoAccount) {
    this.showForm.set(true);
    if (perito) {
      this.editingId.set(perito.id);
      this.form = { name: perito.name, email: perito.email, password: '' };
    } else {
      this.editingId.set(null);
      this.form = { name: '', email: '', password: '' };
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
    const id = this.editingId();
    if (id) {
      const payload: { name?: string; password?: string } = { name: this.form.name.trim() };
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
      if (!this.form.email.trim() || !this.form.password) {
        this.message.set('Faltan datos: email y contraseña requeridos');
        return;
      }
      this.crmService.createPerito({
        name: this.form.name.trim(),
        email: this.form.email.trim(),
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

  medal(i: number) {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
  }

  stageLabel(stage: string) {
    return PERITO_STAGE_LABELS[stage as keyof typeof PERITO_STAGE_LABELS] || stage;
  }

  initials(name: string) {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }
}
