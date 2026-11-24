import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AbrirExpediente from "@/components/AbrirExpediente";
import EstadoBadge from "@/components/EstadoBadge";
import RegistroDetalle from "@/components/RegistroDetalle";
import { button, buttonSecondary, linkButton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { registroToDTO } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { pageFuncionario } from "@/lib/page-auth";
import { getRegistroDoc } from "@/lib/store/registros";
import { listTipos } from "@/lib/store/tipos";

export const metadata: Metadata = { title: "Presentación" };

export default function PresentacionPage({ params }: PageProps<"/gestion/presentaciones/[id]">) {
  return (
    <main>
      <Link href="/gestion" className={`${linkButton} text-sm`}>← Presentaciones</Link>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Presentacion params={params} />
      </Suspense>
    </main>
  );
}

async function Presentacion({ params }: { params: PageProps<"/gestion/presentaciones/[id]">["params"] }) {
  const caller = await pageFuncionario();
  const { id } = await params;
  const doc = await getRegistroDoc(caller, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const registro = registroToDTO(doc);
  const tipos = registro.expediente ? [] : await listTipos(true);

  return (
    <div className="mt-3 space-y-6">
      <div>
        <h1 className="titulo tabular text-3xl sm:text-4xl">Presentación {registro.numero}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-muted">
          <span className="tabular">{formatDateTime(registro.fecha)}</span>
          <span>{registro.userEmail}</span>
          <EstadoBadge estado={registro.expediente?.estado ?? null} />
        </p>
        <a href={`/api/registros/${registro.id}/justificante`} target="_blank" rel="noreferrer" className={`${buttonSecondary} mt-4`}>Ver el justificante</a>
      </div>
      {registro.expediente ? (
        <Link href={`/gestion/expedientes/${registro.expediente.id}`} className={button}>
          Ir al expediente {registro.expediente.codigo}
        </Link>
      ) : (
        <AbrirExpediente registroId={registro.id} tipos={tipos} />
      )}
      <RegistroDetalle registro={registro} />
    </div>
  );
}
