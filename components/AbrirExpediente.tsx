"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import type { ExpedienteDTO, TipoExpediente } from "@/lib/types";
import FormError from "./FormError";
import { button, input, label, linkButton, panel } from "./ui";

/** Abrir el expediente de una presentación: el funcionario elige el tipo. */
export default function AbrirExpediente({ registroId, tipos }: { registroId: string; tipos: TipoExpediente[] }) {
  const router = useRouter();
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const expediente = await api<ExpedienteDTO>(`/api/registros/${registroId}/expediente`, { method: "POST", json: { tipoId } });
      router.push(`/gestion/expedientes/${expediente.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (tipos.length === 0) {
    return (
      <p className={`${panel} p-5`}>
        Para abrir expedientes primero cargá al menos un tipo en <a href="/gestion/configuracion" className={linkButton}>Configuración</a>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`${panel} space-y-3 p-5`} aria-label="Abrir expediente">
      <h2 className="titulo text-xl">Abrir expediente</h2>
      <p className="text-sm text-muted">Recibe el próximo número del año y queda unido a esta presentación. Al ciudadano le llega un aviso.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="tipo" className={label}>Tipo de expediente</label>
          <select id="tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={input}>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.prefijo})</option>)}
          </select>
        </div>
        <button type="submit" disabled={pending || !tipoId} className={button}>{pending ? "Abriendo…" : "Abrir expediente"}</button>
      </div>
      <FormError message={error} />
    </form>
  );
}
