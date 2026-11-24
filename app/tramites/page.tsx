import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EstadoBadge from "@/components/EstadoBadge";
import { button, pageTitle, panel } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { pageUser } from "@/lib/page-auth";
import { listMine } from "@/lib/store/registros";

export const metadata: Metadata = { title: "Mis trámites" };

export default function MisTramitesPage() {
  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitle}>Mis trámites</h1>
        <Link href="/tramites/nueva" className={button}>Nueva presentación</Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Lista />
      </Suspense>
    </main>
  );
}

// Server Component: la consulta lleva el userId de la sesión, así que un
// administrado solo ve lo suyo.
async function Lista() {
  const caller = await pageUser();
  const registros = await listMine(caller.userId);
  if (registros.length === 0) {
    return (
      <section className={`${panel} mt-6 p-6`}>
        <p className="text-lg">Todavía no hiciste ninguna presentación.</p>
        <p className="mt-1 text-muted">Una nota general sirve para casi cualquier pedido: exponés el motivo, solicitás lo que necesitás y adjuntás la documentación.</p>
        <Link href="/tramites/nueva" className={`${button} mt-4`}>Hacer mi primera presentación</Link>
      </section>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {registros.map((r) => (
        <li key={r.id}>
          <Link href={`/tramites/${r.id}`} className={`${panel} block p-4 hover:border-inst`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="tabular font-bold">{r.numero}</span>
              <span className="text-sm text-muted">{formatDateTime(r.fecha)}</span>
              <EstadoBadge estado={r.expediente?.estado ?? null} />
              {r.expediente && <span className="tabular text-sm font-bold text-inst">{r.expediente.codigo}</span>}
            </div>
            <p className="mt-2 line-clamp-2"><span className="font-bold">Solicita: </span>{r.solicita}</p>
            {r.adjuntos.length > 0 && <p className="mt-1 text-sm text-muted">📎 {r.adjuntos.length} {r.adjuntos.length === 1 ? "adjunto" : "adjuntos"}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
