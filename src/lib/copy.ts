import { Item } from "./types";
import { Prefs } from "./prefs";

/**
 * Build copy text according to user's preset/toggles.
 * Secure and deterministic; won't inject HTML.
 */
export function buildCopy(i: Item, prefs: Prefs): string {
  const t = prefs.copyToggles;
  const pieces: string[] = [];

  const name = t.includeName ? i.name : "";
  const sym = t.includeSymbol && i.symbol ? i.symbol : "";
  const text = t.includeText && i.text ? i.text : "";
  const cat = t.includeCategory && i.category ? i.category : "";
  const src = t.includeSource && i.source ? i.source : "";

  const nameWithSym = sym ? (name ? `${name} (${sym})` : sym) : name;

  if (prefs.copyPreset === "plain_compact") {
    if (i.kind === "constant") {
      const lhs = nameWithSym.trim(); // may be ""
      const units = t.includeUnits && i.units ? ` ${i.units}` : "";
      if (i.value) {
        pieces.push(lhs ? `${lhs} = ${i.value}${units}` : `${i.value}${units}`);
      } else if (lhs) {
        pieces.push(lhs);
      }
    } else {
      const eq = i.latex ? i.latex : i.text || "";
      const lhs = nameWithSym.trim();
      pieces.push(lhs && eq ? `${lhs}: ${eq}` : eq || lhs);
    }
    if (text && text !== i.latex) pieces.push(`– ${text}`);
    if (cat || src) pieces.push(comment([cat, src].filter(Boolean).join(" | ")));
    return pieces.filter(Boolean).join(" ");
  }

  if (prefs.copyPreset === "plain_verbose") {
    if (i.kind === "constant") {
      const lhs = nameWithSym.trim();
      const units = t.includeUnits && i.units ? ` ${i.units}` : "";
      if (i.value) {
        pieces.push(lhs ? `${lhs} = ${i.value}${units}` : `${i.value}${units}`);
      } else if (lhs) {
        pieces.push(lhs);
      }
      if (text) pieces.push(`Note: ${text}`);
    } else {
      const lhs = nameWithSym.trim();
      if (i.latex) pieces.push(lhs ? `${lhs}: ${i.latex}` : i.latex);
      else if (i.text) pieces.push(lhs ? `${lhs}: ${i.text}` : i.text);
      else if (lhs) pieces.push(lhs);
    }
    if (cat || src) pieces.push(comment([cat, src].filter(Boolean).join(" | ")));
    return pieces.filter(Boolean).join("\n");
  }

  if (prefs.copyPreset === "latex_inline" || prefs.copyPreset === "latex_inline_symbol_first") {
    const lhs =
      prefs.copyPreset === "latex_inline_symbol_first" && i.symbol ? i.symbol : (name || i.symbol || "").trim();
    if (i.kind === "constant") {
      const units = t.includeUnits && i.units ? `\\,\\text{${i.units}}` : "";
      const eq = i.value ? `${lhs ? `${lhs} = ` : ""}${i.value}${units}` : lhs;
      pieces.push(eq);
    } else {
      const eq = i.latex || i.text || lhs;
      pieces.push(eq);
    }
    if (text) pieces.push(comment(text));
    return pieces.filter(Boolean).join(" ");
  }

  if (prefs.copyPreset === "markdown_inline") {
    const base =
      i.kind === "constant"
        ? `**${name || i.symbol}**${i.value ? ` = \`${i.value}\`` : ""}${
            t.includeUnits && i.units ? ` ${i.units}` : ""
          }`
        : `**${name || i.symbol}**${i.latex ? `: \`$${i.latex}$\`` : i.text ? ` — ${i.text}` : ""}`;
    const meta = [cat, src].filter(Boolean).join(" | ");
    return [base, meta ? `\n\n> ${meta}` : ""].join("");
  }

  if (prefs.copyPreset === "markdown_fenced") {
    const head = `**${nameWithSym || i.symbol || ""}**${text ? ` — ${text}` : ""}`;
    const body = i.latex
      ? `\n\n\`\`\`tex\n${i.latex}\n\`\`\``
      : i.value
      ? `\n\n\`${i.value}\`${t.includeUnits && i.units ? ` ${i.units}` : ""}`
      : "";
    const meta = [cat, src].filter(Boolean).join(" | ");
    return [head, body, meta ? `\n\n> ${meta}` : ""].join("");
  }

  // Fallback
  return `${i.name}`;
}

function comment(s: string) {
  if (!s) return "";
  return `/* ${s} */`;
}
