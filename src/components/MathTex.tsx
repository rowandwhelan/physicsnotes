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

export default function MathTex({ latex, inline, label }: { latex: string; inline?: boolean; label?: string }) {
  const { html, isBlock } = useMemo(() => {
    const detectedBlock = inline === undefined ? /^\s*\$\$[\s\S]*\$\$\s*$/.test(latex) : !inline;

    const src0 = detectedBlock ? latex.replace(/^\s*\$\$|\$\$\s*$/g, "") : latex;
    const src = sanitizeDanglingSubSup(src0);

    return {
      isBlock: detectedBlock,
      html: katex.renderToString(src, {
        displayMode: detectedBlock,
        output: "html", // ← no MathML (avoids <msub/> warnings)
        throwOnError: false,
        strict: "ignore",
        trust: true,
        macros: {},
      }),
    };
  }, [latex, inline, label]);

  return (
    <>
      {/* wrapper class is .mathtex (KaTeX still emits its own .katex inside) */}
      <span className="mathtex" data-display={isBlock ? "true" : "false"} dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx global>{`
        /* line up with your card text */
        .mathtex .katex-display {
          margin: 0 !important;
          text-align: left !important;
        }
        .mathtex .katex-display > .katex {
          display: inline-block !important;
        }
        /* size like your “old” look – bump it a bit; tune with --mathtex-scale */
        .mathtex .katex {
          font-size: var(--mathtex-scale, 1.3em) !important;
          line-height: 1.2 !important;
        }
      `}</style>
    </>
  );
}
