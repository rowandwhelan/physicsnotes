export type ItemKind = "constant" | "equation";

export type Item = {
  id: string;
  kind: ItemKind;
  name: string;
  symbol?: string;
  value?: string;
  units?: string;
  latex: string; // equation in LaTeX-ish syntax
  text: string; // human description
  tags: string[];
  category: string; // e.g., "Kinematics"
  source?: string;
  popularity?: number; // seed popularity 0..10
};

export type NewItemInput = {
  kind: ItemKind;
  name: string;
  symbol?: string;
  value?: string;
  units?: string;
  latex?: string;
  text?: string;
  tags?: string[];
  category: string;
  source?: string;
};
