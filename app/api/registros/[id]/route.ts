import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { registroToDTO } from "@/lib/db";
import { expedienteDeRegistro } from "@/lib/store/expedientes";
import { getRegistroDoc } from "@/lib/store/registros";

/** La presentación con su expediente (si se abrió). Ajena, para un administrado: 404. */
export const GET = handle(async (_request: Request, ctx: RouteContext<"/api/registros/[id]">) => {
  const caller = await requireUser();
  const registro = await getRegistroDoc(caller, (await ctx.params).id);
  return Response.json({ registro: registroToDTO(registro), expediente: await expedienteDeRegistro(caller, registro) });
});
