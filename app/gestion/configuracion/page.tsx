import type { Metadata } from "next";
import { Suspense } from "react";
import ConfigForm from "@/components/ConfigForm";
import TiposManager from "@/components/TiposManager";
import { pageTitle } from "@/components/ui";
import { pageFuncionario } from "@/lib/page-auth";
import { getHomeConfig } from "@/lib/store/config";
import { listTipos } from "@/lib/store/tipos";

export const metadata: Metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return (
    <main>
      <h1 className={pageTitle}>Configuración</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Config />
      </Suspense>
    </main>
  );
}

async function Config() {
  await pageFuncionario();
  const [config, tipos] = await Promise.all([getHomeConfig(), listTipos()]);
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
      <ConfigForm initial={config} />
      <TiposManager initial={tipos} />
    </div>
  );
}
