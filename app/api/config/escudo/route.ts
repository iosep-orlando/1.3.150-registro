import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { detectFileType } from "@/lib/files";
import { getConfigDoc, setEscudo } from "@/lib/store/config";
import { STORAGE_DOWN, deleteObject, escudoKey, presignedDownload, putObject } from "@/lib/storage";

const MAX_ESCUDO_BYTES = 1024 * 1024;

/** El escudo es público (sale en la home): redirige a una URL prefirmada del bucket. */
export const GET = handle(async () => {
  const config = await getConfigDoc();
  if (!config.escudo) throw new ApiError(404, "No hay escudo cargado.");
  try {
    const url = await presignedDownload(config.escudo.key, "escudo", config.escudo.contentType, true);
    return Response.redirect(url, 302);
  } catch (error) {
    console.error("Escudo", error);
    throw new ApiError(503, STORAGE_DOWN);
  }
});

/**
 * Subir o cambiar el escudo: PNG o JPG de hasta 1 MB (los que entran en el
 * PDF del justificante). El archivo va como cuerpo de la petición.
 */
export const PUT = handle(async (request: Request) => {
  await requireFuncionario();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_ESCUDO_BYTES) throw new ApiError(413, "El escudo puede pesar hasta 1 MB.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) throw new ApiError(400, "El archivo está vacío.");
  if (bytes.length > MAX_ESCUDO_BYTES) throw new ApiError(413, "El escudo puede pesar hasta 1 MB.");
  const type = detectFileType(bytes);
  if (type !== "image/png" && type !== "image/jpeg") throw new ApiError(400, "El escudo tiene que ser una imagen PNG o JPG.");
  try {
    await putObject(escudoKey(), bytes, type);
  } catch (error) {
    console.error("Escudo", error);
    throw new ApiError(503, STORAGE_DOWN);
  }
  return Response.json(await setEscudo({ key: escudoKey(), contentType: type, updatedAt: new Date() }));
});

export const DELETE = handle(async () => {
  await requireFuncionario();
  await deleteObject(escudoKey()).catch((error) => console.error("Escudo", error));
  return Response.json(await setEscudo(null));
});
