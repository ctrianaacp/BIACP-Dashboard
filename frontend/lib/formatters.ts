/**
 * Utilidades de formateo siguiendo el estándar colombiano (es-CO)
 * Miles: punto (.)
 * Decimales: coma (,)
 */

export function formatNum(v: any, decimals: number = 0): string {
  const num = Number(v);
  if (v === undefined || v === null || isNaN(num)) return "0";
  
  // Implementación manual para asegurar puntos en miles y comas en decimales
  // independiente del soporte de locale del navegador/sistema.
  const parts = num.toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}

export function formatCurrency(v: number, abbreviated: boolean = false): string {
  if (v === undefined || v === null || isNaN(v)) return "$0";
  
  if (!abbreviated) {
    return "$" + formatNum(v, 0);
  }

  const absV = Math.abs(v);
  if (absV >= 1_000_000_000_000) return "$" + formatNum(v / 1_000_000_000_000, 1) + "T";
  if (absV >= 1_000_000_000) return "$" + formatNum(v / 1_000_000_000, 1) + "B";
  if (absV >= 1_000_000) return "$" + formatNum(v / 1_000_000, 1) + "M";
  if (absV >= 1_000) return "$" + formatNum(v / 1_000, 0) + "K";
  
  return "$" + formatNum(v, 0);
}

export function formatAbbr(v: number, decimals: number = 1): string {
  if (v === undefined || v === null || isNaN(v)) return "0";
  const absV = Math.abs(v);
  if (absV >= 1_000_000) return formatNum(v / 1_000_000, decimals) + "M";
  if (absV >= 1_000) return formatNum(v / 1_000, decimals) + "K";
  return formatNum(v, 0);
}
