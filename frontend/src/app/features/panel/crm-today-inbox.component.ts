import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CrmDeal, CrmTask, CrmTodayInbox } from '../../models';

@Component({
  selector: 'app-crm-today-inbox',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './crm-today-inbox.component.html',
  styleUrl: './panel-dashboard.css',
})
export class CrmTodayInboxComponent {
  inbox = input.required<CrmTodayInbox>();
  stageLabels = input<Record<string, string>>({});

  openDeal = output<CrmDeal>();
  openTaskDeal = output<string>();

  hasItems() {
    const i = this.inbox();
    return i.overdueTasks.length + i.todayTasks.length + i.stalledDeals.length + i.uncontactedDeals.length > 0;
  }
}
