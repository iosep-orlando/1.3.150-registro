// ---------------------------------------------------------------------------
// Qué se puede adjuntar a una presentación: PDF e imágenes (un DNI
// escaneado, una foto, un plano), hasta 5 archivos de 10 MB y 20 MB en
// total. El tipo se reconoce por los primeros bytes del archivo, no por el
// nombre ni por lo que diga el navegador: un .pdf que en realidad es HTML
// no pasa.
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export type FileType = "application/pdf" | "image/png" | "image/jpeg" | "image/gif" | "image/webp";

const starts = (bytes: Uint8Array, prefix: number[], offset = 0) => prefix.every((b, i) => bytes[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function detectFileType(bytes: Uint8Array): FileType | null {
  if (starts(bytes, ascii("%PDF-"))) return "application/pdf";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, ascii("GIF87a")) || starts(bytes, ascii("GIF89a"))) return "image/gif";
  if (starts(bytes, ascii("RIFF")) && starts(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

const EXTENSION: Record<FileType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Un nombre de archivo prolijo para la URL y la descarga: sin carpetas ni
 * caracteres raros, y con la extensión que corresponde al tipo real.
 */
export function cleanFilename(name: string, type: FileType): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "archivo"}.${EXTENSION[type]}`;
}

export function validateUpload(bytes: Uint8Array): { ok: true; type: FileType } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: "El archivo puede pesar hasta 10 MB." };
  const type = detectFileType(bytes);
  if (!type) return { ok: false, error: "Solo se pueden adjuntar PDF e imágenes (PNG, JPG, GIF o WebP)." };
  return { ok: true, type };
}


/** Revisa el conjunto de adjuntos de una presentación (cantidad y peso total). */
export function validateAttachmentSet(sizes: number[]): string | null {
  if (sizes.length > MAX_FILES) return `Hasta ${MAX_FILES} archivos por presentación.`;
  if (sizes.reduce((a, b) => a + b, 0) > MAX_TOTAL_BYTES) return "Entre todos, los archivos pueden pesar hasta 20 MB.";
  return null;
}
