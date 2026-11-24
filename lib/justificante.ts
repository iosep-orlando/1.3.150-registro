import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatBytes } from "./format";
import { CARACTER_LABEL, textOn } from "./tramite";
import { formatCuit } from "./validation";
import type { AdjuntoDTO, Persona, Representante } from "./types";

// ---------------------------------------------------------------------------
// El justificante de presentación (el "cargo" de la mesa de entradas): el
// comprobante que recibe quien presenta, con el número de registro, la
// fecha y hora, lo que expuso y solicitó, y la huella SHA-256 de cada
// adjunto. Con la huella, cualquiera puede comprobar después que un
// archivo es exactamente el que se presentó.
// ---------------------------------------------------------------------------

export interface JustificanteData {
  organismo: string;
  color: string;
  numero: string;
  fecha: Date;
  interesado: Persona;
  representante: Representante | null;
  expone: string;
  solicita: string;
  adjuntos: Pick<AdjuntoDTO, "filename" | "size" | "sha256">[];
}

export interface Escudo {
  bytes: Uint8Array;
  contentType: string;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 48;
const INK = rgb(0.08, 0.09, 0.12);
const MUTED = rgb(0.36, 0.38, 0.43);
const RULE = rgb(0.8, 0.82, 0.85);

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** "23/11/2026 17:42:10" en hora argentina. */
export function fechaHoraAR(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(",", "");
}

/**
 * Las fuentes estándar del PDF solo tienen los caracteres de Windows-1252
 * (con tildes, ñ, ¿, ¡). Un emoji en un texto haría fallar todo el PDF: se
 * cambia por "?".
 */
export function pdfSafe(font: PDFFont, value: string): string {
  let out = "";
  for (const char of value.replace(/\t/g, " ").replace(/\r\n?/g, "\n")) {
    if (char === "\n") {
      out += char; // los saltos de párrafo los maneja wrap()
      continue;
    }
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Corta un texto en renglones que entren en `width` (respetando los saltos de párrafo). */
export function wrap(font: PDFFont, value: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(font, value).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

export async function renderJustificante(data: JustificanteData, escudo: Escudo | null = null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Justificante de presentación ${data.numero}`);
  doc.setAuthor(data.organismo);
  doc.setCreator("Mesa de Entradas Virtual");
  doc.setProducer("Mesa de Entradas Virtual (pdf-lib)");
  doc.setCreationDate(data.fecha);
  doc.setModificationDate(data.fecha);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  let image: PDFImage | null = null;
  if (escudo) {
    try {
      image = escudo.contentType === "image/png" ? await doc.embedPng(escudo.bytes) : await doc.embedJpg(escudo.bytes);
    } catch {
      image = null; // un escudo dañado no impide el justificante
    }
  }

  const width = PAGE.width - MARGIN * 2;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    // La franja del color institucional, con el nombre del organismo.
    const band = 64;
    const color = hexToRgb(data.color);
    const on = textOn(data.color) === "#ffffff" ? rgb(1, 1, 1) : INK;
    page.drawRectangle({ x: 0, y: PAGE.height - band, width: PAGE.width, height: band, color });
    let x = MARGIN;
    if (image) {
      const scale = Math.min(44 / image.height, 60 / image.width, 1);
      page.drawImage(image, { x, y: PAGE.height - band / 2 - (image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
      x += image.width * scale + 12;
    }
    page.drawText(pdfSafe(bold, data.organismo), { x, y: PAGE.height - 30, size: 14, font: bold, color: on });
    page.drawText("Mesa de Entradas Virtual", { x, y: PAGE.height - 46, size: 9, font: regular, color: on });
    y = PAGE.height - band - 32;
  };

  /** Asegura `h` puntos libres; si no hay, página nueva. */
  const need = (h: number) => {
    if (y - h < MARGIN + 40) newPage();
  };
  const line = (value: string, size = 10, font = regular, color = INK, x = MARGIN) => {
    need(size + 4);
    page.drawText(value, { x, y, size, font, color });
    y -= size + 5;
  };
  const paragraph = (value: string, size = 10) => {
    for (const row of wrap(regular, value, size, width)) line(row, size);
  };
  const heading = (value: string) => {
    need(40);
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y: y + 14 }, end: { x: PAGE.width - MARGIN, y: y + 14 }, thickness: 0.6, color: RULE });
    line(value, 11, bold);
    y -= 2;
  };
  const field = (label: string, value: string) => {
    need(16);
    page.drawText(pdfSafe(regular, label), { x: MARGIN, y, size: 9.5, font: regular, color: MUTED });
    const rows = wrap(regular, value, 10, width - 130);
    rows.forEach((row, i) => {
      if (i > 0) need(15);
      page.drawText(row, { x: MARGIN + 130, y, size: 10, font: i === 0 ? bold : regular, color: INK });
      if (i < rows.length - 1) y -= 15;
    });
    y -= 16;
  };

  newPage();
  line("Justificante de presentación", 20, bold);
  y -= 6;
  field("Número de registro", data.numero);
  field("Fecha y hora", `${fechaHoraAR(data.fecha)} (hora argentina)`);

  heading("Interesado");
  field("Nombre o razón social", data.interesado.nombre);
  field("CUIT / CUIL", formatCuit(data.interesado.cuit));
  field("Domicilio fiscal", data.interesado.domicilio);

  if (data.representante) {
    heading("Representante");
    field("Nombre o razón social", data.representante.nombre);
    field("CUIT / CUIL", formatCuit(data.representante.cuit));
    field("Domicilio fiscal", data.representante.domicilio);
    field("Carácter", CARACTER_LABEL[data.representante.caracter]);
  }

  heading("Expone");
  paragraph(data.expone);
  heading("Solicita");
  paragraph(data.solicita);

  heading("Documentación adjunta");
  if (data.adjuntos.length === 0) line("Sin documentación adjunta.", 10, regular, MUTED);
  data.adjuntos.forEach((a, i) => {
    need(32);
    line(`${i + 1}. ${pdfSafe(bold, a.filename)} (${formatBytes(a.size)})`, 10, bold);
    line(`SHA-256: ${a.sha256}`, 7.5, mono, MUTED, MARGIN + 14);
    y -= 2;
  });

  // Pie de cada página.
  const footer =
    "Este justificante acredita la presentación y su contenido. La huella SHA-256 identifica cada archivo: cualquier cambio en el archivo cambia la huella. Sitio de práctica: no es un organismo real.";
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 22 }, end: { x: PAGE.width - MARGIN, y: MARGIN + 22 }, thickness: 0.6, color: RULE });
    wrap(regular, footer, 7, width - 60).forEach((row, r) => p.drawText(row, { x: MARGIN, y: MARGIN + 12 - r * 9, size: 7, font: regular, color: MUTED }));
    const label = `${data.numero}  ·  Página ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 7), y: MARGIN - 14, size: 7, font: regular, color: MUTED });
  });

  return doc.save();
}
