import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fechaHoraAR, pdfSafe, renderJustificante, wrap } from "@/lib/justificante";
import {
  DEFAULT_CONFIG,
  MIN_CONTRAST,
  TRANSICIONES,
  canAct,
  canMove,
  contrast,
  estadoActuacion,
  expedienteCodigo,
  registroNumero,
  textOn,
  yearAR,
} from "@/lib/tramite";
import type { ExpedienteEstado } from "@/lib/types";

describe("numeración", () => {
  it("registro y expediente, con ceros a la izquierda", () => {
    expect(registroNumero(2026, 42)).toBe("RE-2026-00000042");
    expect(expedienteCodigo(2026, 7, "VOMB", "OBRAS")).toBe("EX-2026-00000007-VOMB-OBRAS");
  });
  it("el año es el de Argentina", () => {
    expect(yearAR(new Date("2027-01-01T01:00:00Z"))).toBe(2026); // 22 h del 31/12 en Buenos Aires
    expect(yearAR(new Date("2027-01-01T03:00:00Z"))).toBe(2027);
  });
});

describe("estados del expediente", () => {
  const ALL: ExpedienteEstado[] = ["en_tramite", "resuelto", "archivado"];
  it("en trámite → resuelto → archivado; un resuelto se reabre; archivado es final", () => {
    expect(canMove("en_tramite", "resuelto")).toBe(true);
    expect(canMove("en_tramite", "archivado")).toBe(false);
    expect(canMove("resuelto", "en_tramite")).toBe(true);
    expect(canMove("resuelto", "archivado")).toBe(true);
    for (const to of ALL) expect(canMove("archivado", to)).toBe(false);
    for (const s of ALL) expect(TRANSICIONES[s]).not.toContain(s);
  });
  it("se actúa salvo en archivado", () => {
    expect(canAct("en_tramite")).toBe(true);
    expect(canAct("resuelto")).toBe(true);
    expect(canAct("archivado")).toBe(false);
  });
  it("el cambio de estado queda escrito", () => {
    expect(estadoActuacion("resuelto", "")).toBe("El expediente pasa a resuelto.");
    expect(estadoActuacion("en_tramite", "Falta un plano.")).toBe("Se reabre el expediente. Falta un plano.");
  });
});

describe("color institucional", () => {
  it("contraste WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
    expect(contrast(DEFAULT_CONFIG.color, "#ffffff")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it("el texto encima: blanco sobre oscuro, tinta sobre claro", () => {
    expect(textOn("#2f5d50")).toBe("#ffffff");
    expect(textOn("#f6b40e")).toBe("#14181f");
  });
});

describe("justificante en PDF", () => {
  const data = {
    organismo: "Municipalidad de Villa Ombúes",
    color: "#2f5d50",
    numero: "RE-2026-00000042",
    fecha: new Date("2026-11-23T20:42:10Z"),
    interesado: { nombre: "Marta Suárez", cuit: "27284567892", domicilio: "Los Talas 455" },
    representante: { nombre: "Julián Pereyra", cuit: "20301234563", domicilio: "Belgrano 88", caracter: "apoderado" as const },
    expone: "Quiero ampliar la vivienda 🏠.\nSegundo párrafo.",
    solicita: "El permiso de obra.",
    adjuntos: [{ filename: "plano.pdf", size: 2048, sha256: "a".repeat(64) }],
  };

  it("fecha y hora argentinas", () => {
    expect(fechaHoraAR(data.fecha)).toBe("23/11/2026 17:42:10");
  });

  it("es un PDF válido, con título y una página", async () => {
    const bytes = await renderJustificante(data);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Justificante de presentación RE-2026-00000042");
    expect(doc.getAuthor()).toBe("Municipalidad de Villa Ombúes");
  });

  it("con el escudo; y uno dañado no lo impide", async () => {
    const png = new Uint8Array(readFileSync("scripts/escudo-villa-ombues.png"));
    const withEscudo = await renderJustificante(data, { bytes: png, contentType: "image/png" });
    const without = await renderJustificante(data);
    expect(withEscudo.length).toBeGreaterThan(without.length);
    const broken = await renderJustificante(data, { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
    expect((await PDFDocument.load(broken)).getPageCount()).toBe(1);
  });

  it("un texto largo pasa a otra página", async () => {
    const bytes = await renderJustificante({ ...data, expone: "Palabra ".repeat(1500) });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("los caracteres que la fuente no tiene se cambian; los renglones entran en el ancho", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont("Helvetica");
    expect(pdfSafe(font, "Ñandú ¿sí? 🏠")).toBe("Ñandú ¿sí? ?");
    const lines = wrap(font, "uno dos tres\n\ncuatro " + "x".repeat(200), 10, 100);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(100);
    expect(lines.slice(0, 3)).toEqual(["uno dos tres", "", "cuatro"]);
  });
});
