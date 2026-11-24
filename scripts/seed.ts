// Datos de ejemplo para la Mesa de Entradas Virtual de la Municipalidad de
// Villa Ombúes (un organismo inventado):
//   - la home configurada (textos, color y escudo);
//   - cuatro tipos de expediente;
//   - un funcionario y dos ciudadanos;
//   - cuatro presentaciones con adjuntos y justificante; dos ya tienen
//     expediente, con actuaciones visibles e internas.
//
//   npm run seed
//
// Lee .env.local. El funcionario es SEED_FUNCIONARIO_EMAIL, o el primero de
// FUNCIONARIO_EMAILS, o funcionario@registro.test; para que entre como
// funcionario, su email tiene que estar en FUNCIONARIO_EMAILS.
//
// Se puede correr las veces que quieras: borra y vuelve a crear SOLO las
// presentaciones de los ciudadanos de ejemplo (las tuyas no se tocan). Los
// números de registro siguen corriendo: un número dado no se reutiliza.
//
// Las presentaciones se crean con el mismo código que usa la web
// (createRegistro, abrirExpediente...), así que también mandan los avisos
// por mail (a MailHog en desarrollo, o a /bandeja en la demo).

import { existsSync, readFileSync } from "node:fs";
import type { Caller } from "../lib/auth";
import { closeDb, collections } from "../lib/db";
import { funcionarioEmails, roleFor } from "../lib/roles";
import { ensureBucket, escudoKey, putObject } from "../lib/storage";
import { saveConfig, setEscudo } from "../lib/store/config";
import { abrirExpediente, addActuacion, cambiarEstado } from "../lib/store/expedientes";
import { createRegistro, type Upload } from "../lib/store/registros";
import { DEFAULT_CONFIG } from "../lib/tramite";
import { validateEmail } from "../lib/validation";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Un PDF mínimo de una página, armado a mano. */
function tinyPdf(title: string, lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = ["BT /F1 18 Tf 56 780 Td", `(${esc(title)}) Tj`, "/F1 11 Tf 0 -32 Td", ...lines.flatMap((l) => [`(${esc(l)}) Tj`, "0 -18 Td"]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(text, "latin1")} >>\nstream\n${text}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

const pdf = (name: string, title: string, lines: string[]): Upload => ({ name, type: "application/pdf", bytes: tinyPdf(title, lines) });

const TIPOS = [
  { nombre: "Licencia de obra", prefijo: "OBRAS" },
  { nombre: "Habilitación comercial", prefijo: "HAB" },
  { nombre: "Reclamo", prefijo: "RECLAMO" },
  { nombre: "Trámite general", prefijo: "GRAL" },
];

const CIUDADANOS = [
  { email: "vecina@registro.test", name: "Marta Suárez" },
  { email: "estudio@registro.test", name: "Estudio Pereyra" },
];

async function main() {
  const funcEmail = validateEmail(process.env.SEED_FUNCIONARIO_EMAIL || funcionarioEmails()[0] || "funcionario@registro.test");
  if (!funcEmail.ok) throw new Error("SEED_FUNCIONARIO_EMAIL no es un email válido.");
  const { users, tipos, registros, expedientes } = await collections();
  const now = new Date();

  // --- Usuarios ---
  const user = async (email: string, name: string) =>
    (await users.findOneAndUpdate({ email }, { $set: { name, role: roleFor(email) }, $setOnInsert: { email, createdAt: now } }, { upsert: true, returnDocument: "after" }))!;
  const caller = (u: Awaited<ReturnType<typeof user>>, role: Caller["role"]): Caller => ({ userId: u._id, email: u.email, name: u.name, role });
  const func = caller(await user(funcEmail.value, "Lucía Ferrari"), "funcionario");
  const [marta, estudio] = await Promise.all(CIUDADANOS.map(async (c) => caller(await user(c.email, c.name), "administrado")));

  // --- La home y el escudo ---
  await saveConfig({ ...DEFAULT_CONFIG });
  let s3 = true;
  try {
    await ensureBucket();
    const escudo = new Uint8Array(readFileSync("scripts/escudo-villa-ombues.png"));
    await putObject(escudoKey(), escudo, "image/png");
    await setEscudo({ key: escudoKey(), contentType: "image/png", updatedAt: now });
  } catch (error) {
    s3 = false;
    console.warn("OJO: no se pudo usar el bucket (¿RustFS levantado y AWS_URL bien?). Sigo sin escudo ni adjuntos.", (error as Error).message);
  }
  const files = (list: Upload[]) => (s3 ? list : []);

  // --- Tipos de expediente (por prefijo: no se duplican) ---
  for (const t of TIPOS) {
    await tipos.updateOne({ prefijo: t.prefijo }, { $setOnInsert: { ...t, activo: true, createdAt: now } }, { upsert: true });
  }
  const tipo = async (prefijo: string) => (await tipos.findOne({ prefijo }))!._id.toString();

  // --- Borra las presentaciones de ejemplo anteriores ---
  const ids = [marta.userId, estudio.userId];
  const viejos = await registros.find({ userId: { $in: ids } }, { projection: { _id: 1 } }).toArray();
  await expedientes.deleteMany({ registroId: { $in: viejos.map((r) => r._id) } });
  await registros.deleteMany({ userId: { $in: ids } });

  // --- Presentaciones ---
  const martaPersona = { nombre: "Marta Suárez", cuit: "27284567892", domicilio: "Los Talas 455, Villa Ombúes" };

  const obra = await createRegistro(
    marta,
    {
      interesado: martaPersona,
      representante: null,
      expone: "Soy propietaria del inmueble de Los Talas 455. Quiero ampliar la vivienda con un dormitorio de 12 m² en planta baja, sobre el fondo del terreno, respetando los retiros.",
      solicita: "Que se otorgue el permiso de obra para la ampliación según el plano que adjunto.",
    },
    files([
      pdf("plano-ampliacion.pdf", "Plano de ampliacion - Los Talas 455", ["Planta baja: dormitorio nuevo de 12 m2", "Retiro de fondo: 4 m", "Escala 1:100 (ejemplo)"]),
      pdf("escritura.pdf", "Escritura (copia de ejemplo)", ["Inmueble: Los Talas 455", "Titular: Marta Suarez"]),
    ]),
  );

  const local = await createRegistro(
    estudio,
    {
      interesado: { nombre: "Panadería La Espiga SRL", cuit: "30712345671", domicilio: "Av. San Martín 1200, Villa Ombúes" },
      representante: { nombre: "Julián Pereyra", cuit: "20301234563", domicilio: "Belgrano 88, Villa Ombúes", caracter: "apoderado" },
      expone: "La sociedad alquiló el local de Av. San Martín 1200 para abrir una panadería con venta al público y elaboración propia.",
      solicita: "La habilitación comercial del local para el rubro panadería con elaboración.",
    },
    files([
      pdf("contrato-locacion.pdf", "Contrato de locacion (ejemplo)", ["Local: Av. San Martin 1200", "Plazo: 36 meses"]),
      pdf("poder.pdf", "Poder general (ejemplo)", ["Apoderado: Julian Pereyra"]),
      pdf("plano-local.pdf", "Plano del local (ejemplo)", ["Superficie: 85 m2", "Cuadra de elaboracion: 30 m2"]),
    ]),
  );

  const reclamo = await createRegistro(
    marta,
    {
      interesado: martaPersona,
      representante: null,
      expone: "Desde hace dos semanas está apagada la luminaria de la esquina de Los Talas y Ceibo. De noche la cuadra queda a oscuras.",
      solicita: "Que se repare el alumbrado público de esa esquina.",
    },
    files([]),
  );

  await createRegistro(
    estudio,
    {
      interesado: { nombre: "Panadería La Espiga SRL", cuit: "30712345671", domicilio: "Av. San Martín 1200, Villa Ombúes" },
      representante: { nombre: "Julián Pereyra", cuit: "20301234563", domicilio: "Belgrano 88, Villa Ombúes", caracter: "apoderado" },
      expone: "Para la panadería necesitamos colocar un cartel saliente sobre la vereda, de 1,20 m por 0,60 m.",
      solicita: "Autorización para colocar el cartel.",
    },
    files([]),
  );

  // --- Expedientes ---
  const exObra = await abrirExpediente(func, obra.id, await tipo("OBRAS"));
  await addActuacion(func, exObra.id, { texto: "Pase a Planeamiento para revisar el plano y los retiros.", visible: true });
  await addActuacion(func, exObra.id, { texto: "Nota interna: verificar en el catastro si hay una ampliación anterior sin declarar.", visible: false });
  await addActuacion(func, exObra.id, { texto: "Planeamiento pide el cálculo de estructura firmado por un profesional. Podés presentarlo como una nueva nota citando este expediente.", visible: true });

  const exReclamo = await abrirExpediente(func, reclamo.id, await tipo("RECLAMO"));
  await addActuacion(func, exReclamo.id, { texto: "Orden de trabajo 318 a Alumbrado Público.", visible: false });
  await cambiarEstado(func, exReclamo.id, "resuelto", "Se cambió la lámpara de la esquina de Los Talas y Ceibo.");

  console.log(`Listo. Funcionario: ${funcEmail.value}. Ciudadanos: ${CIUDADANOS.map((c) => c.email).join(" y ")}.`);
  console.log(`Presentaciones: ${obra.numero}, ${local.numero} (sin expediente), ${reclamo.numero} y una más sin expediente.`);
  console.log(`Expedientes: ${exObra.codigo} (en trámite) y ${exReclamo.codigo} (resuelto).`);
  if (roleFor(funcEmail.value) !== "funcionario") {
    console.warn(`OJO: ${funcEmail.value} no está en FUNCIONARIO_EMAILS, así que va a entrar como ciudadano. Agregalo en .env.local.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
