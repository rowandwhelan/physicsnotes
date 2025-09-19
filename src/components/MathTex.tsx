"use client";

import { useEffect, useRef } from "react";

export default function MathTex({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const katex = await import("katex");
        if (!mounted || !ref.current) return;
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode: false,
          trust: false,
          strict: "warn",
        });
      } catch {
        // noop; fallback below
      }
    })();
    return () => {
      mounted = false;
    };
  }, [latex]);

  return (
    <span>
      <span ref={ref} />
      <noscript>
        <code className="code-block">{latex}</code>
      </noscript>
    </span>
  );
}
