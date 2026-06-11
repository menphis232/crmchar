import { Component, input, output, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CrmService } from '../../core/api.service';
import { CrmContact360 } from '../../models';

@Component({
  selector: 'app-crm-contact-panel',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './crm-contact-panel.component.html',
  styleUrl: './panel-dashboard.css',
})
export class CrmContactPanelComponent {
  contactId = input<string | null>(null);
  stageLabels = input<Record<string, string>>({});

  closed = output<void>();
  openDeal = output<string>();

  data = signal<CrmContact360 | null>(null);

  constructor(private crmService: CrmService) {
    effect(() => {
      const id = this.contactId();
      if (id) this.crmService.getContact(id).subscribe(d => this.data.set(d));
      else this.data.set(null);
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('deal-panel-overlay')) {
      this.closed.emit();
    }
  }
}
