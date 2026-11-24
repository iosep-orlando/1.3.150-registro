import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Escudo from "@/components/Escudo";
import Sello from "@/components/Sello";
import { button, buttonSecondary } from "@/components/ui";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { homeFor } from "@/lib/next-url";
import { getHomeConfig } from "@/lib/store/config";
import { registroNumero, yearAR } from "@/lib/tramite";
import type { HomeConfig } from "@/lib/types";

export const metadata: Metadata = { title: { absolute: "Mesa de Entradas Virtual" } };

// La home pública. Sus textos, el color y el escudo los define el
// funcionario desde Configuración (modo SaaS): se leen de la base en cada
// visita. El diseño (hecho con la skill frontend-design) parte del objeto
// más reconocible de una mesa de entradas: el sello de "RECIBIDO" con la
// fecha y la hora, que acá se estampa con el color del organismo.
export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-28 bg-inst" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  await connection(); // la configuración se lee en cada visita, no al compilar
  const config = await getHomeConfig();
  const now = new Date();
  const avisos = config.avisos.split("\n").map((a) => a.trim()).filter(Boolean);

  return (
    <div className="overflow-x-clip">
      <header className="bg-inst text-inst-text">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Escudo tiene={config.tieneEscudo} version={config.escudoVersion} className="h-12 w-12" />
            <div>
              <p className="font-serif text-xl font-bold leading-tight">{config.organismo}</p>
              <p className="text-sm opacity-90">Mesa de Entradas Virtual</p>
            </div>
          </div>
          <Suspense fallback={<Link href="/login" className="rounded-md bg-inst-text px-4 py-2 font-bold text-inst">Ingresar</Link>}>
            <HeaderAction />
          </Suspense>
        </div>
      </header>

      <main>
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
            <div>
              <h1 className="titulo text-5xl sm:text-6xl">Presentá tu nota sin hacer fila.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{config.bienvenida}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?next=%2Ftramites%2Fnueva" className={`${button} px-6 py-3 text-lg`}>Iniciar un trámite</Link>
                <Link href="/login?next=%2Ftramites" className={`${buttonSecondary} px-6 py-3 text-lg`}>Ver mis trámites</Link>
              </div>
              <p className="mt-3 text-sm text-muted">Ingresás con tu email: te llega un enlace, sin contraseña.</p>
            </div>
            <div className="flex justify-center md:justify-end">
              <Sello sigla={config.sigla} fecha={now} numero={registroNumero(yearAR(now), 1)} golpe />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="titulo text-3xl">Cómo es el trámite</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="border-t-4 border-inst pt-4">
                <p className="titulo text-4xl text-inst" aria-hidden="true">{i + 1}</p>
                <h3 className="mt-2 text-lg font-bold">{paso.titulo}</h3>
                <p className="mt-1 text-muted">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <Informacion config={config} avisos={avisos} />
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted">
          <p>{config.organismo}. Mesa de Entradas Virtual.</p>
          <p>Sitio de práctica (proyecto 1.3.150 de CodeCrypto Academy): no es un organismo real.</p>
        </div>
      </footer>
    </div>
  );
}

const PASOS = [
  { titulo: "Completás la nota", texto: "Tus datos y los de tu representante si lo tenés, qué exponés y qué solicitás." },
  { titulo: "Adjuntás la documentación", texto: "PDF o fotos: DNI, planos, comprobantes. Hasta 5 archivos." },
  { titulo: "Recibís el justificante", texto: "Con número de registro, fecha y hora. Después seguís el expediente desde Mis trámites." },
];

function Informacion({ config, avisos }: { config: HomeConfig; avisos: string[] }) {
  if (avisos.length === 0 && !config.horario && !config.contacto) return null;
  return (
    <section className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
        {avisos.length > 0 && (
          <div className="border-l-4 border-alerta bg-alerta/5 p-5">
            <h2 className="font-bold">Avisos</h2>
            <ul className="mt-2 space-y-2">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}
        <dl className="space-y-4">
          {config.horario && (
            <div>
              <dt className="font-bold">Horario</dt>
              <dd className="text-muted">{config.horario}</dd>
            </div>
          )}
          {config.contacto && (
            <div>
              <dt className="font-bold">Contacto</dt>
              <dd className="text-muted">{config.contacto}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

/** Con sesión, el botón lleva al inicio de su rol; sin sesión, a ingresar. */
async function HeaderAction() {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = jwt ? await verifySession(jwt) : null;
  const cls = "rounded-md bg-inst-text px-4 py-2 font-bold text-inst";
  return session ? (
    <Link href={homeFor(session.role)} className={cls}>{session.role === "funcionario" ? "Ir a gestión" : "Mis trámites"}</Link>
  ) : (
    <Link href="/login" className={cls}>Ingresar</Link>
  );
}
