"use client";
import { useEffect, useRef, useCallback } from "react";

export default function HScroll({
  className = "",
  children,
  ariaLabel = "Horizontal list",
  stepPx = 80,
}: {
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  stepPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const targetLeft = useRef(0);
  const rafId = useRef<number | null>(null);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  // smooth animate towards targetLeft
  const step = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cur = el.scrollLeft;
    const tgt = targetLeft.current;
    const delta = (tgt - cur) * 0.2; // easing
    if (Math.abs(delta) < 0.5) {
      el.scrollLeft = tgt;
      rafId.current = null;
      return;
    }
    el.scrollLeft = cur + delta;
    rafId.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll

      // Prefer horizontal deltas when present (trackpads), otherwise map vertical to horizontal
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // Normalize for deltaMode "lines" vs "pixels"
      const unit = e.deltaMode === 1 ? 16 : 1; // ~16px per line (heuristic)
      const delta = raw * unit;

      const before = el.scrollLeft;
      targetLeft.current = clamp(el.scrollLeft + delta, 0, el.scrollWidth - el.clientWidth);
      if (rafId.current == null) rafId.current = requestAnimationFrame(step);

      // if we actually moved, consume so the page doesn't scroll
      if (before !== targetLeft.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Allow keyboard scrolling when the container is focused
      if (document.activeElement !== el) return;
      if (el.scrollWidth <= el.clientWidth) return;

      let delta = 0;
      if (e.key === "ArrowRight") delta = stepPx;
      else if (e.key === "ArrowLeft") delta = -stepPx;
      else if (e.key === "Home") targetLeft.current = 0;
      else if (e.key === "End") targetLeft.current = el.scrollWidth - el.clientWidth;

      if (delta !== 0) {
        targetLeft.current = clamp(el.scrollLeft + delta, 0, el.scrollWidth - el.clientWidth);
      }

      if (delta !== 0 || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        if (rafId.current == null) rafId.current = requestAnimationFrame(step);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKey);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [step, stepPx]);

  return (
    <div
      ref={ref}
      className={className}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      style={{
        overscrollBehaviorX: "contain",
        scrollbarGutter: "stable",
        touchAction: "pan-x",
        outline: "none",
      }}
    >
      {children}
    </div>
  );
}
