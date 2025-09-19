import { Item } from "./types";

export function formatItem(i: Item, mode: "plain" | "latex" = "plain"): string {
  if (i.kind === "constant") {
    const base = `${i.name}${i.symbol ? ` (${i.symbol})` : ""}${i.value ? ` = ${i.value}` : ""}${
      i.units ? ` ${i.units}` : ""
    }`;
    return mode === "latex" ? `${i.symbol ? i.symbol : i.name} = ${i.value ?? ""} ${i.units ?? ""}`.trim() : base;
  } else {
    if (mode === "latex") {
      return i.latex || i.text || i.name;
    }
    return `${i.name}${i.latex ? `: ${i.latex}` : ""}${i.text ? ` — ${i.text}` : ""}`;
  }
}

export function toMarkdown(i: Item): string {
  if (i.kind === "constant") {
    return `**${i.name}**${i.symbol ? ` (${i.symbol})` : ""}: \`${i.value ?? ""}\` ${i.units ?? ""}`.trim();
  }
  const latex = i.latex ? `\n\n\`\`\`tex\n${i.latex}\n\`\`\`` : "";
  return `**${i.name}**${i.text ? ` — ${i.text}` : ""}${latex}`;
}
