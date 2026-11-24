"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/fetcher";
import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { CARACTER_LABEL } from "@/lib/tramite";
import { MAX_EXPONE, MAX_SOLICITA } from "@/lib/validation";
import type { Caracter, Persona, RegistroDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, hint, input, label, panel } from "./ui";

const EMPTY: Persona = { nombre: "", cuit: "", domicilio: "" };

function PersonaFields({ id, value, onChange }: { id: string; value: Persona; onChange: (p: Persona) => void }) {
  const set = (field: keyof Persona) => (e: { target: { value: string } }) => onChange({ ...value, [field]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-nombre`} className={label}>Nombre y apellido, o razón social</label>
        <input id={`${id}-nombre`} required maxLength={150} value={value.nombre} onChange={set("nombre")} autoComplete={id === "int" ? "name" : "off"} className={input} />
      </div>
      <div>
        <label htmlFor={`${id}-cuit`} className={label}>CUIT o CUIL</label>
        <input id={`${id}-cuit`} required inputMode="numeric" value={value.cuit} onChange={set("cuit")} placeholder="20-12345678-6" className={`${input} tabular`} />
        <p className={hint}>Se controla el dígito verificador.</p>
      </div>
      <div>
        <label htmlFor={`${id}-dom`} className={label}>Domicilio fiscal</label>
        <input id={`${id}-dom`} required maxLength={200} value={value.domicilio} onChange={set("domicilio")} autoComplete={id === "int" ? "street-address" : "off"} className={input} />
      </div>
    </div>
  );
}

/**
 * La instancia general: interesado, representante (opcional), expone,
 * solicita y adjuntos. Va como un formulario multipart: los datos en JSON
 * y los archivos aparte; el servidor los sube al bucket.
 */
export default function PresentacionForm({ ultimoInteresado }: { ultimoInteresado: Persona | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [interesado, setInteresado] = useState<Persona>(ultimoInteresado ?? EMPTY);
  const [conRepresentante, setConRepresentante] = useState(false);
  const [representante, setRepresentante] = useState<Persona>(EMPTY);
  const [caracter, setCaracter] = useState<Caracter>("apoderado");
  const [expone, setExpone] = useState("");
  const [solicita, setSolicita] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next.js 16 esconde la página en vez de cerrarla: al volver, de cero.
  useLayoutEffect(
    () => () => {
      setExpone("");
      setSolicita("");
      setFiles([]);
      setConRepresentante(false);
      setError(null);
      setPending(false);
    },
    [],
  );

  const total = files.reduce((sum, f) => sum + f.size, 0);

  function addFiles(list: FileList | null) {
    setError(null);
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) return setError(`«${file.name}» pesa más de 10 MB.`);
      next.push(file);
    }
    if (next.length > MAX_FILES) return setError(`Hasta ${MAX_FILES} archivos por presentación.`);
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return setError("Entre todos, los archivos pueden pesar hasta 20 MB.");
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set(
      "datos",
      JSON.stringify({ interesado, representante: conRepresentante ? { ...representante, caracter } : null, expone, solicita }),
    );
    for (const file of files) form.append("adjuntos", file);
    try {
      const response = await fetch("/api/registros", { method: "POST", body: form });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "No se pudo registrar la presentación.");
      router.push(`/tramites/${(data as RegistroDTO).id}?nueva=1`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6" aria-label="Nueva presentación">
      <fieldset className={`${panel} p-5`}>
        <legend className="px-1 font-serif text-xl font-bold">Interesado</legend>
        <p className="mb-4 text-sm text-muted">La persona o empresa a nombre de quien se hace el trámite.</p>
        <PersonaFields id="int" value={interesado} onChange={setInteresado} />
        <label className="mt-5 flex items-start gap-3">
          <input type="checkbox" checked={conRepresentante} onChange={(e) => setConRepresentante(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--inst)]" />
          <span>
            <span className="font-bold">Presento por medio de un representante</span>
            <span className="block text-sm text-muted">Un apoderado, el representante legal de una empresa o un gestor.</span>
          </span>
        </label>
      </fieldset>

      {conRepresentante && (
        <fieldset className={`${panel} p-5`}>
          <legend className="px-1 font-serif text-xl font-bold">Representante</legend>
          <div className="mb-4 mt-1 max-w-xs">
            <label htmlFor="caracter" className={label}>Actúa como</label>
            <select id="caracter" value={caracter} onChange={(e) => setCaracter(e.target.value as Caracter)} className={input}>
              {(Object.keys(CARACTER_LABEL) as Caracter[]).map((c) => <option key={c} value={c}>{CARACTER_LABEL[c]}</option>)}
            </select>
          </div>
          <PersonaFields id="rep" value={representante} onChange={setRepresentante} />
        </fieldset>
      )}

      <fieldset className={`${panel} space-y-4 p-5`}>
        <legend className="px-1 font-serif text-xl font-bold">La nota</legend>
        <div>
          <label htmlFor="expone" className={label}>Expone</label>
          <textarea id="expone" required rows={6} maxLength={MAX_EXPONE} value={expone} onChange={(e) => setExpone(e.target.value)} placeholder="Los hechos y el motivo de la presentación." className={input} />
          <p className={`${hint} tabular`}>{expone.length.toLocaleString("es-AR")} / {MAX_EXPONE.toLocaleString("es-AR")}</p>
        </div>
        <div>
          <label htmlFor="solicita" className={label}>Solicita</label>
          <textarea id="solicita" required rows={3} maxLength={MAX_SOLICITA} value={solicita} onChange={(e) => setSolicita(e.target.value)} placeholder="Qué le pedís al organismo." className={input} />
        </div>
      </fieldset>

      <fieldset className={`${panel} p-5`}>
        <legend className="px-1 font-serif text-xl font-bold">Documentación adjunta</legend>
        <p className="mb-3 text-sm text-muted">PDF o imágenes (PNG, JPG, GIF o WebP). Hasta {MAX_FILES} archivos de 10 MB, 20 MB en total.</p>
        {files.length > 0 && (
          <ul className="mb-3 divide-y divide-line rounded-md border border-line">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                  {formatBytes(f.size)}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} className="rounded px-2 py-1 font-bold text-error hover:bg-error/5">Quitar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-inst px-4 py-2 font-bold text-inst hover:bg-inst/5">
          Agregar archivos
          <input ref={fileRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/gif,image/webp" onChange={(e) => addFiles(e.target.files)} className="sr-only" disabled={files.length >= MAX_FILES} />
        </label>
        {files.length > 0 && <span className="ml-3 text-sm text-muted">{formatBytes(total)} en total</span>}
      </fieldset>

      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`${button} px-6 py-3 text-lg`}>
          {pending ? "Registrando…" : "Presentar"}
        </button>
        <p className="text-sm text-muted">Al presentar recibís el justificante con número, fecha y hora. Después no se puede modificar.</p>
      </div>
    </form>
  );
}
