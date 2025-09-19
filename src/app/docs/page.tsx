import Link from "next/link";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Docs · Physics Quick Sheet",
  description: "How to use search, copy presets, and the JSON import/export format.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <div className="flex items-center gap-2">
          <BackButton fallbackHref="/" />
          <Link href="/" className="btn" title="Home">
            Home
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Quick reference for search, copy presets, KaTeX, and JSON import/export.
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Search & Keyboard</h2>
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Ctrl/Cmd + K</strong> focuses the search bar.
          </li>
          <li>
            <strong>Ctrl/Cmd + Enter</strong> copies the top result (from the search box).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Copy Presets</h2>
        <p className="text-sm">Pick a default in Settings. You can override per-item via “More”.</p>
        <ul className="list-disc pl-5 text-sm">
          <li>
            <strong>Plain (compact):</strong> Minimal single-line text.
          </li>
          <li>
            <strong>Plain (verbose):</strong> Multi-line with a bit more context.
          </li>
          <li>
            <strong>LaTeX (inline):</strong> Raw LaTeX only (no <code>$</code> wrappers).
          </li>
          <li>
            <strong>LaTeX (symbol first):</strong> Constant-like “g = 9.81 …”.
          </li>
          <li>
            <strong>Markdown (inline):</strong> Uses inline <code>$...$</code> for equations.
          </li>
          <li>
            <strong>Markdown (fenced):</strong> Fenced <code>```tex</code> block for equations.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">KaTeX</h2>
        <p className="text-sm">
          Formulas render inline with KaTeX. If your equation doesn’t parse, we fall back to a code style.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Import / Export JSON</h2>
        <p className="text-sm">
          Import expects an array of <code>Item</code> objects. Unknown fields are ignored.
        </p>
        <pre className="code-block text-xs">{`// Item (TypeScript)
type Item = {
  id: string;
  kind: "constant" | "equation";
  name: string;
  symbol?: string;
  value?: string;
  units?: string;
  latex: string;
  text: string;
  tags: string[];
  category: string;
  source?: string;
  popularity?: number;
};`}</pre>

        <p className="text-sm font-medium">Example: Constant</p>
        <pre className="code-block text-xs">{`[
  {
    "id": "g",
    "kind": "constant",
    "name": "Standard gravity (approx.)",
    "symbol": "g",
    "value": "9.81",
    "units": "m s^-2",
    "latex": "g \\approx 9.81 \\, \\text{m}\\,\\text{s}^{-2}",
    "text": "Near Earth's surface, typical",
    "tags": ["gravity"],
    "category": "Constants",
    "source": "FYKOS constants",
    "popularity": 10
  }
]`}</pre>

        <p className="text-sm font-medium">Example: Equation</p>
        <pre className="code-block text-xs">{`[
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
]`}</pre>

        <p className="text-sm font-medium">Tips</p>
        <ul className="list-disc pl-5 text-sm">
          <li>
            Use unique <code>id</code> values. When adding via UI, we generate a UUID.
          </li>
          <li>
            Keep <code>text</code> short and practical; use <code>latex</code> for equations.
          </li>
          <li>
            Add 2–5 <code>tags</code> for better search.
          </li>
          <li>
            <code>popularity</code> seeds order; usage re-ranks over time.
          </li>
        </ul>
      </section>
    </main>
  );
}
