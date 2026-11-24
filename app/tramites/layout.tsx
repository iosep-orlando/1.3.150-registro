import { Suspense } from "react";
import { AppShell, ShellFallback } from "@/components/AppShell";
import { pageUser } from "@/lib/page-auth";
import { notFound } from "next/navigation";

// La zona del administrado. proxy.ts manda a los funcionarios a /gestion;
// acá se confirma el rol con la base.
export default function TramitesLayout({ children }: LayoutProps<"/tramites">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const caller = await pageUser();
  if (caller.role !== "administrado") notFound();
  return <AppShell caller={caller}>{children}</AppShell>;
}
