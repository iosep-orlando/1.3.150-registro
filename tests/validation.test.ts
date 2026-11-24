import { describe, expect, it } from "vitest";
import {
  digits,
  formatCuit,
  isValidCuit,
  normalizeColor,
  validateActuacion,
  validateConfig,
  validateEmail,
  validateEstado,
  validatePersona,
  validatePresentacion,
  validateRepresentante,
  validateTipo,
} from "@/lib/validation";

const MARTA = { nombre: "Marta Suárez", cuit: "27-28456789-2", domicilio: "Los Talas 455" };
const JULIAN = { nombre: "Julián Pereyra", cuit: "20301234563", domicilio: "Belgrano 88", caracter: "apoderado" };

describe("email", () => {
  it("normaliza y valida", () => {
    expect(validateEmail("  Vecina@Registro.TEST ")).toEqual({ ok: true, value: "vecina@registro.test" });
    expect(validateEmail("sin-arroba").ok).toBe(false);
    expect(validateEmail("a b@c.co").ok).toBe(false);
  });
});

describe("CUIT / CUIL", () => {
  it.each(["20301234563", "27284567892", "30712345671", "23000000000", "30500010912"])("%s es válido", (c) => {
    expect(isValidCuit(c)).toBe(true);
  });
  it("un dígito cambiado, un prefijo que no existe o el largo equivocado no pasan", () => {
    expect(isValidCuit("20301234564")).toBe(false); // verificador equivocado
    expect(isValidCuit("20301234573")).toBe(false); // dígitos traspuestos
    expect(isValidCuit("10301234563")).toBe(false); // prefijo 10
    expect(isValidCuit("2030123456")).toBe(false);
    expect(isValidCuit("2030123456a")).toBe(false);
  });
  it("formato con guiones", () => {
    expect(digits(" 20-30123456.3 ")).toBe("20301234563");
    expect(formatCuit("20301234563")).toBe("20-30123456-3");
    expect(formatCuit("123")).toBe("123");
  });
});

describe("personas", () => {
  it("guarda el CUIT sin guiones", () => {
    expect(validatePersona(MARTA, "del interesado")).toEqual({ ok: true, value: { nombre: "Marta Suárez", cuit: "27284567892", domicilio: "Los Talas 455" } });
  });
  it("dice qué falta y de quién", () => {
    expect(validatePersona({ ...MARTA, nombre: " " }, "del interesado")).toEqual({ ok: false, error: "Falta el nombre o la razón social del interesado." });
    expect(validatePersona({ ...MARTA, cuit: "20-30123456-4" }, "del representante")).toMatchObject({ ok: false, error: expect.stringMatching(/CUIT\/CUIL del representante/) });
    expect(validatePersona({ ...MARTA, domicilio: "" }, "del interesado").ok).toBe(false);
    expect(validatePersona(null, "del interesado").ok).toBe(false);
  });
  it("representante: opcional, pero con carácter", () => {
    expect(validateRepresentante(null)).toEqual({ ok: true, value: null });
    expect(validateRepresentante(JULIAN)).toMatchObject({ ok: true, value: { caracter: "apoderado" } });
    expect(validateRepresentante({ ...JULIAN, caracter: "primo" })).toEqual({ ok: false, error: "Elegí en qué carácter actúa el representante." });
  });
});

describe("presentación", () => {
  const base = { interesado: MARTA, representante: null, expone: "  Hechos\r\nen dos renglones ", solicita: "Lo que pido" };
  it("limpia los textos", () => {
    const r = validatePresentacion(base);
    expect(r).toMatchObject({ ok: true, value: { expone: "Hechos\nen dos renglones", solicita: "Lo que pido", representante: null } });
  });
  it("exige expone y solicita, con límite", () => {
    expect(validatePresentacion({ ...base, expone: "" }).ok).toBe(false);
    expect(validatePresentacion({ ...base, solicita: " " }).ok).toBe(false);
    expect(validatePresentacion({ ...base, expone: "x".repeat(5001) }).ok).toBe(false);
    expect(validatePresentacion({ ...base, solicita: "x".repeat(2001) }).ok).toBe(false);
  });
  it("el representante no puede ser el mismo interesado", () => {
    const r = validatePresentacion({ ...base, representante: { ...JULIAN, cuit: MARTA.cuit } });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/mismo interesado/) });
    expect(validatePresentacion({ ...base, representante: JULIAN }).ok).toBe(true);
  });
});

describe("expedientes", () => {
  it("actuación: texto obligatorio; visible solo si viene true", () => {
    expect(validateActuacion({ texto: " Pase a Planeamiento " })).toEqual({ ok: true, value: { texto: "Pase a Planeamiento", visible: false } });
    expect(validateActuacion({ texto: "x", visible: "true" })).toMatchObject({ value: { visible: false } });
    expect(validateActuacion({ texto: "x", visible: true })).toMatchObject({ value: { visible: true } });
    expect(validateActuacion({ texto: "" }).ok).toBe(false);
    expect(validateActuacion({ texto: "x".repeat(3001) }).ok).toBe(false);
  });
  it("estado", () => {
    expect(validateEstado({ estado: "resuelto", motivo: " Listo " })).toEqual({ ok: true, value: { estado: "resuelto", motivo: "Listo" } });
    expect(validateEstado({ estado: "borrado" }).ok).toBe(false);
  });
  it("tipo: prefijo de 2 a 8 letras, en mayúsculas", () => {
    expect(validateTipo({ nombre: "Licencia de obra", prefijo: "obras" })).toEqual({ ok: true, value: { nombre: "Licencia de obra", prefijo: "OBRAS", activo: true } });
    expect(validateTipo({ nombre: "X", prefijo: "OB1" }).ok).toBe(false);
    expect(validateTipo({ nombre: "X", prefijo: "O" }).ok).toBe(false);
    expect(validateTipo({ nombre: "X", prefijo: "ÑANDÚ" }).ok).toBe(false);
    expect(validateTipo({ nombre: "", prefijo: "OBRAS" }).ok).toBe(false);
    expect(validateTipo({ nombre: "X", prefijo: "AB", activo: false })).toMatchObject({ value: { activo: false } });
  });
});

describe("configuración de la home", () => {
  const base = { organismo: "Municipalidad de Villa Ombúes", sigla: "vomb", bienvenida: "Hola", avisos: "", horario: "", contacto: "", color: "#2F5D50" };
  it("normaliza sigla y color", () => {
    expect(validateConfig(base)).toMatchObject({ ok: true, value: { sigla: "VOMB", color: "#2f5d50" } });
    expect(normalizeColor("#0a3")).toBe("#00aa33");
    expect(normalizeColor("verde")).toBeNull();
  });
  it("rechaza un color sobre el que no se leería el texto blanco", () => {
    expect(validateConfig({ ...base, color: "#f6b40e" })).toMatchObject({ ok: false, error: expect.stringMatching(/muy claro/) });
    expect(validateConfig({ ...base, color: "#74acdf" }).ok).toBe(false); // el celeste de la bandera: lindo, pero no se lee
    expect(validateConfig({ ...base, color: "#1f4e8c" }).ok).toBe(true);
  });
  it("campos obligatorios y largos", () => {
    expect(validateConfig({ ...base, organismo: "" }).ok).toBe(false);
    expect(validateConfig({ ...base, bienvenida: " " }).ok).toBe(false);
    expect(validateConfig({ ...base, avisos: "x".repeat(1501) })).toMatchObject({ ok: false, error: "«Avisos» puede tener hasta 1500 caracteres." });
    expect(validateConfig({ ...base, sigla: "V" }).ok).toBe(false);
  });
});
