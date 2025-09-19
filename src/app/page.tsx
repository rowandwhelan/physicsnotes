"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import Chip from "@/components/ui/Chip";
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
import Link from "next/link";

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

type Ranked = Item & { score: number };

/* ----------------- Page ----------------- */

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | "All">("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setLocalPrefs] = useState<Prefs>(getPrefs());
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    let list = Array.from(set);
    // keep your rank ordering for the remainder
    list.sort((a, b) => (categoryOrder[a] ?? 100) - (categoryOrder[b] ?? 100));
    // move Constants to the front (after 'All')
    if (list.includes("Constants")) {
      list = ["Constants", ...list.filter((c) => c !== "Constants")];
    }
    return ["All", ...list];
  }, [items]);

  const usage = storage.getUsage();
  const recent = storage.getRecent();

  const ranked = useMemo(() => {
    const base: Ranked[] =
      query.trim().length === 0
        ? items.map((i) => ({ ...i, score: 0 }))
        : fuse.search(query).map((r) => ({ ...(r.item as Item), score: r.score ?? 0 }));

    const filtered = base.filter((i) => category === "All" || i.category === category);
    const mix = filtered.map((i) => {
      const useCount = usage[i.id] ?? 0;
      const recencyBoost = recent[i.id] ? 1 : 0;
      const basePop = i.popularity ?? 0;
      const textRelevance = i.score > 0 ? 1 - Math.min(i.score, 1) : 0.5;
      const total =
        0.55 * textRelevance + 0.25 * Math.tanh(useCount / 3) + 0.1 * recencyBoost + 0.1 * Math.tanh(basePop / 5);
      return { ...i, score: total };
    });

    if (query.trim().length > 0) {
      mix.sort((a, b) => b.score - a.score);
    } else {
      mix.sort((a, b) => {
        const ra = (a as any).rank ?? Number.POSITIVE_INFINITY;
        const rb = (b as any).rank ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        const pa = a.popularity ?? 0;
        const pb = b.popularity ?? 0;
        if (pa !== pb) return pb - pa;
        return a.name.localeCompare(b.name);
      });
    }
    return mix;
  }, [items, fuse, query, category, usage, recent]);

  // Keyboard shortcuts: Ctrl/Cmd+K focuses search; Ctrl/Cmd+Enter copies top result
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const onSearch = document.activeElement === searchRef.current;

      // Focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Copy top result only with Ctrl/Cmd+Enter while focus is in the search box
      if (
        onSearch &&
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        !e.isComposing // avoid IME composition edge-cases
      ) {
        e.preventDefault();
        const first = ranked[0];
        if (first) handleCopy(first, prefs);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, ranked]);

  /* ---------- Actions ---------- */

  async function handleCopy(i: Item, p: Prefs) {
    const text = buildCopy(i, p);
    await navigator.clipboard.writeText(text);
    storage.markUsed(i.id);
    setCopiedId(i.id);
    toast("Copied");
    setTimeout(() => setCopiedId((x) => (x === i.id ? null : x)), 900);
  }

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

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result)) as Item[];
        storage.bulkUpsert(json);
        setItems(storage.getAll());
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  }

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
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
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
          className="flex items-center gap-2 rounded-md border px-3 py-2 shadow-sm
             focus-within:outline-2 focus-within:outline-offset-2
             [outline-color:var(--ring)]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Search className="h-5 w-5" style={{ color: "var(--muted)" }} />
          <Input
            ref={searchRef}
            aria-label="Search formulas and constants"
            placeholder="Search by name, symbol, tags, or text… (Ctrl/Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="border-0 bg-transparent p-0"
          />
        </label>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-fit items-center gap-2 px-1">
            {categories.map((c) => (
              <Chip key={c} selected={c === category} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="text-xs text-[var(--muted)]">
          Tip: Press <span className="kbd">Ctrl</span>/<span className="kbd">Cmd</span> + <span className="kbd">K</span>{" "}
          to jump to search; <span className="kbd">Enter</span> copies the top match.
        </div>
      </section>

      {/* Results */}
      <section className="mt-8 space-y-10">
        {groupByCategory(ranked).map(([cat, list]) => (
          <div key={cat}>
            <h2 className="mb-4 text-xl font-semibold">{cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
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

function groupByCategory(list: Item[]): [string, Item[]][] {
  const map = new Map<string, Item[]>();
  for (const i of list) {
    const key = i.category || "Uncategorized";
    const arr = map.get(key) ?? [];
    arr.push(i);
    map.set(key, arr);
  }
  const sections = Array.from(map.entries()).sort(
    (a, b) => (categoryOrder[a[0]] ?? 100) - (categoryOrder[b[0]] ?? 100)
  );
  return sections.map(([cat, items]) => {
    items.sort((a, b) => {
      const ra = (a as any).rank ?? Number.POSITIVE_INFINITY;
      const rb = (b as any).rank ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      const pa = a.popularity ?? 0;
      const pb = b.popularity ?? 0;
      if (pa !== pb) return pb - pa;
      return a.name.localeCompare(b.name);
    });
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
