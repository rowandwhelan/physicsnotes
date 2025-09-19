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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{button}</div>
      {open && (
        <div
          className="absolute z-20 mt-2 min-w-[200px] rounded-md border p-1"
          style={{
            right: align === "end" ? 0 : undefined,
            background: "var(--card)",
            borderColor: "var(--border)",
            // Strong, legible edge in both themes:
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
