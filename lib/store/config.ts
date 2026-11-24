import { collections, type ConfigDoc } from "../db";
import { DEFAULT_CONFIG } from "../tramite";
import type { ConfigInput } from "../validation";
import type { HomeConfig } from "../types";

// La configuración de la home (modo SaaS): un único documento que el
// funcionario edita y la home lee en cada visita. Si todavía no existe, se
// usan los valores por defecto.

export async function getConfigDoc(): Promise<ConfigDoc> {
  const { config } = await collections();
  const doc = await config.findOne({ _id: "home" });
  return { _id: "home", ...DEFAULT_CONFIG, escudo: null, ...doc };
}

export function toHomeConfig(doc: ConfigDoc): HomeConfig {
  const { _id: _ignored, escudo, ...rest } = doc;
  return { ...rest, tieneEscudo: escudo !== null, escudoVersion: escudo ? escudo.updatedAt.getTime() : 0 };
}

export async function getHomeConfig(): Promise<HomeConfig> {
  return toHomeConfig(await getConfigDoc());
}

export async function saveConfig(input: ConfigInput): Promise<HomeConfig> {
  const { config } = await collections();
  await config.updateOne({ _id: "home" }, { $set: input, $setOnInsert: { escudo: null } }, { upsert: true });
  return getHomeConfig();
}

export async function setEscudo(escudo: ConfigDoc["escudo"]): Promise<HomeConfig> {
  const { config } = await collections();
  await config.updateOne({ _id: "home" }, { $set: { escudo }, $setOnInsert: { ...DEFAULT_CONFIG } }, { upsert: true });
  return getHomeConfig();
}
