import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { addActuacion } from "@/lib/store/expedientes";
import { validateActuacion } from "@/lib/validation";

/** { texto, visible }: una actuación nueva. Si es visible, le llega un aviso al administrado. */
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/expedientes/[id]/actuaciones">) => {
  const caller = await requireFuncionario();
  const input = validateActuacion(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  return Response.json(await addActuacion(caller, (await ctx.params).id, input.value), { status: 201 });
});
