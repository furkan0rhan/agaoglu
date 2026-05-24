import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'stockStatus', standalone: true })
export class StockStatusPipe implements PipeTransform {
  transform(stock: number, minStock: number): 'critical' | 'low' | 'ok' {
    if (stock === 0) return 'critical';
    if (stock <= minStock) return 'low';
    return 'ok';
  }
}
