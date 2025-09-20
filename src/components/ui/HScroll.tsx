"use client";
import { useEffect, useRef } from "react";

export default function HScroll({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const targetLeft = useRef(0);
  const rafId = useRef<number | null>(null);

  // smooth animate towards targetLeft
  const step = () => {
    const el = ref.current;
    if (!el) return;
    const cur = el.scrollLeft;
    const tgt = targetLeft.current;
    const delta = (tgt - cur) * 0.2; // easing factor
    if (Math.abs(delta) < 0.5) {
      el.scrollLeft = tgt;
      rafId.current = null;
      return;
    }
    el.scrollLeft = cur + delta;
    rafId.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll
      const before = el.scrollLeft;
      targetLeft.current = clamp(
        el.scrollLeft + e.deltaY, // convert vertical wheel to horizontal
        0,
        el.scrollWidth - el.clientWidth
      );
      if (rafId.current == null) rafId.current = requestAnimationFrame(step);

      // if we actually have horizontal room, consume the event so page doesn't scroll
      if (before !== targetLeft.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        overscrollBehaviorX: "contain",
        scrollbarGutter: "stable",
        touchAction: "pan-x",
      }}
    >
      {children}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
