import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EstadoBadge from "@/components/EstadoBadge";
import FiltroTabs from "@/components/FiltroTabs";
import { buttonSecondary, input, pageTitle, panel } from "@/components/ui";
import { toObjectId } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { pageFuncionario } from "@/lib/page-auth";
import { listExpedientes } from "@/lib/store/expedientes";
import { listTipos } from "@/lib/store/tipos";
import { ESTADO_LABEL } from "@/lib/tramite";
import type { ExpedienteEstado } from "@/lib/types";

export const metadata: Metadata = { title: "Expedientes" };

const ESTADOS: ExpedienteEstado[] = ["en_tramite", "resuelto", "archivado"];
type Search = PageProps<"/gestion/expedientes">["searchParams"];

export default function ExpedientesPage({ searchParams }: PageProps<"/gestion/expedientes">) {
  return (
    <main>
      <h1 className={pageTitle}>Expedientes</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Lista({ searchParams }: { searchParams: Search }) {
  await pageFuncionario();
  const params = await searchParams;
  const estado = ESTADOS.find((e) => e === params.estado);
  const tipo = typeof params.tipo === "string" ? params.tipo : "";
  const q = typeof params.q === "string" ? params.q : "";
  const [expedientes, tipos] = await Promise.all([
    listExpedientes({ estado, tipoId: toObjectId(tipo) ?? undefined, q }),
    listTipos(),
  ]);
  const href = (e: string) => {
    const p = new URLSearchParams();
    if (e) p.set("estado", e);
    if (tipo) p.set("tipo", tipo);
    if (q) p.set("q", q);
    return `/gestion/expedientes${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mt-6 space-y-4">
      <FiltroTabs
        label="Filtrar por estado"
        items={[{ value: "", label: "Todos", href: href("") }, ...ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e], href: href(e) }))]}
        current={estado ?? ""}
      />
      <form action="/gestion/expedientes" className="flex flex-wrap items-end gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <div>
          <label htmlFor="tipo" className="sr-only">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo} className={`${input} w-56`}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="q" className="sr-only">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Código, ciudadano o presentación" className={`${input} w-72`} />
        </div>
        <button type="submit" className={buttonSecondary}>Filtrar</button>
      </form>
      <section className={`${panel} overflow-x-auto`}>
        {expedientes.length === 0 ? (
          <p className="p-5 text-muted">No hay expedientes con estos filtros.</p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-2 font-bold">Código</th>
                <th className="px-4 py-2 font-bold">Tipo</th>
                <th className="px-4 py-2 font-bold">Ciudadano</th>
                <th className="px-4 py-2 font-bold">Estado</th>
                <th className="px-4 py-2 font-bold">Última actuación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {expedientes.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">
                    <Link href={`/gestion/expedientes/${e.id}`} className="tabular font-bold text-inst hover:underline">{e.codigo}</Link>
                  </td>
                  <td className="px-4 py-2">{e.tipo.nombre}</td>
                  <td className="px-4 py-2">{e.sujeto.nombre}</td>
                  <td className="px-4 py-2"><EstadoBadge estado={e.estado} /></td>
                  <td className="tabular px-4 py-2 text-muted">{formatDateTime(e.actuaciones.at(-1)?.fecha ?? e.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
