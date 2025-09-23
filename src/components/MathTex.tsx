"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function sanitizeDanglingSubSup(s: string) {
  // trim trailing _ or ^
  s = s.replace(/[_^]\s*$/g, "");
  // wrap lone _ or ^ before whitespace/brace/punct
  s = s.replace(/_([\s}.,;:\n\r])/g, "_{ }$1").replace(/\^([\s}.,;:\n\r])/g, "^{ }$1");
  return s;
}

export default function MathTex({
  latex,
  inline,
  label,
}: {
  latex: string;
  inline?: boolean; // if omitted, $$...$$ triggers display mode
  label?: string; // optional for debugging
}) {
  const { html, isBlock } = useMemo(() => {
    const detectedBlock = inline === undefined ? /^\s*\$\$[\s\S]*\$\$\s*$/.test(latex) : !inline;

    const src0 = detectedBlock ? latex.replace(/^\s*\$\$|\$\$\s*$/g, "") : latex;
    const src = sanitizeDanglingSubSup(src0);

    return {
      isBlock: detectedBlock,
      html: katex.renderToString(src, {
        displayMode: detectedBlock,
        output: "html", // no MathML => no <msub/> warnings
        throwOnError: false,
        strict: "ignore",
        trust: true,
        macros: {},
      }),
    };
  }, [latex, inline]);

  // IMPORTANT: put .katex on the wrapper so you match your old sizing
  return (
    <>
      <span
        className="katex mathtex"
        data-display={isBlock ? "true" : "false"}
        // KaTeX returns a root <span class="katex">…</span>, so this nests .katex exactly like your old version.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        /* remove KaTeX's default center + extra margins in display mode */
        .mathtex .katex-display {
          margin: 0 !important;
          text-align: left !important;
        }
        .mathtex .katex-display > .katex {
          display: inline-block !important;
        }
      `}</style>
    </>
  );
}
