import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { justificanteUrl } from "@/lib/store/registros";

/** Comprueba el acceso y redirige a una URL prefirmada del bucket (vale 5 minutos). */
export const GET = handle(async (_request: Request, ctx: RouteContext<"/api/registros/[id]/justificante">) => {
  const caller = await requireUser();
  return Response.redirect(await justificanteUrl(caller, (await ctx.params).id), 302);
});
