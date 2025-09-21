import Link from "next/link";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Docs · Physics Quick Sheet",
  description: "How search, copy presets, LaTeX rendering, ranking, and strict JSON import/export work.",
};

/* ---------- Code samples kept in string constants so the linter doesn't flag quotes ---------- */

const ITEM_TS = `type Item = {
  id: string;
  kind: "constant" | "equation";
  name: string;
  symbol?: string;
  value?: string; // required for constants; numeric string (e.g., "6.674e-11")
  units?: string;
  latex: string;  // required for equations; optional for constants
  text: string;
  tags: string[]; // array only
  category: string;
  source?: string;
  popularity?: number; // integer >= 0
};`;

const EX_CONSTANT = `[
  {
    "id": "g",
    "kind": "constant",
    "name": "Standard gravity (approx.)",
    "symbol": "g",
    "value": "9.81",
    "units": "m s^-2",
    "latex": "g \\\\approx 9.81 \\\\, \\\\text{m}\\\\,\\\\text{s}^{-2}", // optional
    "text": "Near Earth\\u2019s surface, typical",
    "tags": ["gravity"],
    "category": "Constants",
    "source": "FYKOS constants",
    "popularity": 10
  }
]`;

const EX_EQUATION = `[
  {
    "id": "kinematics-2",
    "kind": "equation",
    "name": "Uniform acceleration (1)",
    "latex": "v = v_0 + a t",
    "text": "Velocity update under constant acceleration",
    "tags": ["kinematics", "projectile"],
    "category": "Kinematics",
    "source": "UIUC PHYS 101 formula sheet",
    "popularity": 10
  }
]`;

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <BackButton fallbackHref="/" />
      </div>

      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Everything you need to know about search, copy, LaTeX, ranking, and the strict JSON import/export format.
      </p>

      {/* Overview */}
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="text-sm">
          Physics Quick Sheet is a fast reference with smart search, one-click copy, and usage-aware ranking. It ships
          with a small curated seed you can extend via the UI or by importing JSON.
        </p>
      </section>

      {/* Search & Keyboard */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Search &amp; Keyboard</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Ctrl/Cmd + K</strong> focuses the search box.
          </li>
          <li>
            <strong>Enter</strong> copies the top result when the search box is focused.
          </li>
          <li>
            <strong>Ctrl/Cmd + Enter</strong> copies the top result from anywhere (unless a modal is open).
          </li>
          <li>
            Fuzzy search covers <em>name</em>, <em>symbol</em>, <em>text</em>, <em>tags</em>, and <em>category</em>.
          </li>
        </ul>
      </section>

      {/* Copy Presets */}
      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Copy presets</h2>
        <p className="text-sm">
          Set your default in{" "}
          <Link className="underline" href="/?open=settings">
            Settings
          </Link>
          . Override per-item via the item&rsquo;s &ldquo;More&rdquo; menu.
        </p>
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Plain (compact):</strong> Minimal single-line; good for terminals.
          </li>
          <li>
            <strong>Plain (verbose):</strong> Multi-line with a bit more context.
          </li>
          <li>
            <strong>LaTeX (inline):</strong> Raw LaTeX only (no <code>$...$</code>); ideal for LaTeX editors.
          </li>
          <li>
            <strong>LaTeX (symbol first):</strong> For constants, starts with the symbol/name on the left if present
            (e.g. <code>g = 9.81</code>).
          </li>
          <li>
            <strong>Markdown (inline):</strong> Uses inline <code>$...$</code> for equations; good for markdown apps
            that support math.
          </li>
          <li>
            <strong>Markdown (fenced):</strong> Outputs a fenced <code>```tex</code> block.
          </li>
        </ul>

        <div
          className="rounded-md border p-3 text-sm"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="font-medium">
            What&rsquo;s the difference between &ldquo;LaTeX (inline)&rdquo; and &ldquo;LaTeX (symbol first)&rdquo;?
          </div>
          <p className="mt-1">
            <strong>LaTeX (inline)</strong> emits only the equation/LaTeX string itself: <code>v = v_0 + a t</code>.
            <br />
            <strong>LaTeX (symbol first)</strong> will place a constant&rsquo;s symbol/name before the value/equation
            (if present), producing formats like <code>g = 9.81</code> or <code>c = 2.998\\times10^8</code>. For
            equations, it behaves the same as inline unless a symbol/name is relevant in your data.
          </p>
        </div>
      </section>

      {/* KaTeX */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">KaTeX rendering</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            Equations render their <code>latex</code> when present.
          </li>
          <li>
            Constants show their numeric <em>value + units</em> by default. You can enable
            <em> &ldquo;Render constants&rsquo; LaTeX (when present)&rdquo;</em> in Settings → Advanced. If a constant
            lacks LaTeX, the UI falls back to the raw value automatically.
          </li>
          <li>If a LaTeX string fails to parse, we fall back to a code-styled string.</li>
        </ul>
      </section>

      {/* Ranking */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Ranking</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Ranking modes:</strong> &ldquo;Explicit order&rdquo; (seeded section order &amp; per-item rank) or
            &ldquo;Popularity-first&rdquo; (usage + seed popularity).
          </li>
          <li>
            <strong>Decay:</strong> Your copy history decays with a configurable half-life (days). Set <code>0</code> to
            disable.
          </li>
          <li>
            <strong>Instant re-rank:</strong> If off (default), ranks update on page reload or when switching ranking
            mode. Turn on &ldquo;Instant re-rank after copy&rdquo; in Advanced to re-order immediately after each copy.
          </li>
        </ul>
      </section>

      {/* Strict Import/Export */}
      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Import / Export (strict JSON)</h2>
        <p className="text-sm">
          Import expects either an array of <code>Item</code> or an object{" "}
          <code>{`{ items: Item[], prefs?: Prefs }`}</code>. The importer is <strong>strict</strong> and will reject
          invalid rows with exact reasons. You will see a summary such as{" "}
          <em>&ldquo;X/Y imported, Z invalid — see console&rdquo;</em> and a table of the rejected rows.
        </p>

        <div
          className="rounded-md border p-3 text-sm space-y-2"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="font-medium">Required fields (strict)</div>
          <ul className="list-disc pl-5">
            <li>
              <code>id</code>, <code>name</code>, <code>kind</code> (<code>&quot;equation&quot;</code> |{" "}
              <code>&quot;constant&quot;</code>), <code>category</code>, <code>tags</code> (array of strings).
            </li>
            <li>
              <strong>Equations</strong> must include non-empty <code>latex</code>.
            </li>
            <li>
              <strong>Constants</strong> must include a numeric <code>value</code> (string). <code>latex</code> is
              optional.
            </li>
            <li>
              <code>id</code> must be unique (no collisions with your data or within the file).
            </li>
            <li>
              Optional: <code>symbol</code>, <code>units</code>, <code>text</code>, <code>source</code>,{" "}
              <code>popularity</code> (integer ≥ 0).
            </li>
          </ul>
        </div>

        <p className="text-sm">
          <strong>Export</strong> downloads <code>{`{ version, exportedAt, items, prefs }`}</code>. You can re-import it
          later.
        </p>

        <p className="text-sm font-medium">TypeScript schema</p>
        <pre className="code-block text-xs">{ITEM_TS}</pre>

        <p className="text-sm font-medium">Example: Constant</p>
        <pre className="code-block text-xs">{EX_CONSTANT}</pre>

        <p className="text-sm font-medium">Example: Equation</p>
        <pre className="code-block text-xs">{EX_EQUATION}</pre>

        <div
          className="rounded-md border p-3 text-sm space-y-2"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="font-medium">Common import errors (and fixes)</div>
          <ul className="list-disc pl-5">
            <li>
              <em>Row is not an object</em> — file must be an array of JSON objects (or{" "}
              <code>{`{ items: [...] }`}</code>).
            </li>
            <li>
              <em>Missing/invalid kind</em> — must be <code>&quot;equation&quot;</code> or{" "}
              <code>&quot;constant&quot;</code>.
            </li>
            <li>
              <em>Equations must include non-empty latex</em> — add a proper LaTeX string.
            </li>
            <li>
              <em>Constants require numeric value</em> — ensure <code>value</code> is a numeric string such as{" "}
              <code>&quot;6.674e-11&quot;</code>.
            </li>
            <li>
              <em>Missing/empty category / name / id</em> — these are required.
            </li>
            <li>
              <em>Missing/invalid tags</em> — must be an array of strings (not a single comma-separated string).
            </li>
            <li>
              <em>Duplicate id</em> — ensure each <code>id</code> is unique across your file and existing data.
            </li>
          </ul>
        </div>
      </section>

      {/* Advanced LaTeX / Markdown tips */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Advanced LaTeX / Markdown tips</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            Inline math: <code>$v = v_0 + a t$</code>. Display math (if supported by your target):{" "}
            <code>$$E=mc^2$$</code>.
          </li>
          <li>
            Fractions: <code>{"\\frac{a}{b}"}</code>, roots: <code>{"\\sqrt{x}"}</code>, subscripts/superscripts:{" "}
            <code>{"v_0"}</code>, <code>{"x^2"}</code>.
          </li>
          <li>
            Greek: <code>{"\\alpha, \\beta, \\gamma"}</code>; vectors: <code>{"\\vec{v}"}</code>,{" "}
            <code>{"\\hat{n}"}</code>; scalable parens: <code>{"\\left( ... \\right)"}</code>.
          </li>
          <li>
            Units in Markdown: wrap numbers in backticks and keep units plain, e.g. <code>`9.81` m s^-2</code>.
          </li>
        </ul>
        <p className="text-sm">
          See{" "}
          <a
            href="https://katex.org/docs/supported.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            KaTeX supported functions &amp; symbols
          </a>
          .
        </p>
      </section>

      {/* Footer Links */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <Link className="underline text-sm" href="/?open=settings">
            Open Settings
          </Link>
          <Link className="underline text-sm" href="/">
            Back to app
          </Link>
        </div>
      </section>
    </main>
  );
}
