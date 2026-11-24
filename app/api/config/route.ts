import { requireFuncionario } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { getHomeConfig, saveConfig } from "@/lib/store/config";
import { validateConfig } from "@/lib/validation";

/** La configuración de la home: pública (la home la muestra a cualquiera). */
export const GET = handle(async () => Response.json(await getHomeConfig()));

/** Solo un funcionario la cambia (modo SaaS). */
export const PUT = handle(async (request: Request) => {
  await requireFuncionario();
  const input = validateConfig(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  return Response.json(await saveConfig(input.value));
});
