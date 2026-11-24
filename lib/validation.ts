import { MIN_CONTRAST, contrast } from "./tramite";
import type { Caracter, ExpedienteEstado, HomeConfig, Persona, Representante } from "./types";

// ---------------------------------------------------------------------------
// Validación de todo lo que llega del navegador. El navegador también
// valida, para avisar antes, pero la que vale es esta.
// ---------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
/** Texto largo: sin espacios a los costados y con finales de línea de Unix. */
const longText = (value: unknown) => text(value).replace(/\r\n/g, "\n");

// --- Email ------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function normalizeEmail(value: unknown): string {
  return text(value).toLowerCase();
}

export function validateEmail(value: unknown): Result<string> {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email) || email.length > 254) return fail("Ese email no parece válido.");
  return ok(email);
}

// --- CUIT / CUIL --------------------------------------------------------------------

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIXES = ["20", "23", "24", "25", "26", "27", "30", "33", "34"];

/** Solo los dígitos: "20-12345678-6" → "20123456786". */
export const digits = (value: unknown) => text(value).replace(/[\s.-]/g, "");

/**
 * CUIT (empresas y monotributistas) y CUIL (trabajadores) tienen el mismo
 * formato: 2 dígitos de tipo, 8 del documento y uno verificador (módulo 11),
 * como los controla ARCA. Un error de tipeo no pasa.
 */
export function isValidCuit(value: string): boolean {
  if (!/^\d{11}$/.test(value) || !PREFIXES.includes(value.slice(0, 2))) return false;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(value[i]), 0);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check;
  return expected !== 10 && expected === Number(value[10]);
}

/** "20123456786" → "20-12345678-6". */
export function formatCuit(value: string): string {
  return /^\d{11}$/.test(value) ? `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}` : value;
}

// --- Personas -------------------------------------------------------------------------

export function validatePersona(raw: unknown, quien: "del interesado" | "del representante"): Result<Persona> {
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const nombre = text(body.nombre);
  if (!nombre) return fail(`Falta el nombre o la razón social ${quien}.`);
  if (nombre.length > 150) return fail(`El nombre ${quien} puede tener hasta 150 caracteres.`);
  const cuit = digits(body.cuit);
  if (!isValidCuit(cuit)) return fail(`El CUIT/CUIL ${quien} no es válido: revisá los 11 números.`);
  const domicilio = text(body.domicilio);
  if (!domicilio) return fail(`Falta el domicilio fiscal ${quien}.`);
  if (domicilio.length > 200) return fail(`El domicilio ${quien} puede tener hasta 200 caracteres.`);
  return ok({ nombre, cuit, domicilio });
}

const CARACTERES: Caracter[] = ["apoderado", "representante_legal", "gestor"];

export function validateRepresentante(raw: unknown): Result<Representante | null> {
  if (raw === null || raw === undefined) return ok(null);
  const persona = validatePersona(raw, "del representante");
  if (!persona.ok) return persona;
  const caracter = (raw as Record<string, unknown>).caracter;
  if (!CARACTERES.includes(caracter as Caracter)) return fail("Elegí en qué carácter actúa el representante.");
  return ok({ ...persona.value, caracter: caracter as Caracter });
}

// --- Presentación (instancia general) ---------------------------------------------------------

export const MAX_EXPONE = 5000;
export const MAX_SOLICITA = 2000;

export interface PresentacionInput {
  interesado: Persona;
  representante: Representante | null;
  expone: string;
  solicita: string;
}

