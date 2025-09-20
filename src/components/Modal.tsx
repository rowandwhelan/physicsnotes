"use client";

import { useEffect, useRef } from "react";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const { documentElement, body } = document;
    const prevHtml = documentElement.style.overflow;
    const prevBody = body.style.overflow;
    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      documentElement.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      // Prevent scroll chaining beyond overlay
      style={{ overscrollBehavior: "contain" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Prevent wheel/touch bubbling to page (edge cases)
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-2xl rounded-lg border shadow-lg"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          maxHeight: "min(85vh, 680px)",
          overflowY: "auto",
          // Prevent scroll chaining on the scrollable panel itself
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </div>
  );
}
