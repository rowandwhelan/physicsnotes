"use client";

import Button from "@/components/ui/Button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getPrefs, setPrefs, Prefs, CopyPreset } from "@/lib/prefs";
import { useEffect, useState } from "react";
import Modal from "../Modal";

const presetHints: Record<CopyPreset, string> = {
  plain_compact: "Minimal plain text (single line). Great for terminals and quick pastes.",
  plain_verbose: "Plain text with more context on multiple lines.",
  latex_inline: "Raw LaTeX string only (no $...$ wrappers). Paste into LaTeX editors/environments.",
  latex_inline_symbol_first: "LaTeX with symbol/name on the left if present (handy for constants).",
  markdown_inline: "Markdown with inline $...$ math. Renders in Notion/GitHub where supported.",
  markdown_fenced: "Markdown with a fenced ```tex code block for the equation.",
};

const toggleHints: Record<keyof Prefs["copyToggles"], string> = {
  includeUnits: "If on, constants include units, e.g., m s^-2.",
  includeName: "Include the item name in the copied output.",
  includeSymbol: "Include the symbol, e.g., g, c, k_B.",
  includeText: "Include the short description/note.",
  includeCategory: "Append the category as a trailing code-style comment.",
  includeSource: "Append the source as a trailing code-style comment.",
};

export default function SettingsModal({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange?: (p: Prefs) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [prefs, setLocal] = useState<Prefs>(getPrefs());

  useEffect(() => setLocal(getPrefs()), [open]);

  function update<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    const merged = setPrefs({ [k]: v } as Partial<Prefs>);
    setLocal(merged);
    onChange?.(merged);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-semibold">Settings</h3>
      <div className="mt-3 space-y-6">
        {/* Theme */}
        <section>
          <h4 className="text-sm font-medium">Theme</h4>
          <div className="mt-2 segmented" role="tablist" aria-label="Theme">
            <button
              className="btn"
              aria-pressed={theme === "auto"}
              onClick={() => setTheme("auto")}
              title="Follow your OS setting and update automatically."
              role="tab"
            >
              Auto
            </button>
            <button
              className="btn"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
              title="Force light theme."
              role="tab"
            >
              Light
            </button>
            <button
              className="btn"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
              title="Force dark theme."
              role="tab"
            >
              Dark
            </button>
          </div>
        </section>

        {/* Copy defaults */}
        <section>
          <h4 className="text-sm font-medium">Default copy preset</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                "plain_compact",
                "plain_verbose",
                "latex_inline",
                "latex_inline_symbol_first",
                "markdown_inline",
                "markdown_fenced",
              ] as CopyPreset[]
            ).map((p) => (
              <button
                key={p}
                className="chip"
                data-selected={prefs.copyPreset === p ? "true" : "false"}
                onClick={() => update("copyPreset", p)}
                title={presetHints[p]}
              >
                {label(p)}
              </button>
            ))}
          </div>

          {/* Essential toggles only */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["includeUnits", "Include units (constants)"],
                ["includeSymbol", "Include symbol"],
                ["includeText", "Include description"],
              ] as [keyof Prefs["copyToggles"], string][]
            ).map(([key, labelText]) => (
              <label key={key} className="flex items-center gap-2 text-sm" title={toggleHints[key]}>
                <input
                  type="checkbox"
                  aria-label={labelText}
                  checked={prefs.copyToggles[key]}
                  onChange={(e) => update("copyToggles", { ...prefs.copyToggles, [key]: e.currentTarget.checked })}
                />
                {labelText}
              </label>
            ))}
          </div>

          {/* Advanced, tucked away */}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm underline">Advanced</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["includeName", "Include name"],
                  ["includeCategory", "Include category (as comment)"],
                  ["includeSource", "Include source (as comment)"],
                ] as [keyof Prefs["copyToggles"], string][]
              ).map(([key, labelText]) => (
                <label key={key} className="flex items-center gap-2 text-sm" title={toggleHints[key]}>
                  <input
                    type="checkbox"
                    aria-label={labelText}
                    checked={prefs.copyToggles[key]}
                    onChange={(e) => update("copyToggles", { ...prefs.copyToggles, [key]: e.currentTarget.checked })}
                  />
                  {labelText}
                </label>
              ))}
            </div>

            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Tip: Press <span className="kbd">Ctrl</span>/<span className="kbd">Cmd</span> +{" "}
              <span className="kbd">Enter</span> in the search box to copy the top result.
            </p>
          </details>
        </section>

        {/* KaTeX */}
        <section>
          <h4 className="text-sm font-medium">KaTeX</h4>
          <label
            className="flex items-center gap-2 text-sm mt-2"
            title="Render formulas inline with text using KaTeX. Turn off if you prefer handling display math per item later."
          >
            <input
              type="checkbox"
              aria-label="Render KaTeX inline"
              checked={prefs.katexInline}
              onChange={(e) => update("katexInline", e.currentTarget.checked)}
            />
            Render inline
          </label>
          <p className="text-xs text-[var(--muted)]">
            We will use inline mode; switch off later if you want display math per-item.
          </p>
        </section>
      </div>

      <div className="mt-6 flex gap-2 justify-between items-center">
        <a href="/docs" className="text-xs underline">
          Open documentation
        </a>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

function label(p: CopyPreset) {
  const map: Record<CopyPreset, string> = {
    plain_compact: "Plain (compact)",
    plain_verbose: "Plain (verbose)",
    latex_inline: "LaTeX (inline)",
    latex_inline_symbol_first: "LaTeX (symbol first)",
    markdown_inline: "Markdown (inline)",
    markdown_fenced: "Markdown (fenced)",
  };
  return map[p];
}
