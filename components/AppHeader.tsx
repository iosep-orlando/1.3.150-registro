"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useGlobal } from "@/lib/context/GlobalContext";
import { api } from "@/lib/fetcher";
import { ROLE_LABEL } from "@/lib/roles";
import Escudo from "./Escudo";

const LINKS = {
  administrado: [
    { href: "/tramites", label: "Mis trámites", exact: true },
    { href: "/tramites/nueva", label: "Nueva presentación", exact: true },
  ],
  funcionario: [
    { href: "/gestion", label: "Presentaciones", exact: false },
    { href: "/gestion/expedientes", label: "Expedientes", exact: false },
    { href: "/gestion/configuracion", label: "Configuración", exact: false },
  ],
};

/** La franja del organismo, con el menú que corresponde al rol. */
export default function AppHeader() {
  const { me, config } = useGlobal();
  const router = useRouter();
  const pathname = usePathname();
  const links = LINKS[me.role];

  const active = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    if (href === "/gestion") return pathname === "/gestion" || pathname.startsWith("/gestion/presentaciones");
    return pathname.startsWith(href);
  };

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <header>
      <div className="bg-inst text-inst-text">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Escudo tiene={config.tieneEscudo} version={config.escudoVersion} />
            <span>
              <span className="block font-serif text-lg font-bold leading-tight">{config.organismo}</span>
              <span className="block text-sm opacity-90">Mesa de Entradas Virtual</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden opacity-90 sm:inline">{me.email}</span>
            <span className="rounded-full bg-inst-text/15 px-2 py-0.5 text-xs font-bold">{ROLE_LABEL[me.role]}</span>
            <button type="button" onClick={logout} className="rounded-md px-2 py-1 font-bold hover:bg-inst-text/10">Salir</button>
          </div>
        </div>
      </div>
      <nav aria-label="Principal" className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {links.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href, exact) ? "page" : undefined}
              className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-sm font-bold ${active(href, exact) ? "border-inst text-tinta" : "border-transparent text-muted hover:text-tinta"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
