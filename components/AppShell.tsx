import { Suspense } from "react";
import { GlobalProvider } from "@/lib/context/GlobalContext";
import type { Caller } from "@/lib/auth";
import { getHomeConfig } from "@/lib/store/config";
import AppHeader from "./AppHeader";

/** La cabecera y el estado global, iguales para /tramites y /gestion. */
export async function AppShell({ caller, children }: { caller: Caller; children: React.ReactNode }) {
  const config = await getHomeConfig();
  const me = { id: caller.userId.toString(), email: caller.email, name: caller.name, role: caller.role };
  return (
    <GlobalProvider value={{ me, config }}>
      {/* usePathname depende de la URL: va en Suspense. */}
      <Suspense fallback={<ShellFallback />}>
        <AppHeader />
      </Suspense>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </GlobalProvider>
  );
}

export function ShellFallback() {
  return <div className="h-28 bg-inst" />;
}
