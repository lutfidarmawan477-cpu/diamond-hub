// Dynamic payment fee: scales with the number of diamonds purchased,
// clamped inside a per-method-type range.
const FEE_RANGES: Record<string, [number, number]> = {
  qris: [100, 2000],
  ewallet: [200, 3500],
  va: [1500, 5000],
  bank: [1500, 5000],
};

const MAX_DIAMONDS = 5000;

export function feeRange(type: string): [number, number] {
  return FEE_RANGES[type] ?? [500, 2500];
}

export function computeFee(type: string, diamonds: number): number {
  const [min, max] = feeRange(type);
  const d = Math.max(0, diamonds || 0);
  // logarithmic scaling keeps small packages cheap while staying monotonic
  const ratio = Math.min(1, Math.log10(1 + d) / Math.log10(1 + MAX_DIAMONDS));
  const raw = min + (max - min) * ratio;
  return Math.round(raw / 50) * 50;
}