export function validatePresentacion(body: Record<string, unknown>): Result<PresentacionInput> {
  const interesado = validatePersona(body.interesado, "del interesado");
  if (!interesado.ok) return interesado;
  const representante = validateRepresentante(body.representante);
  if (!representante.ok) return representante;
  if (representante.value && representante.value.cuit === interesado.value.cuit) {
    return fail("El representante no puede ser el mismo interesado. Si presentás por vos, sacá el representante.");
  }
  const expone = longText(body.expone);
  if (!expone) return fail("Falta lo que exponés: los hechos o el motivo de la presentación.");
  if (expone.length > MAX_EXPONE) return fail(`«Expone» puede tener hasta ${MAX_EXPONE} caracteres.`);
  const solicita = longText(body.solicita);
  if (!solicita) return fail("Falta lo que solicitás.");
  if (solicita.length > MAX_SOLICITA) return fail(`«Solicita» puede tener hasta ${MAX_SOLICITA} caracteres.`);
  return ok({ interesado: interesado.value, representante: representante.value, expone, solicita });
}

// --- Expedientes ----------------------------------------------------------------------------

export function validateActuacion(body: Record<string, unknown>): Result<{ texto: string; visible: boolean }> {
  const texto = longText(body.texto);
  if (!texto) return fail("Escribí la actuación.");
  if (texto.length > 3000) return fail("La actuación puede tener hasta 3000 caracteres.");
  return ok({ texto, visible: body.visible === true });
}

const ESTADOS: ExpedienteEstado[] = ["en_tramite", "resuelto", "archivado"];

export function validateEstado(body: Record<string, unknown>): Result<{ estado: ExpedienteEstado; motivo: string }> {
  if (!ESTADOS.includes(body.estado as ExpedienteEstado)) return fail("Ese estado no existe.");
  const motivo = longText(body.motivo);
  if (motivo.length > 1000) return fail("El motivo puede tener hasta 1000 caracteres.");
  return ok({ estado: body.estado as ExpedienteEstado, motivo });
}

const SIGLA_RE = /^[A-Z]{2,8}$/;

export function validateTipo(body: Record<string, unknown>): Result<{ nombre: string; prefijo: string; activo: boolean }> {
  const nombre = text(body.nombre);
  if (!nombre) return fail("Falta el nombre del tipo de expediente.");
  if (nombre.length > 80) return fail("El nombre puede tener hasta 80 caracteres.");
  const prefijo = text(body.prefijo).toUpperCase();
  if (!SIGLA_RE.test(prefijo)) return fail("El prefijo son de 2 a 8 letras, sin tildes ni números (por ejemplo, OBRAS).");
  return ok({ nombre, prefijo, activo: body.activo !== false });
}

// --- Configuración de la home ---------------------------------------------------------------

export type ConfigInput = Omit<HomeConfig, "tieneEscudo" | "escudoVersion">;

export function normalizeColor(value: unknown): string | null {
  const hex = text(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  return null;
}

export function validateConfig(body: Record<string, unknown>): Result<ConfigInput> {
  const organismo = text(body.organismo);
  if (!organismo) return fail("Falta el nombre del organismo.");
  if (organismo.length > 100) return fail("El nombre del organismo puede tener hasta 100 caracteres.");
  const sigla = text(body.sigla).toUpperCase();
  if (!SIGLA_RE.test(sigla)) return fail("La sigla son de 2 a 8 letras, sin tildes ni números (por ejemplo, VOMB).");
  const fields = { bienvenida: 1000, avisos: 1500, horario: 300, contacto: 300 } as const;
  const out: Record<string, string> = {};
  for (const [field, max] of Object.entries(fields)) {
    out[field] = longText(body[field]);
    if (out[field].length > max) return fail(`«${field[0].toUpperCase()}${field.slice(1)}» puede tener hasta ${max} caracteres.`);
  }
  if (!out.bienvenida) return fail("Falta el texto de bienvenida.");
  const color = normalizeColor(body.color);
  if (!color) return fail("El color va en formato #RRGGBB.");
  if (contrast(color, "#ffffff") < MIN_CONTRAST) {
    return fail("Ese color es muy claro: el texto blanco encima no se leería. Elegí uno más oscuro.");
  }
  return ok({ organismo, sigla, bienvenida: out.bienvenida, avisos: out.avisos, horario: out.horario, contacto: out.contacto, color });
}
