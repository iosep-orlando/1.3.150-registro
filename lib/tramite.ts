import type { Caracter, ExpedienteEstado, HomeConfig } from "./types";

// ---------------------------------------------------------------------------
// Las reglas del trámite que no tocan la base: cómo se numeran las
// presentaciones y los expedientes, qué estados hay y cómo se pasa de uno a
// otro, y el color institucional.
// ---------------------------------------------------------------------------

/** "RE-2026-00000042": número de presentación (registro de entrada), correlativo por año. */
export function registroNumero(year: number, seq: number): string {
  return `RE-${year}-${String(seq).padStart(8, "0")}`;
}

/**
 * "EX-2026-00000007-VOMB-OBRAS": año, número correlativo del año, la sigla
 * del organismo y el prefijo del tipo de expediente. El mismo espíritu que
 * los expedientes electrónicos de la administración argentina.
 */
export function expedienteCodigo(year: number, seq: number, sigla: string, prefijo: string): string {
  return `EX-${year}-${String(seq).padStart(8, "0")}-${sigla}-${prefijo}`;
}

/** El año en Argentina (a las 22 h del 31/12 en Buenos Aires, en UTC ya es el año siguiente). */
export function yearAR(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(now));
}

export const ESTADO_LABEL: Record<ExpedienteEstado, string> = {
  en_tramite: "En trámite",
  resuelto: "Resuelto",
  archivado: "Archivado",
};

/**
 * En trámite → Resuelto → Archivado. Un resuelto se puede reabrir (vuelve a
 * En trámite); un archivado es definitivo.
 */
export const TRANSICIONES: Record<ExpedienteEstado, ExpedienteEstado[]> = {
  en_tramite: ["resuelto"],
  resuelto: ["en_tramite", "archivado"],
  archivado: [],
};

export function canMove(from: ExpedienteEstado, to: ExpedienteEstado): boolean {
  return TRANSICIONES[from].includes(to);
}

/** Solo se actúa sobre un expediente que no está archivado. */
export const canAct = (estado: ExpedienteEstado) => estado !== "archivado";

/** El texto que queda como actuación al cambiar de estado. */
export function estadoActuacion(to: ExpedienteEstado, motivo: string): string {
  const base = to === "en_tramite" ? "Se reabre el expediente." : `El expediente pasa a ${ESTADO_LABEL[to].toLowerCase()}.`;
  return motivo ? `${base} ${motivo}` : base;
}

export const CARACTER_LABEL: Record<Caracter, string> = {
  apoderado: "Apoderado/a",
  representante_legal: "Representante legal",
  gestor: "Gestor/a",
};

// --- Color institucional --------------------------------------------------------------

/** "#2f5d50" → [47, 93, 80]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (WCAG 2). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** El texto que va encima del color: blanco o casi negro, el que se lea mejor. */
export function textOn(color: string): string {
  return contrast(color, "#ffffff") >= contrast(color, "#14181f") ? "#ffffff" : "#14181f";
}

/**
 * El color se usa en botones con texto encima y en títulos sobre blanco:
 * tiene que tener al menos 4,5:1 contra el blanco (WCAG AA).
 */
export const MIN_CONTRAST = 4.5;

export const DEFAULT_CONFIG: Omit<HomeConfig, "tieneEscudo" | "escudoVersion"> = {
  organismo: "Municipalidad de Villa Ombúes",
  sigla: "VOMB",
  bienvenida:
    "Desde acá podés presentar notas y solicitudes a la Municipalidad sin ir a la Mesa de Entradas: completás el formulario, adjuntás la documentación y recibís el comprobante al instante.",
  avisos: "Los trámites presentados después de las 14\u00a0h se registran con la fecha y hora reales, pero se empiezan a tratar el día hábil siguiente.",
  horario: "Atención presencial: lunes a viernes de 8 a 14\u00a0h.",
  contacto: "mesadeentradas@villaombues.example",
  color: "#2f5d50",
};
