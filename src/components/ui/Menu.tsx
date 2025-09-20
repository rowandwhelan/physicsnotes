"use client";
import { useEffect, useRef, useState } from "react";

export default function Menu({
  button,
  children,
  align = "end",
}: {
  button: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Esc to close and refocus trigger
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        // Let the caller style the visual; we just render their node inside
        className="contents"
      >
        {/* The caller passes a fully-styled Button as `button` */}
        {button}
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 min-w-[200px] rounded-md border p-1"
          style={{
            right: align === "end" ? 0 : undefined,
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            outline: "1px solid var(--ring)",
          }}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}
