import { connection } from "next/server";
import { getHomeConfig } from "@/lib/store/config";
import { textOn } from "@/lib/tramite";

/**
 * El color institucional que eligió el funcionario, para toda la app. Se
 * lee de la configuración en cada visita (no al compilar).
 */
export default async function Theme() {
  await connection();
  let color = "#2f5d50";
  try {
    color = (await getHomeConfig()).color;
  } catch {
    // sin base, se queda el color por defecto
  }
  return <style>{`:root{--inst:${color};--inst-text:${textOn(color)}}`}</style>;
}
