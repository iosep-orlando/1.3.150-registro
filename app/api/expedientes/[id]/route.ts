import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getExpediente } from "@/lib/store/expedientes";

/** El funcionario lo ve entero; el administrado, el suyo y solo las actuaciones visibles. */
export const GET = handle(async (_request: Request, ctx: RouteContext<"/api/expedientes/[id]">) => {
  const caller = await requireUser();
  return Response.json(await getExpediente(caller, (await ctx.params).id));
});
