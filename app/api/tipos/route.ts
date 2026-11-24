import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { createTipo, listTipos } from "@/lib/store/tipos";
import { validateTipo } from "@/lib/validation";

/** Los tipos de expediente (?activos=1 para solo los que se ofrecen al abrir uno). */
export const GET = handle(async (request: Request) => {
  await requireFuncionario();
  const soloActivos = new URL(request.url).searchParams.get("activos") === "1";
  return Response.json({ tipos: await listTipos(soloActivos) });
});

export const POST = handle(async (request: Request) => {
  await requireFuncionario();
  const input = validateTipo(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  return Response.json(await createTipo(input.value), { status: 201 });
});
