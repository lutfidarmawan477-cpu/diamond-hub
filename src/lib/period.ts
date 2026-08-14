export type Period = "today" | "week" | "month" | "year" | "all";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

/** Start of the selected period (null = all time). */
export function periodStart(p: Period, now = new Date()): Date | null {
  const d = new Date(now);
  if (p === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === "week") {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (p === "year") return new Date(d.getFullYear(), 0, 1);
  return null;
}

export function inPeriod(iso: string, p: Period, now = new Date()): boolean {
  const start = periodStart(p, now);
  if (!start) return true;
  return new Date(iso).getTime() >= start.getTime();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Ordered chart buckets for a period plus a mapper from a date to its bucket.
 * `dates` is only used for All Time, where the range depends on the data.
 */
export function periodBuckets(p: Period, dates: string[] = [], now = new Date()) {
  if (p === "today") {
    const keys = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
    return { keys, keyOf: (d: Date) => `${String(d.getHours()).padStart(2, "0")}:00` };
  }
  if (p === "week") {
    const start = periodStart("week", now)!;
    const keys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    return { keys, keyOf: (d: Date) => `${d.getDate()}/${d.getMonth() + 1}` };
  }
  if (p === "month") {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const keys = Array.from({ length: days }, (_, i) => String(i + 1));
    return { keys, keyOf: (d: Date) => String(d.getDate()) };
  }
  if (p === "year") {
    return { keys: [...MONTHS], keyOf: (d: Date) => MONTHS[d.getMonth()] };
  }
  const years = dates.map((s) => new Date(s).getFullYear()).filter((y) => Number.isFinite(y));
  const thisYear = now.getFullYear();
  const min = years.length ? Math.min(...years, thisYear) : thisYear;
  const keys = Array.from({ length: thisYear - min + 1 }, (_, i) => String(min + i));
  return { keys, keyOf: (d: Date) => String(d.getFullYear()) };
}
