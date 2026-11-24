import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import Theme from "@/components/Theme";
import "./globals.css";

// Las dos letras (licencia OFL) están en el repo: compilar no depende de la red.
// Atkinson Hyperlegible se diseñó para personas con baja visión: un sitio
// público tiene que poder leerlo todo el mundo.
const atkinson = localFont({
  src: "./fonts/atkinson-variable.woff2",
  variable: "--font-atkinson",
  weight: "200 800",
  display: "swap",
});
const bitter = localFont({
  src: "./fonts/bitter-variable.woff2",
  variable: "--font-bitter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mesa de Entradas Virtual", template: "%s · Mesa de Entradas Virtual" },
  description: "Presentá notas y solicitudes con documentación adjunta, recibí el justificante al instante y seguí tu expediente.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${atkinson.variable} ${bitter.variable} h-full antialiased`}>
      <body className="min-h-full bg-hoja font-sans text-tinta">
        <Suspense fallback={null}>
          <Theme />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
