import { ApiError } from "../api";
import { collections, isDuplicateKey, tipoToDTO, toObjectId } from "../db";
import type { TipoExpediente } from "../types";

// Los tipos de expediente: los mantiene el funcionario. No se borran (hay
// expedientes que los nombran): se desactivan, y dejan de ofrecerse.

export async function listTipos(soloActivos = false): Promise<TipoExpediente[]> {
  const { tipos } = await collections();
  return (await tipos.find(soloActivos ? { activo: true } : {}).sort({ nombre: 1 }).collation({ locale: "es" }).toArray()).map(tipoToDTO);
}

const DUP = "Ya hay un tipo con ese prefijo. Elegí otro.";

export async function createTipo(input: { nombre: string; prefijo: string; activo: boolean }): Promise<TipoExpediente> {
  const { tipos } = await collections();
  try {
    const doc = { ...input, createdAt: new Date() };
    const { insertedId } = await tipos.insertOne(doc);
    return tipoToDTO({ _id: insertedId, ...doc });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, DUP);
    throw error;
  }
}

/** Cambiar el nombre o activarlo/desactivarlo. El prefijo de los expedientes ya abiertos no cambia: está en su código. */
export async function updateTipo(id: string, input: { nombre: string; prefijo: string; activo: boolean }): Promise<TipoExpediente> {
  const _id = toObjectId(id);
  const { tipos } = await collections();
  try {
    const updated = _id ? await tipos.findOneAndUpdate({ _id }, { $set: input }, { returnDocument: "after" }) : null;
    if (!updated) throw new ApiError(404, "No existe ese tipo de expediente.");
    return tipoToDTO(updated);
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, DUP);
    throw error;
  }
}
