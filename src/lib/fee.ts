// Dynamic payment fee: a consistent percentage of the order value,
// clamped inside a per-method-type range.
const FEE_RANGES: Record<string, [number, number]> = {
  qris: [100, 2000],
  ewallet: [200, 3500],
  va: [1500, 5000],
  bank: [1500, 5000],
};

const FEE_PERCENT: Record<string, number> = {
  qris: 0.007,
  ewallet: 0.012,
  va: 0.02,
  bank: 0.02,
};

/** Virtual Account / bank transfer is only available above this order value. */
export const VA_MIN_AMOUNT = 50_000;

export function feeRange(type: string): [number, number] {
  return FEE_RANGES[type] ?? [500, 2500];
}

/**
 * Fee is derived from the order amount (package price in IDR) so it is
 * always consistent: same price -> same fee, higher price -> higher fee.
 */
export function computeFee(type: string, amount: number): number {
  const [min, max] = feeRange(type);
  const a = Math.max(0, amount || 0);
  if (a === 0) return 0;
  const pct = FEE_PERCENT[type] ?? 0.015;
  const raw = Math.min(max, Math.max(min, a * pct));
  return Math.round(raw / 50) * 50;
}
