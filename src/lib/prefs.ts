const KEY = "pqs_prefs";

export type CopyPreset =
  | "plain_compact"
  | "plain_verbose"
  | "latex_inline"
  | "latex_inline_symbol_first"
  | "markdown_inline"
  | "markdown_fenced";

export type CopyToggles = {
  includeUnits: boolean;
  includeName: boolean;
  includeSymbol: boolean;
  includeText: boolean;
  includeCategory: boolean;
  includeSource: boolean;
};

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export type RankingMode = "rankFirst" | "popularityFirst";

export type Prefs = {
  copyPreset: CopyPreset;
  copyToggles: CopyToggles;
  katexInline: boolean;
  themeChoice?: "auto" | "light" | "dark";
  rankingMode?: RankingMode; // NEW
  rankingHalfLifeDays?: number; // NEW (decay)
};

function defaults(): Prefs {
  return {
    copyPreset: "plain_compact",
    copyToggles: {
      includeUnits: true,
      includeName: true,
      includeSymbol: true,
      includeText: false,
      includeCategory: false,
      includeSource: false,
    },
    katexInline: true,
    rankingMode: "rankFirst",
    rankingHalfLifeDays: 30,
  };
}

function migrate(raw: string | null): Prefs {
  const def = defaults();
  if (!raw) return def;
  try {
    const obj = JSON.parse(raw) as Partial<Prefs> & { copyMode?: string };
    if (obj.copyMode && !obj.copyPreset) {
      const map: Record<string, CopyPreset> = {
        plain: "plain_compact",
        latex: "latex_inline",
        markdown: "markdown_inline",
      };
      (obj as Partial<Prefs>).copyPreset = map[obj.copyMode] ?? def.copyPreset;
    }
    return { ...def, ...obj };
  } catch {
    return def;
  }
}

export function getPrefs(): Prefs {
  if (!hasWindow()) return defaults();
  const raw = window.localStorage.getItem(KEY);
  return migrate(raw);
}

export function setPrefs(next: Partial<Prefs>) {
  const merged = { ...getPrefs(), ...next };
  if (hasWindow()) window.localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}
