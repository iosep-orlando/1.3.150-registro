import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { updateTipo } from "@/lib/store/tipos";
import { validateTipo } from "@/lib/validation";

/** Renombrar o activar/desactivar. Un tipo no se borra: hay expedientes que lo nombran. */
export const PUT = handle(async (request: Request, ctx: RouteContext<"/api/tipos/[id]">) => {
  await requireFuncionario();
  const input = validateTipo(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  return Response.json(await updateTipo((await ctx.params).id, input.value));
});
