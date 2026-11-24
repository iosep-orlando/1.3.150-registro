import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { homeFor } from "@/lib/next-url";

// proxy.ts (el sustituto de middleware.ts en Next.js 16): antes de cada
// página privada mira la sesión, sin base de datos, para que sea rápido.
// Las páginas y la API vuelven a comprobar el rol contra la base: la
// comprobación de verdad siempre es en el servidor.
//
//   /tramites/…  administrado (un funcionario va a /gestion)
//   /gestion/…   funcionario (un administrado va a /tramites)
//   /login       sin sesión (con sesión, al inicio de su rol)
//   /            la home pública: no pasa por acá
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  const session = jwt ? await verifySession(jwt) : null;

  const redirect = (to: string) => {
    const response = NextResponse.redirect(new URL(to, request.url));
    if (jwt && !session) response.cookies.delete(SESSION_COOKIE); // vencida o alterada
    return response;
  };

  if (pathname === "/login") return session ? redirect(homeFor(session.role)) : NextResponse.next();
  if (!session) return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  if (pathname.startsWith("/gestion") && session.role !== "funcionario") return redirect(homeFor(session.role));
  if (pathname.startsWith("/tramites") && session.role !== "administrado") return redirect(homeFor(session.role));
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/tramites", "/tramites/:path*", "/gestion", "/gestion/:path*"],
};
