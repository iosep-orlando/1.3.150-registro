import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EstadoBadge from "@/components/EstadoBadge";
import FiltroTabs from "@/components/FiltroTabs";
import { buttonSecondary, input, pageTitle, panel } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { pageFuncionario } from "@/lib/page-auth";
import { listAll, type RegistroFilter } from "@/lib/store/registros";
import { formatCuit } from "@/lib/validation";

export const metadata: Metadata = { title: "Presentaciones" };

const FILTROS: { value: RegistroFilter; label: string }[] = [
  { value: "sin_expediente", label: "Sin expediente" },
  { value: "con_expediente", label: "Con expediente" },
  { value: "todas", label: "Todas" },
];

type Search = PageProps<"/gestion">["searchParams"];

export default function PresentacionesPage({ searchParams }: PageProps<"/gestion">) {
  return (
    <main>
      <h1 className={pageTitle}>Presentaciones</h1>
      <p className="mt-2 text-muted">Las de todos los ciudadanos. Abrí una para iniciar su expediente.</p>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Server Component: el funcionario consulta sin filtrar por usuario.
async function Lista({ searchParams }: { searchParams: Search }) {
  await pageFuncionario();
  const params = await searchParams;
  const filtro = FILTROS.find((f) => f.value === params.filtro)?.value ?? "sin_expediente";
  const q = typeof params.q === "string" ? params.q : "";
  const registros = await listAll(filtro, q);
  const href = (f: string) => `/gestion?filtro=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltroTabs label="Filtrar presentaciones" items={FILTROS.map((f) => ({ ...f, href: href(f.value) }))} current={filtro} />
        <form action="/gestion" className="flex gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <label htmlFor="q" className="sr-only">Buscar por número, nombre, CUIT o email</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Número, nombre o CUIT" className={`${input} w-64`} />
          <button type="submit" className={buttonSecondary}>Buscar</button>
        </form>
      </div>
      <section className={`${panel} overflow-x-auto`}>
        {registros.length === 0 ? (
          <p className="p-5 text-muted">{q ? "Ninguna presentación coincide con la búsqueda." : "No hay presentaciones en esta lista."}</p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-2 font-bold">Número</th>
                <th className="px-4 py-2 font-bold">Fecha</th>
                <th className="px-4 py-2 font-bold">Interesado</th>
                <th className="px-4 py-2 font-bold">Solicita</th>
                <th className="px-4 py-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {registros.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-2">
                    <Link href={`/gestion/presentaciones/${r.id}`} className="tabular font-bold text-inst hover:underline">{r.numero}</Link>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-2">{formatDateTime(r.fecha)}</td>
                  <td className="px-4 py-2">
                    <span className="block font-bold">{r.interesado.nombre}</span>
                    <span className="tabular text-xs text-muted">{formatCuit(r.interesado.cuit)}</span>
                  </td>
                  <td className="max-w-xs px-4 py-2"><span className="line-clamp-2">{r.solicita}</span></td>
                  <td className="px-4 py-2">
                    <EstadoBadge estado={r.expediente?.estado ?? null} />
                    {r.expediente && <span className="tabular mt-1 block text-xs">{r.expediente.codigo}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
