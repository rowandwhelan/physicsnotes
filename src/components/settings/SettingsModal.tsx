"use client";

import Button from "@/components/ui/Button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getPrefs, setPrefs, Prefs, CopyPreset } from "@/lib/prefs";
import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import { Storage } from "@/lib/storage";
import { seedItems } from "@/lib/seed";
import { Import, Download, RefreshCw, ChevronDown } from "lucide-react";

const storage = new Storage();

/* ---------- Hints ---------- */
const presetHints: Record<CopyPreset, string> = {
  plain_compact: "Minimal plain text (single line). Great for terminals and quick pastes.",
  plain_verbose: "Plain text with a little context on multiple lines.",
  latex_inline: "Raw LaTeX string only (no $...$ wrappers).",
  latex_inline_symbol_first: "LaTeX with symbol/name on the left if present (good for constants).",
  markdown_inline: "Markdown with inline $...$ math.",
  markdown_fenced: "Markdown with a fenced ```tex block.",
};

const toggleHints: Record<keyof Prefs["copyToggles"], string> = {
  includeUnits: "If on, constants include units, e.g., m s^-2.",
  includeName: "Include the item name.",
  includeSymbol: "Include the symbol, e.g., g, c, k_B.",
  includeText: "Include the short description/note.",
  includeCategory: "Append the category as a trailing code-style comment.",
  includeSource: "Append the source as a trailing code-style comment.",
};

export default function SettingsModal({
  open,
  onClose,
  onChange,
  onDataChange,
  onRerankModeChange,
  onApplyUsageNow,
}: {
  open: boolean;
  onClose: () => void;
  onChange?: (p: Prefs) => void;
  onDataChange?: () => void;
  onRerankModeChange?: (mode: Prefs["rankingMode"]) => void;
  onApplyUsageNow?: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [prefs, setLocal] = useState<Prefs>(getPrefs());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocal(getPrefs());
      setAdvancedOpen(false);
    }
  }, [open]);

  function update<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    const merged = setPrefs({ [k]: v } as Partial<Prefs>);
    setLocal(merged);
    onChange?.(merged);
  }

  function exportAll() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: storage.getAll(),
      prefs: getPrefs(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "physics-quick-sheet.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (Array.isArray(json)) {
          storage.bulkUpsert(json);
        } else if (json && Array.isArray(json.items)) {
          storage.bulkUpsert(json.items);
          if (json.prefs) setPrefs(json.prefs);
        } else {
          alert("Invalid JSON format.");
          return;
        }
        onDataChange?.();
        setLocal(getPrefs());
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(f);
  }

  function resetToSeed() {
    if (!confirm("Reset to built-in seed? This clears your local additions (but keeps settings).")) return;
    storage.clearAll();
    storage.bulkUpsert(seedItems);
    onDataChange?.();
  }

  function resetLearning() {
    storage.resetLearning?.();
    onDataChange?.();
  }

  return (
    <Modal open={open} onClose={onClose}>
      {/* Top bar pinned */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 sm:px-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="text-sm font-medium">Settings</div>
        <Button onClick={onClose}>Close</Button>
      </div>

      <div className="p-4 sm:p-5">
        <div className="space-y-8">
          {/* Theme */}
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-medium">Theme</h4>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Follow OS or force a theme.
              </span>
            </div>
            <div className="segmented-like">
              <button className="seg-btn" data-selected={theme === "auto"} onClick={() => setTheme("auto")}>
                Auto
              </button>
              <button className="seg-btn" data-selected={theme === "light"} onClick={() => setTheme("light")}>
                Light
              </button>
              <button className="seg-btn" data-selected={theme === "dark"} onClick={() => setTheme("dark")}>
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

            {/* Essential toggles */}
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

            {/* Advanced (custom disclosure) */}
            <div
              className="mt-3 rounded-md border"
              style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
            >
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-sm"
                onClick={() => setAdvancedOpen((s) => !s)}
              >
                <span>Advanced</span>
                <ChevronDown className={advancedOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {advancedOpen && (
                <div className="border-t p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 gap-2">
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
                          onChange={(e) =>
                            update("copyToggles", { ...prefs.copyToggles, [key]: e.currentTarget.checked })
                          }
                        />
                        {labelText}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Tip: Press <span className="kbd">Enter</span> in the search box to copy the top result.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Ranking */}
          <section>
            <h4 className="text-sm font-medium">Ranking</h4>
            <div className="segmented-like">
              <button
                className="seg-btn"
                data-selected={(prefs.rankingMode ?? "rankFirst") === "rankFirst"}
                onClick={() => {
                  update("rankingMode", "rankFirst");
                  onRerankModeChange?.("rankFirst");
                }}
              >
                Explicit order
              </button>
              <button
                className="seg-btn"
                data-selected={prefs.rankingMode === "popularityFirst"}
                onClick={() => {
                  update("rankingMode", "popularityFirst");
                  onRerankModeChange?.("popularityFirst");
                }}
              >
                Popularity-first
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm flex items-center gap-2" title="Half-life in days. Set 0 to disable decay.">
                <span>Decay half-life</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={prefs.rankingHalfLifeDays ?? 30}
                  onChange={(e) => update("rankingHalfLifeDays", Math.max(0, Number(e.currentTarget.value || 0)))}
                  className="w-24 input"
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  days (0 = off)
                </span>
              </label>

              {/* NEW: instant re-rank toggle */}
              <label
                className="text-sm flex items-center gap-2"
                title="Re-order results immediately after each copy. Default is off."
              >
                <input
                  type="checkbox"
                  checked={!!prefs.instantRerankOnCopy}
                  onChange={(e) => update("instantRerankOnCopy", e.currentTarget.checked)}
                />
                Instant re-rank after copy
              </label>

              {/* NEW: manual apply usage now */}
              <Button
                onClick={onApplyUsageNow}
                title="Recompute ranking using current usage without enabling instant re-rank."
              >
                Apply usage now
              </Button>

              <Button onClick={resetLearning} title="Clears learned usage/recency; keeps your items.">
                Reset ranking history
              </Button>
            </div>
          </section>

          {/* KaTeX */}
          <section>
            <h4 className="text-sm font-medium">KaTeX</h4>
            <label
              className="flex items-center gap-2 text-sm mt-2"
              title="Render formulas inline with text using KaTeX. Turn off if you prefer display math per item later."
            >
              <input
                type="checkbox"
                aria-label="Render KaTeX inline"
                checked={prefs.katexInline}
                onChange={(e) => update("katexInline", e.currentTarget.checked)}
              />
              Render inline
            </label>
          </section>

          {/* Data */}
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-medium">Data</h4>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Import/export your items & settings, or restore defaults.
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} title="Import items & settings from a JSON export.">
                <Import className="h-4 w-4" /> Import
              </Button>
              <Button onClick={exportAll} title="Export all items & settings to JSON.">
                <Download className="h-4 w-4" /> Export
              </Button>
              <Button onClick={resetToSeed} title="Reset to the built-in seed (keeps settings).">
                <RefreshCw className="h-4 w-4" /> Reset to seed
              </Button>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          {/* Footer left empty on purpose; Close is pinned in the top bar */}
        </div>
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
