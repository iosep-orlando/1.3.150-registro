import Link from "next/link";
import Escudo from "./Escudo";

/** La marca genérica, para las páginas sin cabecera (ingreso, bandeja). */
export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 self-start text-inst">
      <Escudo tiene={false} version={0} className="h-8 w-8" />
      <span className="font-serif text-lg font-bold text-tinta">Mesa de Entradas Virtual</span>
    </Link>
  );
}
