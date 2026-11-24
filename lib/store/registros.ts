import { createHash } from "node:crypto";
import { ObjectId, type Filter, type WithId } from "mongodb";
import { ApiError, publicUrl } from "../api";
import type { Caller } from "../auth";
import { collections, registroToDTO, toObjectId, type AdjuntoDoc, type RegistroDoc } from "../db";
import { cleanFilename, type FileType } from "../files";
import { escapeHtml } from "../html";
import { fechaHoraAR, renderJustificante } from "../justificante";
import { sendMail } from "../mail";
import { STORAGE_DOWN, attachmentKey, getObject, justificanteKey, presignedDownload, putObject } from "../storage";
import { registroNumero, yearAR } from "../tramite";
import type { PresentacionInput } from "../validation";
import type { RegistroDTO } from "../types";
import { getConfigDoc } from "./config";
import { nextNumber } from "./counters";

// ---------------------------------------------------------------------------
// Las presentaciones (el registro de entrada).
//
// El rol define qué se ve: un administrado solo encuentra las suyas (la
// consulta lleva su userId, y una ajena da 404 igual que una que no
// existe); un funcionario las ve todas. Se decide acá, en el servidor.
// ---------------------------------------------------------------------------

export interface Upload {
  name: string;
  type: FileType;
  bytes: Uint8Array;
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/**
 * Registra una presentación:
 *   1. sube los adjuntos al bucket (registros/<id>/…) con su huella SHA-256;
 *   2. recién entonces pide el número (así un S3 caído no gasta números);
 *   3. guarda el registro con las claves de los adjuntos;
 *   4. genera el justificante en PDF, lo guarda y lo manda por mail.
 * Los pasos 1 a 3 son la presentación; el 4, si falla, se rehace al pedirlo.
 */
export async function createRegistro(caller: Caller, input: PresentacionInput, files: Upload[]): Promise<RegistroDTO> {
  const _id = new ObjectId();
  const adjuntos: AdjuntoDoc[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const filename = cleanFilename(file.name, file.type);
      const key = attachmentKey(_id.toString(), index, filename);
      await putObject(key, file.bytes, file.type);
      adjuntos.push({ index, filename, contentType: file.type, size: file.bytes.length, sha256: sha256(file.bytes), key });
    }
  } catch (error) {
    console.error("Adjuntos", error);
    throw new ApiError(503, STORAGE_DOWN);
  }

  const fecha = new Date();
  const year = yearAR(fecha);
  const numero = registroNumero(year, await nextNumber(`RE-${year}`));
  const doc: RegistroDoc = {
    numero,
    fecha,
    userId: caller.userId,
    userEmail: caller.email,
    interesado: input.interesado,
    representante: input.representante,
    expone: input.expone,
    solicita: input.solicita,
    adjuntos,
    justificanteKey: null,
    expediente: null,
  };
  const { registros } = await collections();
  await registros.insertOne({ _id, ...doc });
  const created = { _id, ...doc };

  try {
    const pdf = await storeJustificante(created);
    await notifyReceived(created, pdf);
  } catch (error) {
    console.error("Justificante o aviso", error); // la presentación ya está registrada
  }
  return registroToDTO(created);
}

/** La presentación, si el que pregunta puede verla: la suya, o cualquiera si es funcionario. */
export async function getRegistroDoc(caller: Caller, id: string): Promise<WithId<RegistroDoc>> {
  const _id = toObjectId(id);
  if (!_id) throw new ApiError(404, "No existe esa presentación.");
  const { registros } = await collections();
  // El administrado busca con su userId: una ajena no se encuentra.
  const filter: Filter<RegistroDoc> = caller.role === "funcionario" ? { _id } : { _id, userId: caller.userId };
  const doc = await registros.findOne(filter);
  if (!doc) throw new ApiError(404, "No existe esa presentación.");
  return doc;
}

export async function listMine(userId: ObjectId): Promise<RegistroDTO[]> {
  const { registros } = await collections();
  return (await registros.find({ userId }).sort({ fecha: -1 }).limit(200).toArray()).map(registroToDTO);
}

