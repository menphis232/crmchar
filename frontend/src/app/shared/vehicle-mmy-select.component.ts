import { Component, model, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getVehicleMakes, getVehicleModels, getVehicleYears } from './mexico-vehicle-catalog';

@Component({
  selector: 'app-vehicle-mmy-select',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mmy-grid">
      <div>
        <label>Marca</label>
        <select [ngModel]="make()" (ngModelChange)="onMakeChange($event)">
          <option value="">— Selecciona marca —</option>
          @for (m of makes; track m) {
            <option [value]="m">{{ m }}</option>
          }
        </select>
      </div>
      <div>
        <label>Submarca</label>
        <select [ngModel]="submodel()" (ngModelChange)="onModelChange($event)" [disabled]="!make()">
          <option value="">— Selecciona submarca —</option>
          @for (sm of models(); track sm) {
            <option [value]="sm">{{ sm }}</option>
          }
        </select>
      </div>
      <div>
        <label>Año</label>
        <select [ngModel]="year()" (ngModelChange)="year.set($event ? +$event : null)" [disabled]="!submodel()">
          <option [ngValue]="null">— Selecciona año —</option>
          @for (y of years; track y) {
            <option [ngValue]="y">{{ y }}</option>
          }
        </select>
      </div>
    </div>
  `,
  styles: [`
    .mmy-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    @media (max-width: 720px) {
      .mmy-grid { grid-template-columns: 1fr; }
    }
    label {
      display: block;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: rgba(255,255,255,0.45);
    }
    select {
      width: 100%;
      box-sizing: border-box;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-color: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 10px 34px 10px 12px;
      color: #fff;
      font-size: 14px;
      line-height: 1.2;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8a94a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    select:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.3);
    }
    select:focus {
      outline: none;
      border-color: var(--gold, #c8a94a);
      background-color: rgba(255, 255, 255, 0.08);
    }
    select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    select option {
      background-color: #1a1a1a;
      color: #fff;
    }
    :host-context(.client-vehicle-form) label {
      color: rgba(255,255,255,0.55);
    }
  `],
})
export class VehicleMmySelectComponent {
  make = model<string>('');
  submodel = model<string>('');
  year = model<number | null>(null);

  readonly makes = getVehicleMakes();
  readonly years = getVehicleYears();

  models = computed(() => getVehicleModels(this.make()));

  constructor() {
    effect(() => {
      const mk = this.make();
      const sm = this.submodel();
      if (sm && mk && !getVehicleModels(mk).includes(sm)) {
        this.submodel.set('');
        this.year.set(null);
      }
    });
  }

  onMakeChange(value: string) {
    this.make.set(value);
    this.submodel.set('');
    this.year.set(null);
  }

  onModelChange(value: string) {
    this.submodel.set(value);
    this.year.set(null);
  }
}
