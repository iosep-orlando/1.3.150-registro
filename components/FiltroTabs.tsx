import Link from "next/link";

/** Pestañas de filtro que viven en la URL (?filtro=…): se pueden guardar o compartir. */
export default function FiltroTabs({ label, items, current }: { label: string; items: { href: string; label: string; value: string }[]; current: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Link
          key={i.value}
          href={i.href}
          aria-current={i.value === current ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-sm font-bold ${i.value === current ? "border-inst bg-inst text-inst-text" : "border-line bg-white hover:border-tinta/40"}`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
