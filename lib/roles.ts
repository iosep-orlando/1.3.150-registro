import type { Role } from "./types";

// ---------------------------------------------------------------------------
// Quién es funcionario: los emails de FUNCIONARIO_EMAILS (separados por
// comas). Los demás que entran son administrados: ciudadanos que hacen
// trámites. Nadie se puede hacer funcionario desde la web.
// ---------------------------------------------------------------------------

export function funcionarioEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.FUNCIONARIO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function roleFor(email: string, env: Record<string, string | undefined> = process.env): Role {
  return funcionarioEmails(env).includes(email.trim().toLowerCase()) ? "funcionario" : "administrado";
}

export const ROLE_LABEL: Record<Role, string> = { funcionario: "Funcionario", administrado: "Ciudadano" };
