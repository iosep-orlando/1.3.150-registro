import { formatBytes } from "@/lib/format";
import { CARACTER_LABEL } from "@/lib/tramite";
import { formatCuit } from "@/lib/validation";
import type { Persona, RegistroDTO } from "@/lib/types";

function PersonaDatos({ titulo, persona, extra }: { titulo: string; persona: Persona; extra?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-muted">{titulo}</h3>
      <p className="mt-1 font-bold">{persona.nombre}</p>
      <p className="tabular text-sm">CUIT/CUIL {formatCuit(persona.cuit)}</p>
      <p className="text-sm text-muted">{persona.domicilio}</p>
      {extra && <p className="text-sm">{extra}</p>}
    </div>
  );
}

/**
 * Lo que se presentó, tal cual: la misma vista para el administrado y
 * para el funcionario. Los adjuntos bajan por la API, que comprueba el
 * acceso y redirige a una URL prefirmada del bucket.
 */
export default function RegistroDetalle({ registro }: { registro: RegistroDTO }) {
  return (
    <article className="rounded-lg border border-line bg-white" aria-label={`Presentación ${registro.numero}`}>
      <div className="grid gap-6 border-b border-line p-5 sm:grid-cols-2">
        <PersonaDatos titulo="Interesado" persona={registro.interesado} />
        {registro.representante ? (
          <PersonaDatos titulo="Representante" persona={registro.representante} extra={`Actúa como ${CARACTER_LABEL[registro.representante.caracter].toLowerCase()}`} />
        ) : (
          <div>
            <h3 className="text-sm font-bold text-muted">Representante</h3>
            <p className="mt-1 text-sm text-muted">Presenta por sí.</p>
          </div>
        )}
      </div>
      <div className="space-y-5 p-5">
        <section>
          <h3 className="font-serif text-lg font-bold">Expone</h3>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{registro.expone}</p>
        </section>
        <section>
          <h3 className="font-serif text-lg font-bold">Solicita</h3>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{registro.solicita}</p>
        </section>
        <section>
          <h3 className="font-serif text-lg font-bold">Documentación adjunta</h3>
          {registro.adjuntos.length === 0 ? (
            <p className="mt-1 text-muted">Sin documentación adjunta.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              {registro.adjuntos.map((a) => (
                <li key={a.index} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <a href={`/api/registros/${registro.id}/adjuntos/${a.index}`} target="_blank" rel="noreferrer" className="font-bold text-inst hover:underline">
                    {a.contentType === "application/pdf" ? "📄" : "🖼️"} {a.filename}
                  </a>
                  <span className="text-sm text-muted">{formatBytes(a.size)}</span>
                  <span className="w-full break-all font-mono text-xs text-muted" title="Huella SHA-256 del archivo, la misma que figura en el justificante">
                    SHA-256 {a.sha256}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
