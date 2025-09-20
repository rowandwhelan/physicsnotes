"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import {
  Search,
  Clipboard,
  Check,
  MoreVertical,
  Plus,
  Import,
  Download,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import SettingsModal from "@/components/settings/SettingsModal";
import { useToast } from "@/components/toast/ToastProvider";

import { seedItems } from "@/lib/seed";
import { Item, NewItemInput } from "@/lib/types";
import { Storage } from "@/lib/storage";
import MathTex from "@/components/MathTex";
import { getPrefs, setPrefs, Prefs } from "@/lib/prefs";
import { buildCopy } from "@/lib/copy";
import clsx from "clsx";
import Menu from "@/components/ui/Menu";
import HScroll from "@/components/ui/HScroll";

/* ----------------- Setup ----------------- */

const storage = new Storage();

const categoryOrder: Record<string, number> = {
  Kinematics: 1,
  Dynamics: 2,
  "Work & Energy": 3,
  Momentum: 4,
  Rotation: 5,
  Oscillations: 6,
  Thermodynamics: 7,
  Constants: 99,
};

type HasRank = { rank?: number };

type Ranked = Item & { score: number };

const msPerDay = 86_400_000;

/* ----------------- Page ----------------- */

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null); // null = All
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setLocalPrefs] = useState<Prefs>(getPrefs());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [learnTick, setLearnTick] = useState(0);

  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Init data
  useEffect(() => {
    const stored = storage.getAll();
    if (stored.length === 0) {
      storage.bulkUpsert(seedItems);
      setItems(seedItems);
    } else {
      setItems(stored);
    }
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        includeScore: true,
        threshold: 0.35,
        keys: [
          { name: "name", weight: 0.55 },
          { name: "symbol", weight: 0.3 },
          { name: "text", weight: 0.25 },
          { name: "tags", weight: 0.2 },
          { name: "category", weight: 0.1 },
        ],
      }),
    [items]
  );

  const categories = useMemo((): { label: string; value: string | null }[] => {
    const set = new Set(items.map((i) => i.category));
    let list = Array.from(set);
    // ranked sections
    list.sort((a, b) => (categoryOrder[a] ?? 100) - (categoryOrder[b] ?? 100));
    // Put Constants right after “All”
    if (list.includes("Constants")) {
      list = ["Constants", ...list.filter((c) => c !== "Constants")];
    }
    return [{ label: "All", value: null }, ...list.map((c) => ({ label: c, value: c }))];
  }, [items]);

  const usage = storage.getUsage();
  const recent = storage.getRecent();

  const handleCopy = useCallback(
    async (i: Item, p: Prefs) => {
      const text = buildCopy(i, p);
      await navigator.clipboard.writeText(text);
      storage.markUsed(i.id);
      setLearnTick((t) => t + 1);
      setCopiedId(i.id);
      toast("Copied");
      setTimeout(() => setCopiedId((x) => (x === i.id ? null : x)), 900);
    },
    [toast]
  );

  const ranked = useMemo(() => {
    const base: Ranked[] =
      query.trim().length === 0
        ? items.map((i) => ({ ...i, score: 0 }))
        : fuse.search(query).map((r) => ({ ...(r.item as Item), score: r.score ?? 0 }));

    const usage: Record<string, number> = storage.getUsage();
    const recent: Record<string, number> = storage.getRecent();

    const halfLife = prefs.rankingHalfLifeDays ?? 14;
    const now = Date.now();

    function decayedUse(id: string) {
      const count = usage[id] ?? 0;
      const last = recent[id];
      if (!count || !last) return 0;
      if (!halfLife || halfLife <= 0) return count; // 0 or negative => no decay
      const ageDays = (now - last) / msPerDay;
      const decay = Math.pow(0.5, ageDays / halfLife);
      return count * decay;
    }

    const filtered = base.filter((i) => category === null || i.category === category);
    const mix = filtered.map((i) => {
      const useD = decayedUse(i.id);
      const recencyBoost = recent[i.id] ? 1 : 0;
      const basePop = i.popularity ?? 0;
      const textRelevance = i.score > 0 ? 1 - Math.min(i.score, 1) : 0.5;

      // learned signal stronger & decayed
      const total =
        0.45 * textRelevance + 0.35 * Math.tanh(useD / 2) + 0.1 * recencyBoost + 0.1 * Math.tanh(basePop / 5);

      return { ...i, score: total };
    });

    if (query.trim().length > 0) {
      mix.sort((a, b) => b.score - a.score);
    } else {
      if ((prefs.rankingMode ?? "rankFirst") === "popularityFirst") {
        // Popularity-first inside the current filter
        mix.sort((a, b) => {
          const sa = 0.7 * decayedUse(a.id) + 0.3 * (a.popularity ?? 0);
          const sb = 0.7 * decayedUse(b.id) + 0.3 * (b.popularity ?? 0);
          if (sa !== sb) return sb - sa;
          return a.name.localeCompare(b.name);
        });
      } else {
        // Explicit rank -> popularity -> name
        mix.sort((a, b) => {
          const ra = (a as HasRank).rank ?? Number.POSITIVE_INFINITY;
          const rb = (b as HasRank).rank ?? Number.POSITIVE_INFINITY;
          if (ra !== rb) return ra - rb;
          const pa = a.popularity ?? 0;
          const pb = b.popularity ?? 0;
          if (pa !== pb) return pb - pa;
          return a.name.localeCompare(b.name);
        });
      }
    }
    return mix;
  }, [items, fuse, query, category, learnTick, prefs.rankingMode, prefs.rankingHalfLifeDays]);

  // Keyboard shortcuts: Ctrl/Cmd+K focuses search; Ctrl/Cmd+Enter copies top result
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const onSearch = document.activeElement === searchRef.current;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (onSearch && (e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const first = ranked[0];
        if (first) handleCopy(first, prefs);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, ranked, handleCopy]);

  /* ---------- Actions ---------- */

  function onAdd(payload: NewItemInput) {
    const newItem: Item = {
      id: crypto.randomUUID(),
      kind: payload.kind,
      name: payload.name,
      symbol: payload.symbol || undefined,
      value: payload.value || undefined,
      units: payload.units || undefined,
      latex: payload.latex || "",
      text: payload.text || "",
      tags: payload.tags ?? [],
      category: payload.category,
      popularity: 0,
    };
    storage.upsert(newItem);
    setItems(storage.getAll());
    setShowAdd(false);
  }

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result);
        const json = JSON.parse(raw);
        if (Array.isArray(json)) {
          // legacy: array of items
          storage.bulkUpsert(json);
        } else if (json && Array.isArray(json.items)) {
          storage.bulkUpsert(json.items);
          if (json.prefs) setPrefs(json.prefs); // restore settings if present
        } else {
          alert("Invalid JSON format.");
          return;
        }
        setItems(storage.getAll());
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  function onReset() {
    if (confirm("Reset to built-in seed? This clears your local additions.")) {
      storage.clearAll();
      storage.bulkUpsert(seedItems);
      setItems(storage.getAll());
    }
  }

  /* ---------- Render ---------- */

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Physics Quick Sheet</h1>
          <p className="text-sm text-[var(--muted)]">
            Smart search, one-click copy, and self-re-ranked practical formulas & constants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Import className="h-4 w-4" /> Import
          </Button>

          <Button
            onClick={() => {
              const payload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                items,
                prefs: getPrefs(), // <-- include settings
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "physics-quick-sheet.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" /> Export
          </Button>

          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>

          <Button onClick={onReset}>
            <RefreshCw className="h-4 w-4" /> Reset
          </Button>

          {/* Keep header minimal: a single Settings button */}
          <Button onClick={() => setShowSettings(true)}>
            <SettingsIcon className="h-4 w-4" /> Settings
          </Button>
        </div>
      </header>

      {/* Command bar */}
      <section className="mt-6 flex flex-col gap-3">
        <label
          className="group/input flex items-center gap-2 rounded-md border px-3 py-2 shadow-sm
             focus-within:outline-2 focus-within:outline-offset-2 [outline-color:var(--ring)]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Search className="h-5 w-5" style={{ color: "var(--muted)" }} />
          <input
            ref={searchRef}
            aria-label="Search formulas and constants"
            placeholder="Search by name, symbol, tags, or text… (Ctrl/Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="w-full bg-transparent text-sm placeholder:[color:var(--muted)]
               outline-none focus:outline-none focus-visible:outline-none
               ring-0 focus:ring-0 border-0"
          />
        </label>

        <HScroll className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-fit items-center gap-2 px-1">
            {categories.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setCategory(opt.value)}
                className="chip"
                data-selected={opt.value === category ? "true" : "false"}
                title={opt.label}
              >
                <span className="truncate max-w-[32ch]">{opt.label}</span>
              </button>
            ))}
          </div>
        </HScroll>

        <div className="text-xs text-[var(--muted)]">
          Tip: Press <span className="kbd">Ctrl</span>/<span className="kbd">Cmd</span> + <span className="kbd">K</span>{" "}
          to jump to search; <span className="kbd">Enter</span> copies the top match.
        </div>
      </section>

      {/* Results */}
      <section className="mt-8 space-y-8">
        {groupByCategory(ranked, {
          rankingMode: prefs.rankingMode ?? "rankFirst",
          decayedUse: (id: string) => {
            const usage = storage.getUsage();
            const recent = storage.getRecent();
            const halfLife = prefs.rankingHalfLifeDays ?? 30; // default 1 month
            const last = recent[id];
            if (!last) return 0;
            // 0 or negative half-life => NO decay
            if (!halfLife || halfLife <= 0) return usage[id] ?? 0;
            const ageDays = (Date.now() - last) / msPerDay;
            const decay = Math.pow(0.5, ageDays / halfLife);
            return (usage[id] ?? 0) * decay;
          },
        }).map(([cat, list]) => (
          <div key={cat}>
            <h2 className="mb-4 text-xl font-semibold">{cat}</h2>
            <div className="grid gap-3 sm:gap-4 md:gap-5 sm:grid-cols-2 md:grid-cols-3">
              {list.map((i) => (
                <Card key={i.id}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{i.name}</h3>
                      {i.symbol && (
                        <span className="rounded px-2 py-0.5 text-xs" style={{ background: "var(--muted-surface)" }}>
                          {i.symbol}
                        </span>
                      )}
                    </div>

                    {i.text && (
                      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                        {i.text}
                      </p>
                    )}

                    {i.value && (
                      <p className="mt-1 font-mono text-sm">
                        {i.value} {i.units ?? ""}
                      </p>
                    )}

                    {i.latex && (
                      <div className="mt-2">
                        <MathTex latex={i.latex} />
                      </div>
                    )}

                    {i.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {i.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded px-2 py-0.5 text-xs"
                            style={{ background: "var(--muted-surface)" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button onClick={() => handleCopy(i, prefs)} className={clsx(copiedId === i.id && "scale-[0.99]")}>
                      {copiedId === i.id ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      {copiedId === i.id ? "Copied" : "Copy"}
                    </Button>

                    <Menu
                      button={
                        <Button>
                          <MoreVertical className="h-4 w-4" /> More
                        </Button>
                      }
                    >
                      <button
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:[background:var(--elevated-hover)]"
                        onClick={() => {
                          const m = setPrefs({ copyPreset: "latex_inline" });
                          setLocalPrefs(m);
                          handleCopy(i, m);
                        }}
                      >
                        Copy as LaTeX (inline)
                      </button>
                      <button
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:[background:var(--elevated-hover)]"
                        onClick={() => {
                          const m = setPrefs({ copyPreset: "markdown_inline" });
                          setLocalPrefs(m);
                          handleCopy(i, m);
                        }}
                      >
                        Copy as Markdown (inline)
                      </button>
                      <button
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:[background:var(--elevated-hover)]"
                        onClick={() => {
                          const m = setPrefs({ copyPreset: "plain_compact" });
                          setLocalPrefs(m);
                          handleCopy(i, m);
                        }}
                      >
                        Copy as Plain (compact)
                      </button>
                      {i.kind === "constant" && (
                        <button
                          className="block w-full rounded px-3 py-2 text-left text-sm hover:[background:var(--elevated-hover)]"
                          onClick={async () => {
                            const text = i.value ? `${i.value}${i.units ? ` ${i.units}` : ""}` : "";
                            await navigator.clipboard.writeText(text);
                            storage.markUsed(i.id);
                            setCopiedId(i.id);
                            toast("Copied value");
                            setTimeout(() => setCopiedId((x) => (x === i.id ? null : x)), 900);
                          }}
                        >
                          Copy value only
                        </button>
                      )}
                    </Menu>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>

      {showAdd && <AddDialog onClose={() => setShowAdd(false)} onSubmit={onAdd} />}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onChange={(p) => setLocalPrefs(p)} />
    </main>
  );
}

/* ------------ Helpers & Dialog ------------ */

function groupByCategory(
  list: Item[],
  opts: {
    rankingMode: "rankFirst" | "popularityFirst";
    decayedUse: (id: string) => number;
  }
): [string, Item[]][] {
  const map = new Map<string, Item[]>();
  for (const i of list) {
    const key = i.category || "Uncategorized";
    const arr = map.get(key) ?? [];
    arr.push(i);
    map.set(key, arr);
  }

  const sections = Array.from(map.entries());

  // Section ordering
  if (opts.rankingMode === "popularityFirst") {
    const score = (arr: Item[]) =>
      arr.reduce((s, it) => s + 0.7 * opts.decayedUse(it.id) + 0.3 * (it.popularity ?? 0), 0);
    sections.sort((a, b) => score(b[1]) - score(a[1]));
  } else {
    sections.sort((a, b) => (categoryOrder[a[0]] ?? 100) - (categoryOrder[b[0]] ?? 100));
  }

  // Item ordering inside each section
  return sections.map(([cat, items]) => {
    if (opts.rankingMode === "popularityFirst") {
      items.sort((a, b) => {
        const sa = 0.7 * opts.decayedUse(a.id) + 0.3 * (a.popularity ?? 0);
        const sb = 0.7 * opts.decayedUse(b.id) + 0.3 * (b.popularity ?? 0);
        if (sa !== sb) return sb - sa;
        return a.name.localeCompare(b.name);
      });
    } else {
      items.sort((a, b) => {
        const ra = (a as HasRank).rank ?? Number.POSITIVE_INFINITY;
        const rb = (b as HasRank).rank ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        const pa = a.popularity ?? 0;
        const pb = b.popularity ?? 0;
        if (pa !== pb) return pb - pa;
        return a.name.localeCompare(b.name);
      });
    }
    return [cat, items] as [string, Item[]];
  });
}

function AddDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (i: NewItemInput) => void }) {
  const [form, setForm] = useState<NewItemInput>({
    kind: "equation",
    name: "",
    category: "Kinematics",
    latex: "",
    text: "",
    symbol: "",
    value: "",
    units: "",
    tags: [],
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl card">
        <h3 className="text-lg font-semibold">Add item</h3>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Kind
            </span>
            <select
              className="input"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.currentTarget.value as "equation" | "constant" })}
            >
              <option value="equation">Equation</option>
              <option value="constant">Constant</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Category
            </span>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.currentTarget.value })} />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Name
            </span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Symbol (optional)
            </span>
            <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.currentTarget.value })} />
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Value (constants)
            </span>
            <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.currentTarget.value })} />
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Units (constants)
            </span>
            <Input value={form.units} onChange={(e) => setForm({ ...form, units: e.currentTarget.value })} />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              LaTeX (equations)
            </span>
            <Input
              value={form.latex}
              placeholder="e.g., v = v_0 + a t"
              onChange={(e) => setForm({ ...form, latex: e.currentTarget.value })}
              className="font-mono"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Description / Notes
            </span>
            <textarea
              className="input"
              rows={3}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.currentTarget.value })}
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Tags (comma separated)
            </span>
            <Input
              value={form.tags?.join(", ") ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.currentTarget.value
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.name.trim()) return alert("Name is required.");
              onSubmit(form);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
