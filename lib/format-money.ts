export function formatMoney(value: number, currency: string | null, maximumFractionDigits = 2) {
  if (!currency) return value.toFixed(maximumFractionDigits);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits }).format(value);
  } catch {
    return `${currency} ${value.toFixed(maximumFractionDigits)}`;
  }
}
