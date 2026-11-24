import { requireUser } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { adjuntoUrl } from "@/lib/store/registros";

/**
 * Descargar un adjunto: la API comprueba que quien lo pide pueda verlo y
 * lo redirige a una URL prefirmada; el archivo baja directo del bucket.
 */
export const GET = handle(async (_request: Request, ctx: RouteContext<"/api/registros/[id]/adjuntos/[index]">) => {
  const caller = await requireUser();
  const { id, index } = await ctx.params;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) throw new ApiError(404, "No existe ese adjunto.");
  return Response.redirect(await adjuntoUrl(caller, id, n), 302);
});
