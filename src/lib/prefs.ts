const KEY = "pqs_prefs";

export type CopyPreset =
  | "plain_compact"
  | "plain_verbose"
  | "latex_inline"
  | "latex_inline_symbol_first"
  | "markdown_inline"
  | "markdown_fenced";

export type CopyToggles = {
  includeUnits: boolean; // constants
  includeName: boolean;
  includeSymbol: boolean;
  includeText: boolean; // description
  includeCategory: boolean; // as comment
  includeSource: boolean; // as comment
};

export type Prefs = {
  copyPreset: CopyPreset;
  copyToggles: CopyToggles;
  katexInline: boolean; // you asked for inline; keeping flag for future display mode
  themeChoice?: "auto" | "light" | "dark"; // mirrors ThemeProvider
};

// Migration from older "copyMode" if present
function migrate(raw: any): Prefs {
  const def: Prefs = {
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
  };
  if (!raw) return def;
  try {
    const obj = JSON.parse(raw);
    if (obj.copyMode && !obj.copyPreset) {
      const map: Record<string, CopyPreset> = {
        plain: "plain_compact",
        latex: "latex_inline",
        markdown: "markdown_inline",
      };
      obj.copyPreset = map[obj.copyMode] ?? def.copyPreset;
      delete obj.copyMode;
    }
    return { ...def, ...obj };
  } catch {
    return def;
  }
}

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getPrefs(): Prefs {
  if (!hasWindow()) {
    // safe defaults
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
    };
  }
  const raw = window.localStorage.getItem(KEY);
  return migrate(raw);
}

export function setPrefs(next: Partial<Prefs>) {
  const current = getPrefs();
  const merged = { ...current, ...next };
  if (hasWindow()) window.localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}
