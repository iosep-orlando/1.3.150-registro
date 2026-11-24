"use client";

import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import type { TipoExpediente } from "@/lib/types";
import FormError from "./FormError";
import { buttonSecondary, input, label, linkButton, panel } from "./ui";

/**
 * Los tipos de expediente: nombre y prefijo (va en el código). No se
 * borran, porque hay expedientes que los nombran: se desactivan.
 */
export default function TiposManager({ initial }: { initial: TipoExpediente[] }) {
  const [tipos, setTipos] = useState(initial);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(request: () => Promise<TipoExpediente>, onDone?: () => void) {
    setPending(true);
    setError(null);
    try {
      const tipo = await request();
      setTipos((list) => {
        const exists = list.some((t) => t.id === tipo.id);
        return (exists ? list.map((t) => (t.id === tipo.id ? tipo : t)) : [...list, tipo]).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      });
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    void save(
      () => api<TipoExpediente>("/api/tipos", { method: "POST", json: { nombre, prefijo } }),
      () => {
        setNombre("");
        setPrefijo("");
      },
    );
  }

  return (
    <section className={`${panel} p-5`} aria-labelledby="tipos-title">
      <h2 id="tipos-title" className="titulo text-2xl">Tipos de expediente</h2>
      <p className="text-sm text-muted">Se ofrecen al abrir un expediente. El prefijo va en el código: EX-2026-00000001-SIGLA-PREFIJO.</p>
      <ul className="mt-4 divide-y divide-line rounded-md border border-line">
        {tipos.map((t) =>
          editing === t.id ? (
            <TipoEditor key={t.id} tipo={t} pending={pending} onCancel={() => setEditing(null)} onSave={(body) => save(() => api<TipoExpediente>(`/api/tipos/${t.id}`, { method: "PUT", json: body }), () => setEditing(null))} />
          ) : (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className={`min-w-0 flex-1 font-bold ${t.activo ? "" : "text-muted line-through"}`}>{t.nombre}</span>
              <span className="tabular rounded bg-hoja px-2 py-0.5 text-sm font-bold">{t.prefijo}</span>
              <button type="button" onClick={() => setEditing(t.id)} className={`${linkButton} text-sm`}>Editar</button>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(() => api<TipoExpediente>(`/api/tipos/${t.id}`, { method: "PUT", json: { ...t, activo: !t.activo } }))}
                className="text-sm font-bold text-muted hover:text-tinta"
              >
                {t.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ),
        )}
        {tipos.length === 0 && <li className="px-3 py-2 text-muted">Todavía no hay tipos.</li>}
      </ul>
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="t-nombre" className={label}>Nuevo tipo</label>
          <input id="t-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Licencia de obra" className={input} />
        </div>
        <div className="w-32">
          <label htmlFor="t-prefijo" className={label}>Prefijo</label>
          <input id="t-prefijo" value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} maxLength={8} placeholder="OBRAS" className={`${input} uppercase`} />
        </div>
        <button type="submit" disabled={pending || !nombre.trim() || !prefijo.trim()} className={buttonSecondary}>Agregar</button>
      </form>
      <div className="mt-3"><FormError message={error} /></div>
    </section>
  );
}

function TipoEditor({ tipo, pending, onSave, onCancel }: { tipo: TipoExpediente; pending: boolean; onSave: (body: { nombre: string; prefijo: string; activo: boolean }) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(tipo.nombre);
  const [prefijo, setPrefijo] = useState(tipo.prefijo);
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <label htmlFor={`n-${tipo.id}`} className="sr-only">Nombre</label>
      <input id={`n-${tipo.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className={`${input} min-w-48 flex-1 py-1`} />
      <label htmlFor={`p-${tipo.id}`} className="sr-only">Prefijo</label>
      <input id={`p-${tipo.id}`} value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} maxLength={8} className={`${input} w-28 py-1 uppercase`} />
      <button type="button" disabled={pending} onClick={() => onSave({ nombre, prefijo, activo: tipo.activo })} className={`${linkButton} text-sm`}>Guardar</button>
      <button type="button" onClick={onCancel} className="text-sm font-bold text-muted">Cancelar</button>
    </li>
  );
}
