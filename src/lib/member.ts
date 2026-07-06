export type MemberLevel = "bronze" | "silver" | "gold" | "diamond";

export const LEVEL_THRESHOLDS: Record<MemberLevel, number> = {
  bronze: 0,
  silver: 100_000,
  gold: 500_000,
  diamond: 1_000_000,
};

export const LEVEL_ORDER: MemberLevel[] = ["bronze", "silver", "gold", "diamond"];

export const LEVEL_META: Record<MemberLevel, { icon: string; label: string; color: string }> = {
  bronze: { icon: "🥉", label: "Bronze", color: "text-amber-600" },
  silver: { icon: "🥈", label: "Silver", color: "text-slate-300" },
  gold: { icon: "🥇", label: "Gold", color: "text-gold" },
  diamond: { icon: "💎", label: "Diamond", color: "text-cyan-300" },
};

export function computeLevel(totalSpent: number): MemberLevel {
  if (totalSpent >= LEVEL_THRESHOLDS.diamond) return "diamond";
  if (totalSpent >= LEVEL_THRESHOLDS.gold) return "gold";
  if (totalSpent >= LEVEL_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function nextLevelInfo(level: MemberLevel, totalSpent: number) {
  const idx = LEVEL_ORDER.indexOf(level);
  const next = LEVEL_ORDER[idx + 1];
  if (!next) return null;
  const target = LEVEL_THRESHOLDS[next];
  const prev = LEVEL_THRESHOLDS[level];
  const progress = Math.min(100, Math.round(((totalSpent - prev) / (target - prev)) * 100));
  return { next, target, progress, remaining: Math.max(0, target - totalSpent) };
}
