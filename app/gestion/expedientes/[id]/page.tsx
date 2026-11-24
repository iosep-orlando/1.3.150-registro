import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Actuaciones from "@/components/Actuaciones";
import EstadoBadge from "@/components/EstadoBadge";
import ExpedienteAcciones from "@/components/ExpedienteAcciones";
import { linkButton, panel } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { pageFuncionario } from "@/lib/page-auth";
import { getExpediente } from "@/lib/store/expedientes";
import { formatCuit } from "@/lib/validation";

export const metadata: Metadata = { title: "Expediente" };

export default function ExpedientePage({ params }: PageProps<"/gestion/expedientes/[id]">) {
  return (
    <main>
      <Link href="/gestion/expedientes" className={`${linkButton} text-sm`}>← Expedientes</Link>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Expediente params={params} />
      </Suspense>
    </main>
  );
}

async function Expediente({ params }: { params: PageProps<"/gestion/expedientes/[id]">["params"] }) {
  const caller = await pageFuncionario();
  const { id } = await params;
  const expediente = await getExpediente(caller, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="mt-3 space-y-6">
      <div>
        <h1 className="titulo tabular break-all text-2xl sm:text-4xl">{expediente.codigo}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <EstadoBadge estado={expediente.estado} />
          <span className="font-bold">{expediente.tipo.nombre}</span>
          <span className="tabular text-muted">abierto el {formatDateTime(expediente.fecha)}</span>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <section className={`${panel} p-5`} aria-labelledby="act">
          <h2 id="act" className="titulo text-xl">Actuaciones</h2>
          <div className="mt-5">
            <Actuaciones actuaciones={expediente.actuaciones} mostrarVisibilidad />
          </div>
        </section>
        <div className="space-y-4 lg:sticky lg:top-6">
          <dl className={`${panel} space-y-3 p-5 text-sm`}>
            <div>
              <dt className="font-bold text-muted">Contribuyente sujeto</dt>
              <dd className="font-bold">{expediente.sujeto.nombre}</dd>
              <dd className="tabular">CUIT/CUIL {formatCuit(expediente.sujeto.cuit)}</dd>
              <dd className="text-muted">{expediente.sujeto.email}</dd>
            </div>
            <div>
              <dt className="font-bold text-muted">Presentación de origen</dt>
              <dd>
                <Link href={`/gestion/presentaciones/${expediente.registroId}`} className={`${linkButton} tabular`}>{expediente.registroNumero}</Link>
              </dd>
            </div>
          </dl>
          <ExpedienteAcciones expediente={expediente} />
        </div>
      </div>
    </div>
  );
}
