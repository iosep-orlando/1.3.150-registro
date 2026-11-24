import { MongoClient, ObjectId, type Db, type WithId } from "mongodb";
import type {
  ActuacionDTO,
  ExpedienteDTO,
  ExpedienteEstado,
  HomeConfig,
  Persona,
  RegistroDTO,
  Representante,
  Role,
  TipoExpediente,
} from "./types";

// ---------------------------------------------------------------------------
// MongoDB: UN cliente por proceso (singleton), las colecciones y sus índices.
// Ninguna ruta crea su propio MongoClient: todas pasan por collections().
// ---------------------------------------------------------------------------

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta la variable de entorno "MONGODB_URI"');
  // En globalThis: en desarrollo la recarga en caliente vuelve a ejecutar
  // los módulos, y sin esto abriría una conexión nueva en cada cambio.
  global._mongoClientPromise ??= new MongoClient(uri).connect();
  return global._mongoClientPromise;
}

/** MONGODB_DB, si no el nombre de la URI, si no "registro". */
export function databaseName(uri: string | undefined, explicit: string | undefined): string {
  if (explicit) return explicit;
  const match = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "registro";
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(databaseName(process.env.MONGODB_URI, process.env.MONGODB_DB));
}

/** Para los scripts: cierra la conexión y deja terminar el proceso. */
export async function closeDb(): Promise<void> {
  const client = await global._mongoClientPromise;
  await client?.close();
  global._mongoClientPromise = undefined;
}

// --- Documentos --------------------------------------------------------------

export interface UserDoc {
  email: string;
  name: string;
  /** Se recalcula en cada ingreso con FUNCIONARIO_EMAILS (lib/roles.ts). */
  role: Role;
  createdAt: Date;
}

export interface LoginTokenDoc {
  /** Solo el hash: si alguien lee la base, no puede entrar con los enlaces. */
  tokenHash: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AdjuntoDoc {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  /** Dónde está en el bucket: el registro guarda la clave, no el archivo. */
  key: string;
}

/** Una presentación (el registro de entrada). Una vez registrada, no se modifica. */
export interface RegistroDoc {
  numero: string;
  fecha: Date;
  userId: ObjectId;
  userEmail: string;
  interesado: Persona;
  representante: Representante | null;
  expone: string;
  solicita: string;
  adjuntos: AdjuntoDoc[];
  justificanteKey: string | null;
  /** Copia del expediente que se abrió, para listar sin otra consulta. */
  expediente: { id: ObjectId; codigo: string; estado: ExpedienteEstado } | null;
}

/**
 * Las actuaciones van EMBEBIDAS en el expediente: siempre se leen con él,
 * nunca solas, y son pocas por expediente. Un array dentro del documento
 * se lee y se agrega ($push) en una sola operación.
 */
export interface ActuacionDoc {
  _id: ObjectId;
  fecha: Date;
  texto: string;
  visible: boolean;
  autorId: ObjectId | null; // null: la escribió el sistema (cambio de estado)
  autor: string;
}

export interface ExpedienteDoc {
  codigo: string;
  fecha: Date;
  estado: ExpedienteEstado;
  tipoId: ObjectId;
  tipo: { nombre: string; prefijo: string };
  /** El expediente nace de una presentación: la referencia (una sola por presentación). */
  registroId: ObjectId;
  registroNumero: string;
  sujeto: { userId: ObjectId; email: string; nombre: string; cuit: string };
  actuaciones: ActuacionDoc[];
  updatedAt: Date;
}

export interface TipoDoc {
  nombre: string;
  prefijo: string;
  activo: boolean;
  createdAt: Date;
}

/** La configuración de la home: un único documento. */
export interface ConfigDoc extends Omit<HomeConfig, "tieneEscudo" | "escudoVersion"> {
  _id: "home";
  escudo: { key: string; contentType: string; updatedAt: Date } | null;
}

/** Números correlativos por año: { _id: "RE-2026", seq }. */
export interface CounterDoc {
  _id: string;
  seq: number;
}

/** Un mail guardado en la bandeja de demo (MAIL_TRANSPORT=outbox) en vez de enviarse. */
export interface OutboxDoc {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; size: number; contentType: string }[];
  createdAt: Date;
}

