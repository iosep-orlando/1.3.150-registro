import { ObjectId, type Filter, type WithId } from "mongodb";
import { ApiError, publicUrl } from "../api";
import type { Caller } from "../auth";
import { collections, expedienteToDTO, isDuplicateKey, toObjectId, type ActuacionDoc, type ExpedienteDoc, type RegistroDoc } from "../db";
import { escapeHtml } from "../html";
import { sendMail } from "../mail";
import { ESTADO_LABEL, canAct, canMove, estadoActuacion, expedienteCodigo, yearAR } from "../tramite";
import type { ExpedienteDTO, ExpedienteEstado } from "../types";
import { getConfigDoc } from "./config";
import { nextNumber } from "./counters";
import { getRegistroDoc } from "./registros";

// ---------------------------------------------------------------------------
// Expedientes: los abre el funcionario a partir de una presentación, y les
// agrega actuaciones. El administrado ve el suyo, con las actuaciones que
// el funcionario marcó como visibles, y recibe un mail por cada una.
// ---------------------------------------------------------------------------

/** El expediente, si el que pregunta puede verlo: el funcionario, todos; el administrado, el de una presentación suya. */
export async function getExpedienteDoc(caller: Caller, id: string): Promise<WithId<ExpedienteDoc>> {
  const _id = toObjectId(id);
  if (!_id) throw new ApiError(404, "No existe ese expediente.");
  const { expedientes } = await collections();
  const filter: Filter<ExpedienteDoc> = caller.role === "funcionario" ? { _id } : { _id, "sujeto.userId": caller.userId };
  const doc = await expedientes.findOne(filter);
  if (!doc) throw new ApiError(404, "No existe ese expediente.");
  return doc;
}

export async function getExpediente(caller: Caller, id: string): Promise<ExpedienteDTO> {
  return expedienteToDTO(await getExpedienteDoc(caller, id), caller.role !== "funcionario");
}

/** El expediente de una presentación (para "Mis trámites"), o null. */
export async function expedienteDeRegistro(caller: Caller, registro: WithId<RegistroDoc>): Promise<ExpedienteDTO | null> {
  if (!registro.expediente) return null;
  const { expedientes } = await collections();
  const doc = await expedientes.findOne({ registroId: registro._id });
  return doc ? expedienteToDTO(doc, caller.role !== "funcionario") : null;
}

export async function listExpedientes(opts: { estado?: ExpedienteEstado; tipoId?: ObjectId; q?: string }): Promise<ExpedienteDTO[]> {
  const { expedientes } = await collections();
  const query: Filter<ExpedienteDoc> = {};
  if (opts.estado) query.estado = opts.estado;
  if (opts.tipoId) query.tipoId = opts.tipoId;
  const search = (opts.q ?? "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (search) {
    const re = { $regex: search, $options: "i" };
    query.$or = [{ codigo: re }, { "sujeto.nombre": re }, { registroNumero: re }];
  }
  return (await expedientes.find(query).sort({ fecha: -1 }).limit(300).toArray()).map((d) => expedienteToDTO(d));
}

const actuacion = (texto: string, visible: boolean, autor: Caller | null): ActuacionDoc => ({
  _id: new ObjectId(),
  fecha: new Date(),
  texto,
  visible,
  autorId: autor?.userId ?? null,
  autor: autor ? autor.name : "Sistema",
});

/**
 * Abre el expediente de una presentación: una sola vez (índice único sobre
 * registroId; si dos funcionarios lo intentan a la vez, el segundo recibe
 * un 409). Guarda la referencia a la presentación y una copia del sujeto.
 */
export async function abrirExpediente(caller: Caller, registroId: string, tipoId: string): Promise<ExpedienteDTO> {
  const registro = await getRegistroDoc(caller, registroId);
  if (registro.expediente) throw new ApiError(409, `Esta presentación ya tiene el expediente ${registro.expediente.codigo}.`);
  const { tipos, expedientes, registros } = await collections();
  const tipo = toObjectId(tipoId) ? await tipos.findOne({ _id: toObjectId(tipoId)!, activo: true }) : null;
  if (!tipo) throw new ApiError(400, "Elegí un tipo de expediente.");
  const config = await getConfigDoc();

  const fecha = new Date();
  const year = yearAR(fecha);
  const doc: ExpedienteDoc = {
    codigo: expedienteCodigo(year, await nextNumber(`EX-${year}`), config.sigla, tipo.prefijo),
    fecha,
    estado: "en_tramite",
    tipoId: tipo._id,
    tipo: { nombre: tipo.nombre, prefijo: tipo.prefijo },
    registroId: registro._id,
    registroNumero: registro.numero,
    sujeto: { userId: registro.userId, email: registro.userEmail, nombre: registro.interesado.nombre, cuit: registro.interesado.cuit },
    actuaciones: [actuacion(`Se abre el expediente (${tipo.nombre}) a partir de la presentación ${registro.numero}.`, true, caller)],
    updatedAt: fecha,
  };
  let _id: ObjectId;
  try {
    _id = (await expedientes.insertOne(doc)).insertedId;
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, "Otro funcionario acaba de abrir el expediente de esta presentación. Recargá la página.");
    throw error;
  }
  await registros.updateOne({ _id: registro._id }, { $set: { expediente: { id: _id, codigo: doc.codigo, estado: doc.estado } } });
  const created = { _id, ...doc };
  await notify(created, `Se abrió el expediente ${doc.codigo}`, doc.actuaciones[0].texto);
  return expedienteToDTO(created);
}

