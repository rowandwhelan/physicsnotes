"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * Usage:
 * <Menu button={<Button>More</Button>}>
 *   <button role="menuitem">Item A</button>
 * </Menu>
 */
export default function Menu({
  button,
  children,
  align = "end",
}: {
  button: React.ReactElement; // must be a valid element (e.g., your <Button/>)
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastActive = useRef<HTMLElement | null>(null);

  // Toggle open while preserving any onClick the caller attached
  const trigger = React.isValidElement(button)
    ? React.cloneElement(button as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>, {
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          (button.props as { onClick?: (ev: React.MouseEvent) => void }).onClick?.(e);
          if (!open) lastActive.current = document.activeElement as HTMLElement | null;
          setOpen((o) => !o);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })
    : button;

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

  // Esc to close + restore focus without injecting a ref into the trigger
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        // Restore focus to whatever was focused before opening
        lastActive.current?.focus?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger}
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
