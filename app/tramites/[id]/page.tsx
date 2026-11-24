import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Actuaciones from "@/components/Actuaciones";
import EstadoBadge from "@/components/EstadoBadge";
import RegistroDetalle from "@/components/RegistroDetalle";
import Sello from "@/components/Sello";
import { button, linkButton, panel } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { registroToDTO } from "@/lib/db";
import { pageUser } from "@/lib/page-auth";
import { getHomeConfig } from "@/lib/store/config";
import { expedienteDeRegistro } from "@/lib/store/expedientes";
import { getRegistroDoc } from "@/lib/store/registros";

export const metadata: Metadata = { title: "Presentación" };

type Props = PageProps<"/tramites/[id]">;

export default function TramitePage({ params, searchParams }: Props) {
  return (
    <main>
      <Link href="/tramites" className={`${linkButton} text-sm`}>← Mis trámites</Link>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Tramite params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Tramite({ params, searchParams }: Props) {
  const caller = await pageUser();
  const { id } = await params;
  // Una presentación ajena da 404, igual que una que no existe.
  const doc = await getRegistroDoc(caller, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const [config, expediente, query] = await Promise.all([getHomeConfig(), expedienteDeRegistro(caller, doc), searchParams]);
  const registro = registroToDTO(doc);

  return (
    <div className="mt-3 space-y-6">
      {query.nueva === "1" && (
        <p role="status" className="rounded-md border border-ok/40 bg-ok/5 px-4 py-3 font-bold text-ok">
          Listo: tu presentación quedó registrada. Te mandamos el justificante por mail.
        </p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="titulo tabular text-3xl sm:text-4xl">Presentación {registro.numero}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <EstadoBadge estado={registro.expediente?.estado ?? null} />
            {registro.expediente && <span className="tabular font-bold">Expediente {registro.expediente.codigo}</span>}
          </div>
          <a href={`/api/registros/${registro.id}/justificante`} target="_blank" rel="noreferrer" className={`${button} mt-5`}>
            Descargar el justificante (PDF)
          </a>
        </div>
        <Sello sigla={config.sigla} fecha={new Date(registro.fecha)} numero={registro.numero} />
      </div>

      {expediente ? (
        <section className={`${panel} p-5`} aria-labelledby="exp">
          <h2 id="exp" className="titulo text-2xl">Expediente <span className="tabular">{expediente.codigo}</span></h2>
          <p className="mt-1 text-muted">{expediente.tipo.nombre}</p>
          <div className="mt-5">
            <Actuaciones actuaciones={expediente.actuaciones} />
          </div>
        </section>
      ) : (
        <p className={`${panel} p-5 text-muted`}>
          Todavía no se abrió un expediente: la presentación está recibida y en espera. Cuando se abra, te avisamos por mail.
        </p>
      )}

      <RegistroDetalle registro={registro} />
    </div>
  );
}
