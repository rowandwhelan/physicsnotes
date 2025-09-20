"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export default function MathTex({ latex }: { latex: string }) {
  // Display if LaTeX is wrapped with $$...$$. Otherwise inline.
  const { html, displayMode } = useMemo(() => {
    const isBlock = /^\s*\$\$[\s\S]*\$\$\s*$/.test(latex);
    const src = isBlock ? latex.replace(/^\s*\$\$|\$\$\s*$/g, "") : latex;
    return {
      displayMode: isBlock,
      html: katex.renderToString(src, {
        displayMode: isBlock,
        throwOnError: false,
        strict: "ignore",
        trust: true,
        macros: {},
      }),
    };
  }, [latex]);

  return (
    <span data-display={displayMode ? "true" : "false"} className="katex" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
