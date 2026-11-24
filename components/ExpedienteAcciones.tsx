"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import { ESTADO_LABEL, TRANSICIONES, canAct } from "@/lib/tramite";
import type { ExpedienteDTO, ExpedienteEstado } from "@/lib/types";
import FormError from "./FormError";
import { button, buttonDanger, buttonSecondary, input, label, panel } from "./ui";

const ACCION: Record<ExpedienteEstado, string> = {
  en_tramite: "Reabrir",
  resuelto: "Marcar como resuelto",
  archivado: "Archivar",
};

/**
 * Tramitar el expediente: agregar actuaciones (visibles para el ciudadano o
 * internas) y cambiar el estado. Cada cambio de estado queda como
 * actuación visible.
 */
export default function ExpedienteAcciones({ expediente }: { expediente: ExpedienteDTO }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [visible, setVisible] = useState(true);
  const [destino, setDestino] = useState<ExpedienteEstado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function run(request: () => Promise<unknown>, done: string) {
    setPending(true);
    setError(null);
    setAviso(null);
    try {
      await request();
      setAviso(done);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function actuar(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await api(`/api/expedientes/${expediente.id}/actuaciones`, { method: "POST", json: { texto, visible } });
      setTexto("");
    }, visible ? "Actuación agregada. Al ciudadano le llegó el aviso." : "Actuación interna agregada.");
  }

  function mover(event: FormEvent) {
    event.preventDefault();
    if (!destino) return;
    void run(async () => {
      await api(`/api/expedientes/${expediente.id}/estado`, { method: "POST", json: { estado: destino, motivo } });
      setDestino(null);
      setMotivo("");
    }, `El expediente quedó ${ESTADO_LABEL[destino].toLowerCase()}.`);
  }

  const transiciones = TRANSICIONES[expediente.estado];

  return (
    <div className="space-y-4">
      {canAct(expediente.estado) ? (
        <form onSubmit={actuar} className={`${panel} space-y-3 p-5`} aria-label="Nueva actuación">
          <h2 className="titulo text-xl">Nueva actuación</h2>
          <div>
            <label htmlFor="texto" className={label}>Texto</label>
            <textarea id="texto" rows={4} maxLength={3000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por ejemplo: se solicita al área de Obras un informe técnico." className={input} />
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--inst)]" />
            <span>
              <span className="font-bold">Visible para el ciudadano</span>
              <span className="block text-sm text-muted">La ve en Mis trámites y le llega un aviso por mail. Si no, queda como nota interna.</span>
            </span>
          </label>
          <button type="submit" disabled={pending || !texto.trim()} className={button}>{pending ? "Guardando…" : "Agregar actuación"}</button>
        </form>
      ) : (
        <p className={`${panel} p-5 text-muted`}>El expediente está archivado: ya no admite actuaciones.</p>
      )}

      {transiciones.length > 0 && (
        <section className={`${panel} space-y-3 p-5`} aria-labelledby="estado-title">
          <h2 id="estado-title" className="titulo text-xl">Estado</h2>
          {destino ? (
            <form onSubmit={mover} className="space-y-3">
              <div>
                <label htmlFor="motivo" className={label}>
                  {ACCION[destino]}: motivo (opcional, lo ve el ciudadano)
                </label>
                <textarea id="motivo" rows={2} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={input} />
              </div>
              {destino === "archivado" && <p className="text-sm font-bold text-error">Un expediente archivado ya no se puede reabrir ni recibir actuaciones.</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className={destino === "archivado" ? buttonDanger : button}>{pending ? "Guardando…" : `Sí, ${ACCION[destino].toLowerCase()}`}</button>
                <button type="button" onClick={() => setDestino(null)} className={buttonSecondary}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transiciones.map((t) => (
                <button key={t} type="button" onClick={() => setDestino(t)} className={t === "archivado" ? buttonDanger : buttonSecondary}>{ACCION[t]}</button>
              ))}
            </div>
          )}
        </section>
      )}
      {aviso && <p role="status" className="rounded-md border border-ok/40 bg-ok/5 px-3 py-2 text-sm font-bold text-ok">{aviso}</p>}
      <FormError message={error} />
    </div>
  );
}
