"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Search, Clipboard, Check, MoreVertical, Plus, Settings as SettingsIcon, X } from "lucide-react";
import Button from "@/components/ui/Button";
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
import Modal from "@/components/Modal";
import TagsInput from "@/components/ui/TagsInput";

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

  // Copy UX
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rerankPulse, setRerankPulse] = useState(0);

  // Frozen usage snapshot (used when instant re-rank is OFF)
  const [usageSnapshot, setUsageSnapshot] = useState<Record<string, number>>(() => storage.getUsage());
  const [recentSnapshot, setRecentSnapshot] = useState<Record<string, number>>(() => storage.getRecent());

  const { toast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  // refs for snapping
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({}); // per-section ref by category
  const commandRef = useRef<HTMLDivElement>(null); // sticky bar content (to measure height)
  useEffect(() => {
    function setSnapTopVar() {
      const h = commandRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--snap-top", `${h + 6}px`);
    }
    setSnapTopVar();
    window.addEventListener("resize", setSnapTopVar);
    return () => window.removeEventListener("resize", setSnapTopVar);
  }, []);

  const resultsRef = useRef<HTMLDivElement>(null);

  type SectionBounds = { id: string; top: number; bottom: number };
  const sectionIndexRef = useRef<Array<{ id: string; top: number; bottom: number }>>([]);

  const ANCHOR_PAD = 6; // pixels under sticky bar to align headings
  const EPS = 1; // tiny tolerance
  const JUMP_LOCK_MS = 90; // absorb coalesced wheel ticks without latency
  const jumpLockUntilRef = useRef(0);

  // snap state (prevents double steps during smooth scrolling)

  const minLockUntilRef = useRef(0);

  // anchors are separate from the visual section wrappers
  const anchorRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  type AnchorRow = { id: string; y: number }; // page Y of each anchor
  const anchorIndexRef = useRef<AnchorRow[]>([]);

  // Helper: current sticky offset (height of the search bar only when stuck)
  function stickyOffsetPx() {
    const h = commandRef.current?.offsetHeight ?? 0;
    return stickyEnabled && stuck ? h : 0;
  }

  // inside Page component
  const [stickyEnabled, setStickyEnabled] = useState(false);
  useEffect(() => {
    // defer to client so SSR/CSR markup initially match
    setStickyEnabled(!!prefs.stickySearchBar);
  }, [prefs.stickySearchBar]);

  // stuck state via IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!stickyEnabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 1 } // when the sentinel scrolls off, we’re “stuck”
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stickyEnabled]);

  useEffect(() => {
    const h = commandRef.current?.offsetHeight ?? 0;
    // when stuck, use measured height; when not stuck, no offset
    document.documentElement.style.setProperty("--sticky-height", stickyEnabled && stuck ? `${h}px` : "0px");
  }, [stickyEnabled, stuck]);

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

  // Open Settings if URL has ?open=settings (used by docs link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "settings") {
      setShowSettings(true);
      // clean URL (no reload)
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // If instant re-rank is turned OFF, freeze usage at that moment
  useEffect(() => {
    if (!prefs.instantRerankOnCopy) {
      setUsageSnapshot(storage.getUsage());
      setRecentSnapshot(storage.getRecent());
    }
  }, [prefs.instantRerankOnCopy]);

  // Fuzzy search
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

  // Categories
  const categories = useMemo((): { label: string; value: string | null }[] => {
    const set = new Set(items.map((i) => i.category));
    let list = Array.from(set);
    list.sort((a, b) => (categoryOrder[a] ?? 100) - (categoryOrder[b] ?? 100));
    if (list.includes("Constants")) {
      list = ["Constants", ...list.filter((c) => c !== "Constants")];
    }
    return [{ label: "All", value: null }, ...list.map((c) => ({ label: c, value: c }))];
  }, [items]);

  // Copy (click or keyboard) – always shows the same visuals
  const handleCopy = useCallback(
    async (i: Item, p: Prefs) => {
      const text = buildCopy(i, p);
      await navigator.clipboard.writeText(text);
      storage.markUsed(i.id);

      // Only trigger immediate re-rank when user has opted in
      if (p.instantRerankOnCopy) setRerankPulse((x) => x + 1);

      setCopiedId(i.id);
      toast("Copied");
      setTimeout(() => setCopiedId((x) => (x === i.id ? null : x)), 900);
    },
    [toast]
  );

  // Ranked list (query-aware + learning + popularity)
  const ranked = useMemo(() => {
    const base: Ranked[] =
      query.trim().length === 0
        ? items.map((i) => ({ ...i, score: 0 }))
        : fuse.search(query).map((r) => ({ ...(r.item as Item), score: r.score ?? 0 }));

    // Choose live usage/recent or frozen snapshots
    const usage: Record<string, number> = prefs.instantRerankOnCopy ? storage.getUsage() : usageSnapshot;
    const recent: Record<string, number> = prefs.instantRerankOnCopy ? storage.getRecent() : recentSnapshot;

    const halfLife = prefs.rankingHalfLifeDays ?? 30; // 1 month default
    const now = Date.now();

    function decayedUse(id: string) {
      const count = usage[id] ?? 0;
      const last = recent[id];
      if (!count || !last) return 0;
      if (!halfLife || halfLife <= 0) return count; // 0 => no decay
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

      const total =
        0.45 * textRelevance + 0.35 * Math.tanh(useD / 2) + 0.1 * recencyBoost + 0.1 * Math.tanh(basePop / 5);

      return { ...i, score: total };
    });

    if (query.trim().length > 0) {
      mix.sort((a, b) => b.score - a.score);
    } else {
      if ((prefs.rankingMode ?? "rankFirst") === "popularityFirst") {
        mix.sort((a, b) => {
          const sa = 0.7 * (usage[a.id] ?? 0) + 0.3 * (a.popularity ?? 0);
          const sb = 0.7 * (usage[b.id] ?? 0) + 0.3 * (b.popularity ?? 0);
          if (sa !== sb) return sb - sa;
          return a.name.localeCompare(b.name);
        });
      } else {
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
  }, [
    items,
    fuse,
    query,
    category,
    prefs.rankingMode,
    prefs.rankingHalfLifeDays,
    prefs.instantRerankOnCopy,
    usageSnapshot,
    recentSnapshot,
  ]);

  // helper: first visible item after grouping (respects category order)
  const firstVisible = useCallback((): Item | undefined => {
    const groups = groupByCategory(ranked, {
      rankingMode: prefs.rankingMode ?? "rankFirst",
      decayedUse: () => 0,
    });
    const firstGroup = groups[0];
    if (!firstGroup) return undefined;
    const [, list] = firstGroup;
    return list[0];
  }, [ranked, prefs.rankingMode]);

  // Keyboard:
  // - Ctrl/Cmd+K focuses search
  // - Enter copies top result when NO modal is open, regardless of focus (so it works on the page or inside the search)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modalOpen = showAdd || showSettings;
      if (modalOpen) return;

      const onSearch = document.activeElement === searchRef.current;
      const wantsCopy = (e.key === "Enter" && onSearch) || ((e.ctrlKey || e.metaKey) && e.key === "Enter");

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (wantsCopy && !e.isComposing) {
        if (!onSearch && query.trim().length === 0) return;
        const first = firstVisible();
        if (first) {
          e.preventDefault();
          handleCopy(first, prefs);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, handleCopy, showAdd, showSettings, query, firstVisible]);

  // Rerank mode pulse (soften the reordering perception)
  const handleRerankModeChange = useCallback(() => {
    setRerankPulse((x) => x + 1);
  }, []);

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

  // call after render / on resize / when results change
  function rebuildSectionIndex() {
    const pairs = Object.entries(sectionRefs.current)
      .map(([cat, el]) => {
        if (!el) return null;
        const top = el.getBoundingClientRect().top + window.scrollY;
        return { id: el.id || `cat-${cat}`, top, el };
      })
      .filter(Boolean) as Array<{ id: string; top: number; el: HTMLElement }>;

    pairs.sort((a, b) => a.top - b.top);

    const rows: SectionBounds[] = pairs.map((p, i) => {
      const next = pairs[i + 1];
      const bottom = next ? next.top : document.documentElement.scrollHeight;
      return { id: p.id, top: p.top, bottom };
    });

    sectionIndexRef.current = rows;
  }

  function rebuildAnchorIndex() {
    const pairs = Object.entries(anchorRefs.current)
      .map(([cat, el]) => {
        if (!el) return null;
        const y = Math.round(window.scrollY + el.getBoundingClientRect().top);
        return { id: cat, y };
      })
      .filter(Boolean) as AnchorRow[];

    pairs.sort((a, b) => a.y - b.y);
    anchorIndexRef.current = pairs;
  }

  // put near other helpers
  const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  // ensure we re-measure once fonts are ready (prevents off-by-one after KaTeX/webfonts)
  useEffect(() => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => requestAnimationFrame(rebuildSectionIndex));
    }
  }, []); // one-time

  // rebuild when layout changes
  useEffect(() => {
    rebuildSectionIndex();
    rebuildAnchorIndex(); // <— add
    const ro = new ResizeObserver(() => {
      rebuildSectionIndex();
      rebuildAnchorIndex(); // <— add
    });
    ro.observe(document.documentElement);
    window.addEventListener("resize", () => {
      rebuildSectionIndex();
      rebuildAnchorIndex(); // <— add
    });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", rebuildSectionIndex as any);
    };
  }, [ranked]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      rebuildSectionIndex();
      rebuildAnchorIndex(); // <— add
    });
    return () => cancelAnimationFrame(id);
  }, [rerankPulse, ranked, stickyEnabled, stuck]);

  // Put this helper near your other hooks
  const getSectionNodes = useCallback(() => {
    const root = resultsRef.current;
    return root ? Array.from(root.querySelectorAll<HTMLElement>('[data-section="cat"]')) : [];
  }, []);

  // Shift+scroll: jump by anchor (immune to tall sections & hit-testing)
  useEffect(() => {
    const LOCK_MS = 240; // absorb coalesced ticks during smooth scroll
    let lockUntil = 0;

    function onWheel(e: WheelEvent) {
      if (!e.shiftKey) return;

      const anchors = anchorIndexRef.current;
      if (!anchors.length) return;

      // prefer horizontal delta for trackpads
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (raw === 0) return;

      e.preventDefault();

      const now = performance.now();
      if (now < lockUntil) return;

      const dir: 1 | -1 = raw > 0 ? 1 : -1;
      const step = e.altKey ? 2 : 1;

      // Anchor line at the sticky bar (just under it)
      const stickyH = (stickyEnabled && stuck ? commandRef.current?.offsetHeight ?? 0 : 0) + 6;
      const anchorLine = window.scrollY + stickyH + 1;

      // Find current index = last anchor with y <= anchorLine (binary search)
      let lo = 0,
        hi = anchors.length - 1,
        cur = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (anchors[mid].y <= anchorLine) {
          cur = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      let next = Math.max(0, Math.min(anchors.length - 1, cur + dir * step));
      if (next === cur) return; // edge

      const targetY = anchors[next].y; // already pre-offset by the .cat-anchor CSS
      lockUntil = now + LOCK_MS;

      // Smooth, reliable, and no dead-zones
      window.scrollTo({ top: targetY, behavior: "smooth" });

      // lightweight unlock in case 'scrollend' doesn't fire
      window.setTimeout(() => {
        lockUntil = 0;
      }, LOCK_MS + 80);
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [stickyEnabled, stuck]);

  /* ---------- Render ---------- */

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Physics Quick Sheet</h1>
          <p className="text-sm text-[var(--muted)]">
            Smart search, one-click copy, and self-re-ranked practical formulas & constants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
          <Button onClick={() => setShowSettings(true)}>
            <SettingsIcon className="h-4 w-4" /> Settings
          </Button>
        </div>
      </header>

      {/* sentinel goes ABOVE the sticky strip so we can detect "stuck" */}
      {stickyEnabled && <div ref={sentinelRef} aria-hidden className="h-0" />}

      {/* Command bar */}
      <section className={clsx("mt-6", stickyEnabled && "sticky top-0 z-40")}>
        {/* Full-width blurred background; border only when actually stuck */}
        <div
          className={clsx(
            stickyEnabled &&
              "-mx-[max(0px,calc((100vw-100%)/2))] px-[max(0px,calc((100vw-100%)/2))] " +
                "backdrop-blur-2xl bg-[color:var(--bg)]/70",
            stuck && "border-b"
          )}
          style={stuck ? { borderColor: "var(--border)" } : undefined}
        >
          {/* centered content with comfy vertical padding */}
          <div ref={commandRef} className="mx-auto max-w-6xl space-y-2.5 py-1.5">
            <label
              className="group/input relative flex items-center gap-2 rounded-md border px-3 py-2 shadow-sm
                   focus-within:outline-2 focus-within:outline-offset-2 [outline-color:var(--ring)]"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <Search className="h-5 w-5" style={{ color: "var(--muted)" }} />
              <input
                ref={searchRef}
                aria-label="Search formulas and constants"
                placeholder="Search by name, symbol, tags, or text…"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                className="w-full bg-transparent text-sm placeholder:[color:var(--muted)]
                     outline-none focus:outline-none focus-visible:outline-none ring-0 border-0"
              />
              {query.length > 0 && (
                <button
                  aria-label="Clear search"
                  className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded hover:[background:var(--elevated-hover)]"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <HScroll className="-mx-1 overflow-x-auto pb-1 no-scrollbar">
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
          </div>
        </div>
      </section>

      {/* Empty state */}
      {ranked.length === 0 && (
        <div className="mt-10 grid place-items-center">
          <div className="text-center">
            <div className="text-lg font-medium">No matches</div>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Try a different search or add a new item.
            </p>
            <div className="mt-3">
              <Button onClick={() => setShowAdd(true)}>Add item</Button>
            </div>
          </div>
        </div>
      )}

      {/* Results (pulse key to trigger a light fade-in) */}
      <section ref={resultsRef} key={rerankPulse} className="mt-8 space-y-8">
        {groupByCategory(ranked, {
          rankingMode: prefs.rankingMode ?? "rankFirst",
          decayedUse: (id: string) => {
            const usage = prefs.instantRerankOnCopy ? storage.getUsage() : usageSnapshot;
            const recent = prefs.instantRerankOnCopy ? storage.getRecent() : recentSnapshot;
            const halfLife = prefs.rankingHalfLifeDays ?? 30;
            const last = recent[id];
            if (!last) return 0;
            if (!halfLife || halfLife <= 0) return usage[id] ?? 0;
            const ageDays = (Date.now() - last) / msPerDay;
            const decay = Math.pow(0.5, ageDays / halfLife);
            return (usage[id] ?? 0) * decay;
          },
        }).map(([cat, list]) => (
          <>
            <span
              className="cat-anchor"
              data-anchor={cat}
              ref={(el) => {
                anchorRefs.current[cat] = el;
              }}
            />
            <section
              key={cat}
              data-section="cat"
              ref={(el) => {
                sectionRefs.current[cat] = el;
              }}
            >
              <h2 className="mb-4 text-xl font-semibold">{cat}</h2>
              <div className="grid gap-3 sm:gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

                      {/* constants: show LaTeX if enabled & present */}
                      {i.kind === "constant" && prefs.showConstantLatex && i.latex && (
                        <div className="mt-2.5">
                          <MathTex latex={i.latex} label={`${i.name} (${i.id})`} />
                        </div>
                      )}

                      {/* equations: always show LaTeX */}
                      {i.kind === "equation" && i.latex && (
                        <div className="mt-2.5">
                          <MathTex latex={i.latex} label={`${i.name} (${i.id})`} />
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
                      <Button
                        onClick={() => handleCopy(i, prefs)}
                        className={clsx(copiedId === i.id && "scale-[0.99]")}
                      >
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
                              if (prefs.instantRerankOnCopy) setRerankPulse((x) => x + 1);
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
            </section>
          </>
        ))}
      </section>

      {/* Guided Add Modal */}
      {showAdd && (
        <AddDialog
          open={showAdd}
          categories={categories.filter((c) => c.value !== null).map((c) => c.label)}
          onClose={() => setShowAdd(false)}
          onSubmit={onAdd}
          buildPreview={(item) => buildCopy(item, getPrefs())}
        />
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onChange={(p) => setLocalPrefs(p)}
        onDataChange={() => setItems(storage.getAll())}
        onRerankModeChange={handleRerankModeChange}
      />
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
    const sectionAvg = (arr: Item[]) => {
      if (!arr.length) return 0;
      const sum = arr.reduce((s, it) => s + (0.7 * opts.decayedUse(it.id) + 0.3 * (it.popularity ?? 0)), 0);
      return sum / arr.length; // << average, not total
    };
    sections.sort((a, b) => {
      const sa = sectionAvg(a[1]);
      const sb = sectionAvg(b[1]);
      if (sb !== sa) return sb - sa;
      // tie-breakers so order is stable
      const maxA = Math.max(...a[1].map((it) => 0.7 * opts.decayedUse(it.id) + 0.3 * (it.popularity ?? 0)));
      const maxB = Math.max(...b[1].map((it) => 0.7 * opts.decayedUse(it.id) + 0.3 * (it.popularity ?? 0)));
      if (maxB !== maxA) return maxB - maxA;
      return a[0].localeCompare(b[0]);
    });
  } else {
    // (unchanged explicit-order branch)
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

/* ----------------- Guided AddDialog (Modal-based) ----------------- */

function AddDialog({
  open,
  categories,
  onClose,
  onSubmit,
  buildPreview,
}: {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onSubmit: (i: NewItemInput) => void;
  buildPreview: (i: Item) => string;
}) {
  const [form, setForm] = useState<NewItemInput>({
    kind: "equation",
    name: "",
    category: categories[0] ?? "Kinematics",
    latex: "",
    text: "",
    symbol: "",
    value: "",
    units: "",
    tags: [],
  });

  const [errors, setErrors] = useState<{ name?: string; category?: string; value?: string }>({});

  useEffect(() => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.category.trim()) next.category = "Category is required.";
    if (form.kind === "constant" && form.value && isNaN(Number(form.value))) {
      next.value = "Value should be numeric (e.g., 6.67e-11).";
    }
    setErrors(next);
  }, [form]);

  const preview: Item = useMemo(
    () => ({
      id: "preview",
      kind: form.kind,
      name: form.name || "New item",
      symbol: form.symbol || undefined,
      value: form.value || undefined,
      units: form.units || undefined,
      latex: form.latex || "",
      text: form.text || "",
      tags: form.tags ?? [],
      category: form.category || "Uncategorized",
    }),
    [form]
  );

  function submit() {
    if (Object.keys(errors).length > 0) return;
    if (!form.name.trim() || !form.category.trim()) return;
    onSubmit(form);
  }

  const isEq = form.kind === "equation";
  const isConst = form.kind === "constant";

  return (
    <Modal open={open} onClose={onClose}>
      {/* Sticky header: Save (left), Cancel (right) */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 sm:px-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <Button onClick={submit} disabled={!!errors.name || !!errors.category}>
          Save
        </Button>
        <div className="text-sm font-medium">Add item</div>
        <Button onClick={onClose}>Cancel</Button>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Kind */}
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Kind
            </span>
            <select
              className="input w-full"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.currentTarget.value as "equation" | "constant" })}
            >
              <option value="equation">Equation</option>
              <option value="constant">Constant</option>
            </select>
          </label>

          {/* Category */}
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Category
            </span>
            <input
              list="category-options"
              className="input w-full"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.currentTarget.value })}
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
          </label>

          {/* Name */}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Name <span className="text-red-500">*</span>
            </span>
            <input
              className="input w-full"
              placeholder={isEq ? "Uniform acceleration (1)" : "Boltzmann constant"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </label>

          {/* Symbol */}
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Symbol (optional)
            </span>
            <input
              className="input w-full font-mono"
              placeholder={isEq ? "v (for velocity)" : "k_B"}
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.currentTarget.value })}
            />
          </label>

          {/* Value / Units — only for constants */}
          {isConst && (
            <>
              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--muted)" }}>
                  Value
                </span>
                <input
                  className="input w-full font-mono"
                  placeholder="1.381e-23"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.currentTarget.value })}
                />
                {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value}</p>}
              </label>

              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--muted)" }}>
                  Units
                </span>
                <input
                  className="input w-full font-mono"
                  placeholder="J K^-1"
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.currentTarget.value })}
                />
              </label>
            </>
          )}

          {/* LaTeX — only for equations */}
          {isEq && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block" style={{ color: "var(--muted)" }}>
                LaTeX
              </span>
              <input
                className="input w-full font-mono"
                placeholder="v = v_0 + a t"
                value={form.latex}
                onChange={(e) => setForm({ ...form, latex: e.currentTarget.value })}
              />
            </label>
          )}

          {/* Description */}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Description / Notes
            </span>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="What is this used for? Any constraints or approximations?"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.currentTarget.value })}
            />
          </label>

          {/* Tags */}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>
              Tags (comma separated)
            </span>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block" style={{ color: "var(--muted)" }}>
                Tags
              </span>
              <TagsInput value={form.tags ?? []} onChange={(tags) => setForm({ ...form, tags })} />
            </label>
          </label>
        </div>

        {/* Live preview */}
        <div
          className="mt-4 rounded-md border p-3"
          style={{ borderColor: "var(--border)", background: "var(--elevated)" }}
        >
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Preview (default copy format)
          </div>
          <pre className="mt-1 text-sm whitespace-pre-wrap">{buildPreview(preview)}</pre>
        </div>

        {/* Advanced (bottom) */}
        <div className="mt-4 rounded-md border" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
          <details>
            <summary className="cursor-pointer px-3 py-2 text-sm">Advanced</summary>
            <div className="border-t p-3 text-sm space-y-2" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="font-medium">LaTeX tips</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Fractions: <code>{"\\frac{a}{b}"}</code> • Roots: <code>{"\\sqrt{x}"}</code> • Subscripts:{" "}
                  <code>{"v_0"}</code> • Superscripts: <code>{"x^2"}</code>
                </div>
              </div>
              <div>
                <div className="font-medium">Tagging</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Add 2–5 tags to improve search and popularity-based ranking.
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </Modal>
  );
}
