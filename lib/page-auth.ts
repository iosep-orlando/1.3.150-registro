import { notFound, redirect } from "next/navigation";
import { AuthError, requireUser, type Caller } from "./auth";

/** Para las páginas del servidor: el usuario de la sesión, o al login. */
export async function pageUser(): Promise<Caller> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }
}

/**
 * Las páginas de /gestion. proxy.ts ya frena a los administrados con el
 * rol del JWT; acá se confirma con la base. Un administrado ve un 404.
 */
export async function pageFuncionario(): Promise<Caller> {
  const caller = await pageUser();
  if (caller.role !== "funcionario") notFound();
  return caller;
}
