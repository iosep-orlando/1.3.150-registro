import { Suspense } from "react";
import { AppShell, ShellFallback } from "@/components/AppShell";
import { pageFuncionario } from "@/lib/page-auth";

// La zona del funcionario. proxy.ts ya frena a los administrados; acá se
// confirma el rol con la base.
export default function GestionLayout({ children }: LayoutProps<"/gestion">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const caller = await pageFuncionario();
  return <AppShell caller={caller}>{children}</AppShell>;
}
