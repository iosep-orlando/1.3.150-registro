import { formatDateTime } from "@/lib/format";
import type { ActuacionDTO } from "@/lib/types";

/** Las actuaciones del expediente, de la más vieja a la más nueva, como una línea de tiempo. */
export default function Actuaciones({ actuaciones, mostrarVisibilidad = false }: { actuaciones: ActuacionDTO[]; mostrarVisibilidad?: boolean }) {
  if (actuaciones.length === 0) return <p className="text-muted">Todavía no hay actuaciones.</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-line pl-6">
      {actuaciones.map((a) => (
        <li key={a.id} className="relative">
          <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-white ${a.visible ? "bg-inst" : "bg-muted"}`} aria-hidden="true" />
          <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="tabular font-bold">{formatDateTime(a.fecha)}</span>
            <span className="text-muted">{a.autor}</span>
            {mostrarVisibilidad && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.visible ? "bg-inst/10 text-inst" : "bg-hoja text-muted"}`}>
                {a.visible ? "Visible para el ciudadano" : "Interna"}
              </span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-line">{a.texto}</p>
        </li>
      ))}
    </ol>
  );
}