/** Agrega una actuación ($push: se suma al array sin reescribir el expediente). */
export async function addActuacion(caller: Caller, id: string, input: { texto: string; visible: boolean }): Promise<ExpedienteDTO> {
  const current = await getExpedienteDoc(caller, id);
  if (!canAct(current.estado)) throw new ApiError(409, "El expediente está archivado: ya no admite actuaciones.");
  const { expedientes } = await collections();
  const nueva = actuacion(input.texto, input.visible, caller);
  const updated = await expedientes.findOneAndUpdate(
    { _id: current._id, estado: { $ne: "archivado" } },
    { $push: { actuaciones: nueva }, $set: { updatedAt: nueva.fecha } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ApiError(409, "El expediente se archivó mientras escribías.");
  if (input.visible) await notify(updated, `Novedades en el expediente ${updated.codigo}`, input.texto);
  return expedienteToDTO(updated);
}

/**
 * Cambia el estado (en trámite → resuelto → archivado, o reabrir un
 * resuelto). Queda como actuación visible, con el motivo si se escribió.
 */
export async function cambiarEstado(caller: Caller, id: string, to: ExpedienteEstado, motivo: string): Promise<ExpedienteDTO> {
  const current = await getExpedienteDoc(caller, id);
  if (!canMove(current.estado, to)) {
    throw new ApiError(409, `Un expediente ${ESTADO_LABEL[current.estado].toLowerCase()} no puede pasar a ${ESTADO_LABEL[to].toLowerCase()}.`);
  }
  const { expedientes, registros } = await collections();
  const nueva = actuacion(estadoActuacion(to, motivo), true, caller);
  const updated = await expedientes.findOneAndUpdate(
    { _id: current._id, estado: current.estado },
    { $set: { estado: to, updatedAt: nueva.fecha }, $push: { actuaciones: nueva } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ApiError(409, "El estado cambió mientras tanto. Recargá la página.");
  await registros.updateOne({ _id: updated.registroId }, { $set: { "expediente.estado": to } });
  await notify(updated, `El expediente ${updated.codigo} está ${ESTADO_LABEL[to].toLowerCase()}`, nueva.texto);
  return expedienteToDTO(updated);
}

/** El aviso por mail al administrado. Si el correo falla, la actuación queda igual. */
async function notify(expediente: WithId<ExpedienteDoc>, subject: string, texto: string): Promise<void> {
  try {
    const config = await getConfigDoc();
    const link = `${publicUrl()}/tramites/${expediente.registroId}`;
    await sendMail({
      to: expediente.sujeto.email,
      fromName: config.organismo,
      subject,
      html: [
        `<p>Hola, ${escapeHtml(expediente.sujeto.nombre)}:</p>`,
        `<p>Hay novedades en el expediente <strong>${escapeHtml(expediente.codigo)}</strong> (${escapeHtml(expediente.tipo.nombre)}):</p>`,
        `<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px">${escapeHtml(texto).replace(/\n/g, "<br>")}</blockquote>`,
        `<p>Estado: <strong>${escapeHtml(ESTADO_LABEL[expediente.estado])}</strong>. Lo podés ver en <a href="${escapeHtml(link)}">Mis trámites</a>.</p>`,
        `<p style="color:#667085;font-size:12px">${escapeHtml(config.organismo)}. Sitio de práctica: no es un organismo real.</p>`,
      ].join("\n"),
      text: `Hay novedades en el expediente ${expediente.codigo} (${expediente.tipo.nombre}):\n\n${texto}\n\nEstado: ${ESTADO_LABEL[expediente.estado]}. Miralo en ${link}`,
    });
  } catch (error) {
    console.error("Aviso por mail", error);
  }
}
