"use client";
import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function sanitizeDanglingSubSup(s: string) {
  // 1) remove trailing _ or ^ at end of string
  s = s.replace(/[_^]\s*$/g, "");
  // 2) fix “_ ” or “^ ” (underscore/caret followed by only whitespace then a delimiter)
  s = s.replace(/_([\s}])/, "_{ }$1").replace(/\^([\s}])/, "^{ }$1");
  // 3) fix underscore/caret immediately before punctuation/newline
  s = s.replace(/_([.,;:\n\r])/g, "_{ }$1").replace(/\^([.,;:\n\r])/g, "^{ }$1");
  return s;
}

export default function MathTex({
  latex,
  inline = false,
  label,
}: {
  latex: string;
  inline?: boolean;
  /** optional: pass item name/id for better error logs */
  label?: string;
}) {
  const [html, setHtml] = useState<string>("");

  const safe = useMemo(() => sanitizeDanglingSubSup(latex ?? ""), [latex]);

  useEffect(() => {
    try {
      const out = katex.renderToString(safe, {
        displayMode: !inline,
        // Avoid MathML generation that triggers those console warnings
        output: "html",
        throwOnError: false,
        strict: "ignore", // don’t spam console for minor issues
        trust: false,
      });
      setHtml(out);
    } catch (err) {
      console.warn("[MathTex] render error", { label, latex, sanitized: safe, err });
      // graceful fallback so UI stays usable
      setHtml(`<code class="code-block">${escapeHtml(latex ?? "")}</code>`);
    }
  }, [safe, inline, latex, label]);

  return <span className={inline ? "" : "block"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