let indexes: Promise<unknown> | undefined;

export async function collections() {
  const db = await getDb();
  const c = {
    users: db.collection<UserDoc>("users"),
    loginTokens: db.collection<LoginTokenDoc>("loginTokens"),
    registros: db.collection<RegistroDoc>("registros"),
    expedientes: db.collection<ExpedienteDoc>("expedientes"),
    tipos: db.collection<TipoDoc>("tipos"),
    config: db.collection<ConfigDoc>("config"),
    counters: db.collection<CounterDoc>("counters"),
    outbox: db.collection<OutboxDoc>("outbox"),
  };
  indexes ??= Promise.all([
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.loginTokens.createIndex({ tokenHash: 1 }, { unique: true }),
    c.loginTokens.createIndex({ email: 1, createdAt: -1 }),
    // MongoDB borra solo los enlaces vencidos (índice TTL).
    c.loginTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.registros.createIndex({ numero: 1 }, { unique: true }),
    // "Mis presentaciones": las de un usuario, de la más nueva a la más vieja.
    c.registros.createIndex({ userId: 1, fecha: -1 }),
    c.registros.createIndex({ fecha: -1 }),
    c.expedientes.createIndex({ codigo: 1 }, { unique: true }),
    // Un expediente por presentación, aunque dos funcionarios lo abran a la vez.
    c.expedientes.createIndex({ registroId: 1 }, { unique: true }),
    c.expedientes.createIndex({ estado: 1, fecha: -1 }),
    c.tipos.createIndex({ prefijo: 1 }, { unique: true }),
    // La bandeja de demo se vacía sola: cada mail dura 3 días.
    c.outbox.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 }),
    c.outbox.createIndex({ to: 1, createdAt: -1 }),
  ]);
  await indexes;
  return c;
}

export type Collections = Awaited<ReturnType<typeof collections>>;

/** ObjectId de un texto, o null si no es un id válido (evita un 500 con ids basura). */
export function toObjectId(id: unknown): ObjectId | null {
  return typeof id === "string" && ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

/** Error de índice único (código 11000). */
export function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

// --- Documento → DTO -------------------------------------------------------------

export function registroToDTO(doc: WithId<RegistroDoc>): RegistroDTO {
  return {
    id: doc._id.toString(),
    numero: doc.numero,
    fecha: doc.fecha.toISOString(),
    userId: doc.userId.toString(),
    userEmail: doc.userEmail,
    interesado: doc.interesado,
    representante: doc.representante,
    expone: doc.expone,
    solicita: doc.solicita,
    adjuntos: doc.adjuntos.map(({ index, filename, contentType, size, sha256 }) => ({ index, filename, contentType, size, sha256 })),
    expediente: doc.expediente ? { id: doc.expediente.id.toString(), codigo: doc.expediente.codigo, estado: doc.expediente.estado } : null,
  };
}

export function actuacionToDTO(a: ActuacionDoc): ActuacionDTO {
  return { id: a._id.toString(), fecha: a.fecha.toISOString(), texto: a.texto, visible: a.visible, autor: a.autor };
}

/** Para el administrado, `soloVisibles`: las actuaciones internas no salen del servidor. */
export function expedienteToDTO(doc: WithId<ExpedienteDoc>, soloVisibles = false): ExpedienteDTO {
  return {
    id: doc._id.toString(),
    codigo: doc.codigo,
    fecha: doc.fecha.toISOString(),
    estado: doc.estado,
    tipo: { id: doc.tipoId.toString(), ...doc.tipo },
    registroId: doc.registroId.toString(),
    registroNumero: doc.registroNumero,
    sujeto: { ...doc.sujeto, userId: doc.sujeto.userId.toString() },
    actuaciones: doc.actuaciones.filter((a) => !soloVisibles || a.visible).map(actuacionToDTO),
  };
}

export function tipoToDTO(doc: WithId<TipoDoc>): TipoExpediente {
  return { id: doc._id.toString(), nombre: doc.nombre, prefijo: doc.prefijo, activo: doc.activo };
}
