import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { cambiarEstado } from "@/lib/store/expedientes";
import { validateEstado } from "@/lib/validation";

/** { estado, motivo }: en trámite → resuelto → archivado (o reabrir un resuelto). */
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/expedientes/[id]/estado">) => {
  const caller = await requireFuncionario();
  const input = validateEstado(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  return Response.json(await cambiarEstado(caller, (await ctx.params).id, input.value.estado, input.value.motivo));
});
