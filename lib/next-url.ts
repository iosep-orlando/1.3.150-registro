import type { Role } from "./types";

/** La página de inicio de cada rol. */
export function homeFor(role: Role): string {
  return role === "funcionario" ? "/gestion" : "/tramites";
}

/**
 * Adónde ir después de entrar: el `next` que dejó proxy.ts, solo si es una
 * página de la app (/tramites o /gestion) que le corresponde al rol, y
 * nunca otra web (sería un redireccionador abierto). Si no, el inicio de
 * su rol.
 */
export function safeNext(next: unknown, role: Role): string {
  if (typeof next !== "string" || !/^\/(tramites|gestion)(\/|\?|$)/.test(next)) return homeFor(role);
  if (next.startsWith("/gestion") && role !== "funcionario") return homeFor(role);
  if (next.startsWith("/tramites") && role !== "administrado") return homeFor(role);
  return next;
}
