import { collections } from "../db";

/**
 * El próximo número de una serie ("RE-2026", "EX-2026"). $inc es atómico:
 * dos presentaciones al mismo tiempo nunca reciben el mismo número. Cada
 * año empieza de 1.
 */
export async function nextNumber(serie: string): Promise<number> {
  const { counters } = await collections();
  const counter = await counters.findOneAndUpdate({ _id: serie }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return counter!.seq;
}
