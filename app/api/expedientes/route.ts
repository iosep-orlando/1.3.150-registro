import { requireFuncionario } from "@/lib/auth";
import { handle } from "@/lib/api";
import { toObjectId } from "@/lib/db";
import { listExpedientes } from "@/lib/store/expedientes";
import type { ExpedienteEstado } from "@/lib/types";

const ESTADOS: ExpedienteEstado[] = ["en_tramite", "resuelto", "archivado"];

/** Todos los expedientes, para el funcionario: ?estado=, ?tipo=, ?q=. */
export const GET = handle(async (request: Request) => {
  await requireFuncionario();
  const params = new URL(request.url).searchParams;
  const estado = ESTADOS.find((e) => e === params.get("estado"));
  const tipoId = toObjectId(params.get("tipo")) ?? undefined;
  return Response.json({ expedientes: await listExpedientes({ estado, tipoId, q: params.get("q") ?? "" }) });
});
