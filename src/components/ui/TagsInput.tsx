"use client";
import { X } from "lucide-react";
import { useRef, useState } from "react";

export default function TagsInput({
  value,
  onChange,
  placeholder = "kinematics, acceleration, projectile",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function commit(str: string) {
    const parts = str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = Array.from(new Set([...value, ...parts]));
    onChange(next);
    setDraft("");
    ref.current?.focus();
  }

  return (
    <div className="input flex flex-wrap gap-1">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          style={{ background: "var(--muted-surface)" }}
        >
          {t}
          <button
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="rounded p-0.5 hover:[background:var(--elevated-hover)]"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        className="flex-1 bg-transparent outline-none"
        placeholder={value.length ? "" : placeholder}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={() => draft && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
