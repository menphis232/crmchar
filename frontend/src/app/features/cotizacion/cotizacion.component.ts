import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

type CatalogItem = { clave: string; nombre: string };

@Component({
  selector: 'app-cotizacion',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './cotizacion.component.html',
  styleUrl: './cotizacion.component.css',
})
export class CotizacionComponent implements OnInit {
  private readonly base = `${environment.apiUrl}/libroazul`;

  step = signal<1 | 2>(1);
  loading = signal(false);
  error = signal<string | null>(null);
  configured = signal(true);

  anios = signal<CatalogItem[]>([]);
  marcas = signal<CatalogItem[]>([]);
  modelos = signal<CatalogItem[]>([]);
  versiones = signal<CatalogItem[]>([]);

  claveAnio = '';
  claveMarca = '';
  claveModelo = '';
  claveVersion = '';
  kilometraje: number | null = null;

  anioNombre = '';
  marcaNombre = '';
  modeloNombre = '';
  versionNombre = '';

  precio = signal<{ venta: string | null; compra: string | null; moneda: string } | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<{ configured: boolean }>(`${this.base}/status`).subscribe({
      next: (s) => {
        this.configured.set(!!s.configured);
        if (s.configured) this.loadAnios();
        else this.error.set('Libro Azul aún no está configurado en el servidor (faltan credenciales API).');
      },
      error: () => {
        this.configured.set(false);
        this.error.set('No se pudo verificar el servicio de cotización.');
      },
    });
  }

  private loadAnios() {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ items: CatalogItem[] }>(`${this.base}/anios`).subscribe({
      next: (res) => {
        this.anios.set(res.items || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudieron cargar los años.');
        this.loading.set(false);
      },
    });
  }

  onAnioChange() {
    this.claveMarca = '';
    this.claveModelo = '';
    this.marcas.set([]);
    this.modelos.set([]);
    this.anioNombre = this.anios().find(a => a.clave === this.claveAnio)?.nombre || '';
    if (!this.claveAnio) return;
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ items: CatalogItem[] }>(`${this.base}/marcas`, {
      params: { claveAnio: this.claveAnio },
    }).subscribe({
      next: (res) => {
        this.marcas.set(res.items || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudieron cargar las marcas.');
        this.loading.set(false);
      },
    });
  }

  onMarcaChange() {
    this.claveModelo = '';
    this.modelos.set([]);
    this.marcaNombre = this.marcas().find(m => m.clave === this.claveMarca)?.nombre || '';
    if (!this.claveAnio || !this.claveMarca) return;
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ items: CatalogItem[] }>(`${this.base}/modelos`, {
      params: { claveAnio: this.claveAnio, claveMarca: this.claveMarca },
    }).subscribe({
      next: (res) => {
        this.modelos.set(res.items || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudieron cargar los modelos.');
        this.loading.set(false);
      },
    });
  }

  onModeloChange() {
    this.modeloNombre = this.modelos().find(m => m.clave === this.claveModelo)?.nombre || '';
  }

  /** Paso 1 → Paso 2 (versiones), como en libroazul.com */
  goToVersiones() {
    if (!this.claveAnio || !this.claveMarca || !this.claveModelo) {
      this.error.set('Selecciona año, marca y modelo.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.precio.set(null);
    this.claveVersion = '';
    this.http.get<{ items: CatalogItem[] }>(`${this.base}/versiones`, {
      params: {
        claveAnio: this.claveAnio,
        claveMarca: this.claveMarca,
        claveModelo: this.claveModelo,
      },
    }).subscribe({
      next: (res) => {
        this.versiones.set(res.items || []);
        this.step.set(2);
        this.loading.set(false);
        if (!res.items?.length) {
          this.error.set('No hay versiones para esa combinación.');
        }
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudieron cargar las versiones.');
        this.loading.set(false);
      },
    });
  }

  backToStep1() {
    this.step.set(1);
    this.precio.set(null);
    this.claveVersion = '';
    this.error.set(null);
  }

  onVersionChange() {
    this.versionNombre = this.versiones().find(v => v.clave === this.claveVersion)?.nombre || '';
    this.precio.set(null);
  }

  consultarPrecio() {
    if (!this.claveVersion) {
      this.error.set('Selecciona la versión del vehículo.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ venta: string | null; compra: string | null; moneda: string }>(`${this.base}/precio`, {
      params: {
        claveVersion: this.claveVersion,
        kilometraje: String(this.kilometraje ?? 0),
      },
    }).subscribe({
      next: (res) => {
        this.precio.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudo obtener el precio.');
        this.loading.set(false);
      },
    });
  }

  asNumber(val: string | null | undefined): number | null {
    if (val == null || val === '') return null;
    const n = Number(String(val).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
}
