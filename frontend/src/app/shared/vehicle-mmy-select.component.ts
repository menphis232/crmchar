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
