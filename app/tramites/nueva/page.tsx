import type { Metadata } from "next";
import { Suspense } from "react";
import PresentacionForm from "@/components/PresentacionForm";
import { pageTitle } from "@/components/ui";
import { pageUser } from "@/lib/page-auth";
import { listMine } from "@/lib/store/registros";

export const metadata: Metadata = { title: "Nueva presentación" };

export default function NuevaPage() {
  return (
    <main className="max-w-3xl">
      <h1 className={pageTitle}>Nueva presentación</h1>
      <p className="mt-2 text-muted">Una nota general: para pedidos que no tienen un trámite propio.</p>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

/** Los datos del interesado vienen de la última presentación: casi siempre es la misma persona. */
async function Form() {
  const caller = await pageUser();
  const [ultima] = await listMine(caller.userId);
  return <PresentacionForm ultimoInteresado={ultima?.interesado ?? null} />;
}
