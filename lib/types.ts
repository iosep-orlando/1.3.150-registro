// ---------------------------------------------------------------------------
// Tipos compartidos por el servidor y el navegador. Los documentos de
// MongoDB (con ObjectId y Date) están en lib/db.ts; acá, lo que viaja como
// JSON (DTO): ids como texto, fechas como texto ISO.
//
//   Presentación (registro de entrada) ──► Expediente ──► Actuaciones[]
//   la hace el administrado                 lo abre el funcionario
// ---------------------------------------------------------------------------

export type Role = "administrado" | "funcionario";

export interface MeDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Una persona en un trámite: el interesado o su representante. */
export interface Persona {
  nombre: string; // nombre y apellido, o razón social
  cuit: string; // CUIT o CUIL, 11 dígitos
  domicilio: string; // domicilio fiscal
}

export type Caracter = "apoderado" | "representante_legal" | "gestor";

export interface Representante extends Persona {
  caracter: Caracter;
}

export interface AdjuntoDTO {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  sha256: string; // la huella que figura en el justificante
}

export type ExpedienteEstado = "en_tramite" | "resuelto" | "archivado";

export interface ActuacionDTO {
  id: string;
  fecha: string;
  texto: string;
  /** Si el administrado la ve (y le llega el aviso por mail). */
  visible: boolean;
  autor: string;
}

/** Una presentación tal como la ve su autor o un funcionario. */
export interface RegistroDTO {
  id: string;
  numero: string; // RE-2026-00000042
  fecha: string;
  userId: string;
  userEmail: string;
  interesado: Persona;
  representante: Representante | null;
  expone: string;
  solicita: string;
  adjuntos: AdjuntoDTO[];
  expediente: { id: string; codigo: string; estado: ExpedienteEstado } | null;
}

export interface ExpedienteDTO {
  id: string;
  codigo: string; // EX-2026-00000007-VOMB-OBRAS
  fecha: string;
  estado: ExpedienteEstado;
  tipo: { id: string; nombre: string; prefijo: string };
  registroId: string;
  registroNumero: string;
  /** El "contribuyente sujeto": el administrado que presentó. */
  sujeto: { userId: string; email: string; nombre: string; cuit: string };
  actuaciones: ActuacionDTO[];
}

export interface TipoExpediente {
  id: string;
  nombre: string;
  prefijo: string; // 2 a 8 letras mayúsculas: va en el código
  activo: boolean;
}

/** Lo que el funcionario personaliza de la home (modo SaaS). */
export interface HomeConfig {
  organismo: string; // "Municipalidad de Villa Ombúes"
  sigla: string; // "VOMB": va en los códigos de expediente
  bienvenida: string;
  avisos: string; // un aviso por renglón
  horario: string;
  contacto: string;
  color: string; // #RRGGBB, el color institucional
  tieneEscudo: boolean;
  escudoVersion: number; // cambia al subir otro, para que el navegador no muestre el viejo
}
