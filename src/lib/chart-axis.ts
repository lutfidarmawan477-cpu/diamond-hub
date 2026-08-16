import { useEffect, useState } from "react";
import type { Period } from "@/lib/period";

/** Tracks a coarse breakpoint so charts can thin out their X labels on small screens. */
export function useChartWidth() {
  const [w, setW] = useState<number>(1280);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

/**
 * X-axis label density for a period. Desktop shows every label; tablet/mobile
 * show a readable subset (data itself is untouched).
 */
export function useAxisProps(period: Period) {
  const width = useChartWidth();
  const desktop = width >= 1024;
  const tablet = width >= 640;

  let interval: number = 0;
  if (!desktop) {
    if (period === "today") interval = tablet ? 3 : 4; // 00:00, 04:00 … / 00:00, 05:00 …
    else if (period === "month") interval = tablet ? 3 : 4; // 1, 5, 10 …
    else if (period === "year") interval = tablet ? 1 : 2;
    else interval = 0;
  }

  return {
    interval,
    tick: { fontSize: desktop ? 11 : 10, fill: "var(--muted-foreground)" },
    angle: desktop && (period === "today" || period === "month") ? -45 : 0,
    height: desktop && (period === "today" || period === "month") ? 48 : 24,
    minTickGap: desktop ? 0 : 6,
  };
}
