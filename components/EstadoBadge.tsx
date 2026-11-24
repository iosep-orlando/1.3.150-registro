import { ESTADO_LABEL } from "@/lib/tramite";
import type { ExpedienteEstado } from "@/lib/types";

const STYLE: Record<ExpedienteEstado, string> = {
  en_tramite: "border-alerta/40 bg-alerta/10 text-alerta",
  resuelto: "border-ok/40 bg-ok/10 text-ok",
  archivado: "border-line bg-hoja text-muted",
};

export default function EstadoBadge({ estado }: { estado: ExpedienteEstado | null }) {
  if (!estado) return <span className="inline-block whitespace-nowrap rounded-full border border-line bg-white px-2 py-0.5 text-xs font-bold text-muted">Recibida</span>;
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${STYLE[estado]}`}>{ESTADO_LABEL[estado]}</span>;
}
