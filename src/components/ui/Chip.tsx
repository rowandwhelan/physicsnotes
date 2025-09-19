import clsx from "clsx";

export default function Chip({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button data-selected={selected ? "true" : "false"} className={clsx("chip focus-ring", className)} {...props} />
  );
}
