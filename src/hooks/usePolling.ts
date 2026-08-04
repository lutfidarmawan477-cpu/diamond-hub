import { useEffect, useRef } from "react";

/**
 * Keeps data fresh without a page refresh: re-runs `fn` on an interval,
 * and immediately whenever the tab regains focus/visibility.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs = 8000) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    let stopped = false;
    const run = () => {
      if (stopped || document.hidden) return;
      void ref.current();
    };
    const id = setInterval(run, intervalMs);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs]);
}

/** Shared badge styling for member levels. */
export const LEVEL_BADGE: Record<string, string> = {
  bronze: "bg-amber-600/20 text-amber-500 border-amber-600/40",
  silver: "bg-slate-400/20 text-slate-300 border-slate-400/40",
  gold: "bg-gold/20 text-gold border-gold/40",
  diamond: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
};
