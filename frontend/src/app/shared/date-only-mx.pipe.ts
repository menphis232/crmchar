import { Pipe, PipeTransform } from '@angular/core';
import { formatDateOnlyMx } from './date-only.util';

/** Fechas calendario (sin hora) en DD/MM/AAAA, sin desfase UTC. */
@Pipe({ name: 'dateOnlyMx', standalone: true })
export class DateOnlyMxPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return formatDateOnlyMx(value);
  }
}
