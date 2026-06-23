import { Component, input, output, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCar, LucideSearch, LucideUser } from '@lucide/angular';
import { CrmService } from '../../core/api.service';
import { CrmContact } from '../../models';
import { engomadoLabel } from '../../shared/engomado-colors';

@Component({
  selector: 'app-crm-clients-directory',
  standalone: true,
  imports: [FormsModule, LucideSearch, LucideUser, LucideCar],
  templateUrl: './crm-clients-directory.component.html',
  styles: [`
    .dash-card {
      padding: 24px 28px;
      box-sizing: border-box;
    }
    .clients-toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      align-items: flex-end;
    }
    .clients-search { flex: 1; min-width: 220px; }
    .clients-search label {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.45);
    }
    .clients-search .clients-search-field {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #000000 !important;
      border: 1px solid rgba(255,255,255,0.22) !important;
      border-radius: 8px;
      padding: 0 12px;
      min-height: 44px;
      box-sizing: border-box;
    }
    .clients-search .clients-search-field svg {
      color: rgba(255,255,255,0.45);
      flex-shrink: 0;
    }
    .clients-search .clients-search-field input,
    .clients-search input#clients-search-input {
      flex: 1;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      background: #000000 !important;
      background-color: #000000 !important;
      border: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      padding: 10px 0;
      outline: none;
      font-family: var(--f-display);
      font-size: 14px;
      color-scheme: dark;
    }
    .clients-search .clients-search-field input::placeholder,
    .clients-search input#clients-search-input::placeholder {
      color: rgba(255,255,255,0.35) !important;
      opacity: 1;
    }
    .clients-search .clients-search-field input:-webkit-autofill,
    .clients-search input#clients-search-input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 1000px #000000 inset !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
    }
    .deal-outline-btn.clients-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      min-height: 44px;
      background: #111111 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.35) !important;
      border-radius: 8px !important;
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .deal-outline-btn.clients-action-btn:hover {
      background: rgba(255,255,255,0.08) !important;
      border-color: rgba(255,255,255,0.6) !important;
      color: #ffffff !important;
    }
    .clients-table { display: flex; flex-direction: column; gap: 8px; }
    .client-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 0.7fr 1.2fr;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      cursor: pointer;
      text-align: left;
      color: inherit;
      font: inherit;
    }
    .client-row:hover { border-color: rgba(200,169,74,0.35); background: rgba(200,169,74,0.06); }
    @media (max-width: 900px) {
      .client-row { grid-template-columns: 1fr; gap: 6px; }
      .client-row-head { display: none; }
    }
    .client-row-head {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 0.7fr 1.2fr;
      gap: 12px;
      padding: 0 14px 6px;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.4);
    }
    .client-name { font-weight: 600; color: #fff; }
    .client-meta { font-size: 12px; color: rgba(255,255,255,0.65); }
    .client-count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--gold);
    }
  `],
})
export class CrmClientsDirectoryComponent implements OnInit {
  openContact = output<string>();

  clients = signal<CrmContact[]>([]);
  search = signal('');
  isLoading = signal(true);
  readonly engomadoLabel = engomadoLabel;

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.clients();
    if (!q) return list;
    return list.filter(c =>
      c.name?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
      || c.phone?.includes(q)
      || c.plates?.toLowerCase().includes(q)
      || c.residenceState?.toLowerCase().includes(q),
    );
  });

  constructor(private crmService: CrmService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.crmService.getContacts().subscribe({
      next: (rows) => {
        this.clients.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