export type RegistroFilter = "todas" | "sin_expediente" | "con_expediente";

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Para el funcionario: TODAS las presentaciones, sin filtrar por usuario. */
export async function listAll(filter: RegistroFilter = "todas", q = ""): Promise<RegistroDTO[]> {
  const { registros } = await collections();
  const query: Filter<RegistroDoc> = {};
  if (filter === "sin_expediente") query.expediente = null;
  if (filter === "con_expediente") query.expediente = { $ne: null };
  const search = q.trim().slice(0, 100);
  if (search) {
    const re = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ numero: re }, { "interesado.nombre": re }, { "interesado.cuit": { $regex: escapeRegex(search.replace(/[\s.-]/g, "")) } }, { userEmail: re }];
  }
  return (await registros.find(query).sort({ fecha: -1 }).limit(300).toArray()).map(registroToDTO);
}

// --- Justificante y adjuntos -------------------------------------------------------------

async function escudoBytes() {
  const config = await getConfigDoc();
  if (!config.escudo) return { config, escudo: null };
  const bytes = await getObject(config.escudo.key).catch(() => null);
  return { config, escudo: bytes ? { bytes, contentType: config.escudo.contentType } : null };
}

async function storeJustificante(doc: WithId<RegistroDoc>): Promise<Uint8Array> {
  const { config, escudo } = await escudoBytes();
  const pdf = await renderJustificante(
    {
      organismo: config.organismo,
      color: config.color,
      numero: doc.numero,
      fecha: doc.fecha,
      interesado: doc.interesado,
      representante: doc.representante,
      expone: doc.expone,
      solicita: doc.solicita,
      adjuntos: doc.adjuntos,
    },
    escudo,
  );
  const key = justificanteKey(doc._id.toString());
  await putObject(key, pdf, "application/pdf");
  const { registros } = await collections();
  await registros.updateOne({ _id: doc._id }, { $set: { justificanteKey: key } });
  doc.justificanteKey = key;
  return pdf;
}

export const justificanteFilename = (numero: string) => `Justificante-${numero}.pdf`;

/** URL prefirmada del justificante (si faltaba, se genera ahora). */
export async function justificanteUrl(caller: Caller, id: string): Promise<string> {
  const doc = await getRegistroDoc(caller, id);
  try {
    if (!doc.justificanteKey || !(await getObject(doc.justificanteKey))) await storeJustificante(doc);
    return await presignedDownload(doc.justificanteKey!, justificanteFilename(doc.numero), "application/pdf", true);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Justificante", error);
    throw new ApiError(503, STORAGE_DOWN);
  }
}

/** URL prefirmada de un adjunto: la API comprueba el acceso y el navegador baja directo del bucket. */
export async function adjuntoUrl(caller: Caller, id: string, index: number): Promise<string> {
  const doc = await getRegistroDoc(caller, id);
  const adjunto = doc.adjuntos.find((a) => a.index === index);
  if (!adjunto) throw new ApiError(404, "No existe ese adjunto.");
  try {
    return await presignedDownload(adjunto.key, adjunto.filename, adjunto.contentType, true);
  } catch (error) {
    console.error("Adjunto", error);
    throw new ApiError(503, STORAGE_DOWN);
  }
}

// --- Aviso por mail ---------------------------------------------------------------------------

async function notifyReceived(doc: WithId<RegistroDoc>, pdf: Uint8Array): Promise<void> {
  const config = await getConfigDoc();
  const link = `${publicUrl()}/tramites/${doc._id}`;
  await sendMail({
    to: doc.userEmail,
    fromName: config.organismo,
    subject: `Recibimos tu presentación ${doc.numero}`,
    html: [
      `<p>Hola,</p>`,
      `<p>${escapeHtml(config.organismo)} registró tu presentación <strong>${escapeHtml(doc.numero)}</strong> el ${escapeHtml(fechaHoraAR(doc.fecha))}.</p>`,
      `<p>Te adjuntamos el justificante. Podés seguirla en <a href="${escapeHtml(link)}">Mis trámites</a>.</p>`,
      `<p style="color:#667085;font-size:12px">Sitio de práctica: no es un organismo real.</p>`,
    ].join("\n"),
    text: `${config.organismo} registró tu presentación ${doc.numero} el ${fechaHoraAR(doc.fecha)}.\nTe adjuntamos el justificante. Seguila en ${link}`,
    attachments: [{ filename: justificanteFilename(doc.numero), content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
}
