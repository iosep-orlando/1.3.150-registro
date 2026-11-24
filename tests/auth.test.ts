import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { formatBytes, formatDateTime, plural } from "@/lib/format";
import { escapeHtml } from "@/lib/html";
import { SESSION_COOKIE, getSecret, signSession, verifySession } from "@/lib/jwt";
import { homeFor, safeNext } from "@/lib/next-url";
import { funcionarioEmails, roleFor } from "@/lib/roles";
import { proxy } from "@/proxy";

describe("roles por FUNCIONARIO_EMAILS", () => {
  const env = { FUNCIONARIO_EMAILS: " Lucia@Registro.test, otra@x.co ,," };
  it("lee la lista sin espacios ni mayúsculas", () => {
    expect(funcionarioEmails(env)).toEqual(["lucia@registro.test", "otra@x.co"]);
    expect(funcionarioEmails({})).toEqual([]);
  });
  it("funcionario si está en la lista; si no, ciudadano", () => {
    expect(roleFor("LUCIA@registro.test", env)).toBe("funcionario");
    expect(roleFor("vecina@registro.test", env)).toBe("administrado");
    expect(roleFor("lucia@registro.test", {})).toBe("administrado");
  });
});

describe("sesión con rol", () => {
  it("firma y verifica", async () => {
    const jwt = await signSession({ sub: "u1", email: "a@b.co", role: "funcionario" });
    expect(await verifySession(jwt)).toEqual({ sub: "u1", email: "a@b.co", role: "funcionario" });
  });
  it("rechaza un token alterado o con un rol inventado", async () => {
    const jwt = await signSession({ sub: "u1", email: "a@b.co", role: "administrado" });
    expect(await verifySession(jwt.slice(0, -2) + "xx")).toBeNull();
    const fake = await signSession({ sub: "u1", email: "a@b.co", role: "superusuario" as "funcionario" });
    expect(await verifySession(fake)).toBeNull();
  });
  it("en producción el secreto es obligatorio", () => {
    expect(() => getSecret({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
    expect(getSecret({ NODE_ENV: "development" }).length).toBeGreaterThan(10);
  });
});

describe("adónde ir después de entrar", () => {
  it("cada rol a su inicio, y solo a páginas de la app que le tocan", () => {
    expect(homeFor("funcionario")).toBe("/gestion");
    expect(homeFor("administrado")).toBe("/tramites");
    expect(safeNext("/tramites/nueva", "administrado")).toBe("/tramites/nueva");
    expect(safeNext("/gestion/expedientes?estado=resuelto", "funcionario")).toBe("/gestion/expedientes?estado=resuelto");
    expect(safeNext("/gestion", "administrado")).toBe("/tramites");
    expect(safeNext("/tramites/nueva", "funcionario")).toBe("/gestion");
    expect(safeNext("https://malo.test", "funcionario")).toBe("/gestion");
    expect(safeNext("//malo.test/tramites", "administrado")).toBe("/tramites");
    expect(safeNext("/tramitesx", "administrado")).toBe("/tramites");
    expect(safeNext(undefined, "administrado")).toBe("/tramites");
  });
});

describe("proxy.ts", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(new URL(path, "http://localhost:3000"), { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });
  const location = (r: Response) => r.headers.get("location");

  it("sin sesión, al login recordando adónde iba", async () => {
    expect(location(await proxy(request("/tramites/nueva")))).toBe("http://localhost:3000/login?next=%2Ftramites%2Fnueva");
    expect(location(await proxy(request("/gestion?filtro=todas")))).toContain("/login?next=%2Fgestion%3Ffiltro%3Dtodas");
  });
  it("un ciudadano no entra a /gestion", async () => {
    const jwt = await signSession({ sub: "u1", email: "a@b.co", role: "administrado" });
    expect(location(await proxy(request("/gestion/configuracion", jwt)))).toBe("http://localhost:3000/tramites");
    expect(location(await proxy(request("/tramites", jwt)))).toBeNull();
  });
  it("un funcionario va a /gestion, no a /tramites", async () => {
    const jwt = await signSession({ sub: "u1", email: "a@b.co", role: "funcionario" });
    expect(location(await proxy(request("/gestion/expedientes", jwt)))).toBeNull();
    expect(location(await proxy(request("/tramites/nueva", jwt)))).toBe("http://localhost:3000/gestion");
  });
  it("con sesión, el login lleva al inicio del rol", async () => {
    const f = await signSession({ sub: "u1", email: "a@b.co", role: "funcionario" });
    const a = await signSession({ sub: "u2", email: "c@d.co", role: "administrado" });
    expect(location(await proxy(request("/login", f)))).toBe("http://localhost:3000/gestion");
    expect(location(await proxy(request("/login", a)))).toBe("http://localhost:3000/tramites");
    expect(location(await proxy(request("/login")))).toBeNull();
  });
  it("una sesión alterada se borra", async () => {
    const r = await proxy(request("/tramites", "basura"));
    expect(location(r)).toContain("/login");
    expect(r.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
  });
});

describe("formatos", () => {
  it("varios", () => {
    expect(plural(1, "adjunto", "adjuntos")).toBe("1 adjunto");
    expect(plural(1500, "presentación", "presentaciones")).toBe("1.500 presentaciones");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3,5 MB");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("2026-11-23T00:05:00Z")).toMatch(/22 nov.*21:05/);
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
