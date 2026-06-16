export function hasSpecialPrice(auto: { price: number; specialPrice?: number | null }): boolean {
  return auto.specialPrice != null && auto.specialPrice > 0 && auto.specialPrice < auto.price;
}

export function effectivePrice(auto: { price: number; specialPrice?: number | null }): number {
  return hasSpecialPrice(auto) ? auto.specialPrice! : auto.price;
}
