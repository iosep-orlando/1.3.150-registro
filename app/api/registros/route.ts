import { requireUser } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES, validateAttachmentSet, validateUpload } from "@/lib/files";
import { createRegistro, listAll, listMine, type RegistroFilter, type Upload } from "@/lib/store/registros";
import { validatePresentacion } from "@/lib/validation";

const FILTERS: RegistroFilter[] = ["todas", "sin_expediente", "con_expediente"];

/**
 * El rol define la consulta: el administrado recibe solo las suyas; el
 * funcionario, todas (con ?filtro= y ?q=).
 */
export const GET = handle(async (request: Request) => {
  const caller = await requireUser();
  if (caller.role === "administrado") return Response.json({ registros: await listMine(caller.userId) });
  const params = new URL(request.url).searchParams;
  const raw = params.get("filtro") ?? "todas";
  const filter = FILTERS.includes(raw as RegistroFilter) ? (raw as RegistroFilter) : "todas";
  return Response.json({ registros: await listAll(filter, params.get("q") ?? "") });
});

/**
 * Presentar una instancia general: un formulario multipart con "datos" (el
 * JSON de la presentación) y los archivos en "adjuntos".
 */
export const POST = handle(async (request: Request) => {
  const caller = await requireUser();
  if (caller.role !== "administrado") throw new ApiError(403, "Las presentaciones las hacen los administrados, no los funcionarios.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_TOTAL_BYTES + 1024 * 1024) {
    throw new ApiError(413, "Entre todos, los archivos pueden pesar hasta 20 MB.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "El formulario no llegó bien. Probá de nuevo.");
  }
  let datos: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(String(form.get("datos") ?? ""));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    datos = parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Faltan los datos de la presentación.");
  }
  const input = validatePresentacion(datos);
  if (!input.ok) throw new ApiError(400, input.error);

  const files = form.getAll("adjuntos").filter((f): f is File => f instanceof File && f.size > 0);
  const setError = validateAttachmentSet(files.map((f) => f.size));
  if (setError) throw new ApiError(400, setError);
  const uploads: Upload[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new ApiError(413, `«${file.name}» pesa más de 10 MB.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid = validateUpload(bytes);
    if (!valid.ok) throw new ApiError(400, `«${file.name}»: ${valid.error}`);
    uploads.push({ name: file.name, type: valid.type, bytes });
  }
  return Response.json(await createRegistro(caller, input.value, uploads), { status: 201 });
});
