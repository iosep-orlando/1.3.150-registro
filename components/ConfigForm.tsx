"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import { MIN_CONTRAST, contrast, textOn } from "@/lib/tramite";
import { normalizeColor } from "@/lib/validation";
import type { HomeConfig } from "@/lib/types";
import Escudo from "./Escudo";
import FormError from "./FormError";
import { button, buttonDanger, buttonSecondary, hint, input, label, panel } from "./ui";

/**
 * Lo que el funcionario personaliza de la home (modo SaaS): textos, color
 * institucional y escudo. La vista previa muestra la franja con el color
 * elegido; si el texto blanco no se leería, avisa antes de guardar.
 */
export default function ConfigForm({ initial }: { initial: HomeConfig }) {
  const router = useRouter();
  const [form, setForm] = useState({
    organismo: initial.organismo,
    sigla: initial.sigla,
    bienvenida: initial.bienvenida,
    avisos: initial.avisos,
    horario: initial.horario,
    contacto: initial.contacto,
    color: initial.color,
  });
  const [escudo, setEscudo] = useState({ tiene: initial.tieneEscudo, version: initial.escudoVersion });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const color = normalizeColor(form.color);
  const ratio = color ? contrast(color, "#ffffff") : 0;
  const ratioText = ratio.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const minText = MIN_CONTRAST.toLocaleString("es-AR");
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api<HomeConfig>("/api/config", { method: "PUT", json: form });
      setSaved(true);
      router.refresh(); // el color nuevo se aplica a toda la app
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function uploadEscudo(file: File) {
    setError(null);
    setPending(true);
    try {
      const config = await api<HomeConfig>("/api/config/escudo", { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      setEscudo({ tiene: config.tieneEscudo, version: config.escudoVersion });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeEscudo() {
    setPending(true);
    try {
      await api("/api/config/escudo", { method: "DELETE" });
      setEscudo({ tiene: false, version: 0 });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${panel} space-y-5 p-5`} aria-labelledby="home-title">
      <div>
        <h2 id="home-title" className="titulo text-2xl">La home</h2>
        <p className="text-sm text-muted">Lo que ve cualquiera que entra. Se aplica apenas guardás.</p>
      </div>

      {/* Vista previa de la franja */}
      <div className="overflow-hidden rounded-md border border-line" aria-label="Vista previa">
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: color ?? "#888", color: color ? textOn(color) : "#fff" }}>
          <Escudo tiene={escudo.tiene} version={escudo.version} className="h-10 w-10" />
          <div>
            <p className="font-serif text-lg font-bold leading-tight">{form.organismo || "Nombre del organismo"}</p>
            <p className="text-sm opacity-90">Mesa de Entradas Virtual</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <label htmlFor="organismo" className={label}>Nombre del organismo</label>
          <input id="organismo" required maxLength={100} value={form.organismo} onChange={set("organismo")} className={input} />
        </div>
        <div>
          <label htmlFor="sigla" className={label}>Sigla</label>
          <input id="sigla" required maxLength={8} value={form.sigla} onChange={(e) => set("sigla")({ target: { value: e.target.value.toUpperCase() } })} className={`${input} tabular uppercase`} />
          <p className={hint}>Va en los códigos de expediente.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="color" className={label}>Color institucional</label>
          <div className="flex items-center gap-2">
            <input type="color" aria-label="Elegir el color" value={color ?? "#2f5d50"} onChange={set("color")} className="h-10 w-14 cursor-pointer rounded border border-line" />
            <input id="color" value={form.color} onChange={set("color")} className={`${input} tabular w-32`} />
          </div>
        </div>
        <p className={`text-sm ${color && ratio >= MIN_CONTRAST ? "text-ok" : "text-error"}`} aria-live="polite">
          {!color
            ? "Formato #RRGGBB."
            : ratio >= MIN_CONTRAST
              ? `Contraste con el blanco: ${ratioText} a 1. Se lee bien.`
              : `Contraste con el blanco: ${ratioText} a 1. Muy claro: hace falta al menos ${minText} a 1.`}
        </p>
      </div>

      <div>
        <span className={label}>Escudo</span>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${buttonSecondary} cursor-pointer`}>
            {escudo.tiene ? "Cambiar escudo" : "Subir escudo"}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" disabled={pending} onChange={(e) => e.target.files?.[0] && uploadEscudo(e.target.files[0])} className="sr-only" />
          </label>
          {escudo.tiene && <button type="button" onClick={removeEscudo} disabled={pending} className={buttonDanger}>Quitar</button>}
          <span className={hint}>PNG o JPG de hasta 1 MB. Se guarda en el bucket y sale también en el justificante.</span>
        </div>
      </div>

      <div>
        <label htmlFor="bienvenida" className={label}>Bienvenida</label>
        <textarea id="bienvenida" required rows={3} maxLength={1000} value={form.bienvenida} onChange={set("bienvenida")} className={input} />
      </div>
      <div>
        <label htmlFor="avisos" className={label}>Avisos (uno por renglón)</label>
        <textarea id="avisos" rows={3} maxLength={1500} value={form.avisos} onChange={set("avisos")} className={input} />
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="horario" className={label}>Horario</label>
          <input id="horario" maxLength={300} value={form.horario} onChange={set("horario")} className={input} />
        </div>
        <div>
          <label htmlFor="contacto" className={label}>Contacto</label>
          <input id="contacto" maxLength={300} value={form.contacto} onChange={set("contacto")} className={input} />
        </div>
      </div>

      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={button}>{pending ? "Guardando…" : "Guardar la home"}</button>
        {saved && <span role="status" className="text-sm font-bold text-ok">✓ Guardado</span>}
        <a href="/" target="_blank" rel="noreferrer" className="text-sm font-bold text-inst hover:underline">Ver la home</a>
      </div>
    </form>
  );
}
