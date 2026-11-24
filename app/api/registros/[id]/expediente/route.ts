import { requireFuncionario } from "@/lib/auth";
import { handle, readJson } from "@/lib/api";
import { abrirExpediente } from "@/lib/store/expedientes";

/** El funcionario abre el expediente de una presentación: { tipoId }. */
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/registros/[id]/expediente">) => {
  const caller = await requireFuncionario();
  const body = await readJson(request);
  return Response.json(await abrirExpediente(caller, (await ctx.params).id, String(body.tipoId ?? "")), { status: 201 });
});
