"use client";

import Button from "@/components/ui/Button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getPrefs, setPrefs, Prefs, CopyPreset, resetPrefs } from "@/lib/prefs";
import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import { Storage } from "@/lib/storage";
import { seedItems } from "@/lib/seed";
import { Import, Download, RefreshCw, ChevronDown } from "lucide-react";
import type { Item } from "@/lib/types";

const storage = new Storage();

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
}: {
  open: boolean;
  onClose: () => void;
  onChange?: (p: Prefs) => void;
  onDataChange?: () => void;
  onRerankModeChange?: (mode: Prefs["rankingMode"]) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [prefs, setLocal] = useState<Prefs>(getPrefs());
  const [advOpen, setAdvOpen] = useState(true); // open by default for now
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocal(getPrefs());
      setAdvOpen(true);
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

  type ImportShape = Item[] | { items: Item[]; prefs?: Prefs };

  function isItem(x: unknown): x is Item {
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return typeof o.id === "string" && (o.kind === "constant" || o.kind === "equation") && typeof o.name === "string";
  }

  function onImportFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ImportShape;
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        if (!Array.isArray(items)) throw new Error("Invalid shape");

        const good = items.filter(isItem);
        if (good.length === 0) throw new Error("No valid items");

        storage.bulkUpsert(good);
        if (!Array.isArray(parsed) && parsed.prefs) setPrefs(parsed.prefs);

        onDataChange?.();
        setLocal(getPrefs());
        alert(`Imported ${good.length} item(s).`);
      } catch (e) {
        alert("Invalid JSON: " + (e as Error).message);
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

  function resetAllSettings() {
    if (!confirm("Reset settings to default? This will not delete your items.")) return;
    const d = resetPrefs();
    setLocal(d);
    onChange?.(d);
  }

  return (
    <Modal open={open} onClose={onClose}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 sm:px-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="text-sm font-medium">Settings</div>
        <Button onClick={onClose}>Close</Button>
      </div>

      <div className="p-4 sm:p-5 space-y-8">
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

        {/* Ranking MODE (moved out of Advanced) */}
        <section>
          <h4 className="text-sm font-medium">Ranking mode</h4>
          <div className="mt-2 segmented-like">
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
        </section>

        {/* Shortcuts tip */}
        <div className="text-xs text-[var(--muted)]">
          Tip: Press <span className="kbd">Ctrl</span>/<span className="kbd">Cmd</span> + <span className="kbd">K</span>{" "}
          to jump to search; <span className="kbd">Enter</span> copies the top match.
        </div>

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

          {/* Essentials */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["includeUnits", "Include units (constants)"],
                ["includeSymbol", "Include symbol"],
                ["includeText", "Include description"],
              ] as Array<[keyof Prefs["copyToggles"], string]>
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm" title={toggleHints[key]}>
                <input
                  type="checkbox"
                  checked={prefs.copyToggles[key]}
                  onChange={(e) => update("copyToggles", { ...prefs.copyToggles, [key]: e.currentTarget.checked })}
                />
                {label.replace(/^If on, /, "").replace(/\.$/, "")}
              </label>
            ))}
          </div>
        </section>

        {/* One Advanced section */}
        <section>
          <div
            className="mt-3 rounded-md border"
            style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
          >
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-sm"
              onClick={() => setAdvOpen((s) => !s)}
            >
              <span>Advanced</span>
              <ChevronDown className={advOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>

            {advOpen && (
              <div className="border-t p-3 space-y-6" style={{ borderColor: "var(--border)" }}>
                {/* Advanced copy */}
                <div>
                  <h5 className="text-sm font-medium">Copy options</h5>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["includeName", "Include name"],
                        ["includeCategory", "Include category (as comment)"],
                        ["includeSource", "Include source (as comment)"],
                      ] as Array<[keyof Prefs["copyToggles"], string]>
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm" title={toggleHints[key]}>
                        <input
                          type="checkbox"
                          checked={prefs.copyToggles[key]}
                          onChange={(e) =>
                            update("copyToggles", { ...prefs.copyToggles, [key]: e.currentTarget.checked })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label
                    className="mt-2 flex items-center gap-2 text-sm"
                    title="If on, constants render their LaTeX (when present) instead of value/units only."
                  >
                    <input
                      type="checkbox"
                      checked={!!prefs.showConstantLatex}
                      onChange={(e) => update("showConstantLatex", e.currentTarget.checked)}
                    />
                    Render constants’ LaTeX (when present)
                  </label>
                </div>

                {/* Ranking tuning */}
                <div>
                  <h5 className="text-sm font-medium">Ranking tuning</h5>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label
                      className="text-sm flex items-center gap-2"
                      title="Half-life in days. Set 0 to disable decay."
                    >
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

                    <label className="text-sm flex items-center gap-2" title="Re-order immediately after each copy.">
                      <input
                        type="checkbox"
                        checked={!!prefs.instantRerankOnCopy}
                        onChange={(e) => update("instantRerankOnCopy", e.currentTarget.checked)}
                      />
                      Instant re-rank after copy
                    </label>
                  </div>
                </div>

                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Ranks refresh on reload or when switching mode. Turn on “Instant re-rank” to update immediately.
                </p>

                {/* Data */}
                <div>
                  <h5 className="text-sm font-medium">Data</h5>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                    <Button onClick={() => fileInputRef.current?.click()} title="Import JSON">
                      <Import className="h-4 w-4" /> Import
                    </Button>
                    <Button onClick={exportAll} title="Export JSON">
                      <Download className="h-4 w-4" /> Export
                    </Button>
                    <Button onClick={resetToSeed} title="Reset to seed (keep settings)">
                      <RefreshCw className="h-4 w-4" /> Reset to seed
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer helper links + reset settings */}
        <div className="flex items-center justify-between">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Need help? See the{" "}
            <a className="underline" href="/docs">
              documentation
            </a>
            .
          </div>
          <Button onClick={resetAllSettings}>Reset settings to default</Button>
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
