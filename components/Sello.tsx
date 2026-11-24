import { fechaHoraAR } from "@/lib/justificante";

/**
 * El sello de cargo de la mesa de entradas: sigla del organismo,
 * «RECIBIDO», fecha y hora, y el número. Con `golpe`, aparece una sola vez
 * con el movimiento del sello.
 */
export default function Sello({ sigla, fecha, numero, golpe = false }: { sigla: string; fecha: Date; numero: string; golpe?: boolean }) {
  const [dia, hora] = fechaHoraAR(fecha).split(" ");
  return (
    <div className={`sello ${golpe ? "sello-golpe" : ""} inline-block bg-white/40 px-5 py-3 text-center font-serif`} role="img" aria-label={`Sello de recibido: ${numero}, ${dia} ${hora}`}>
      <p className="text-xs font-bold tracking-[0.25em]">{sigla} · MESA DE ENTRADAS</p>
      <p className="my-1 border-y-2 border-current py-1 text-2xl font-black tracking-[0.2em]">RECIBIDO</p>
      <p className="tabular text-lg font-bold">{dia}</p>
      <p className="tabular text-sm">{hora} h</p>
      <p className="tabular mt-1 text-xs font-bold">{numero}</p>
    </div>
  );
}
