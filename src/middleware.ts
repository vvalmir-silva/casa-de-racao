import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const protegidas: [string, string[]][] = [
  ["/admin", ["admin"]],
  ["/motorista", ["motorista", "admin"]],
  ["/conta", ["cliente", "admin", "motorista"]],
  ["/checkout", ["cliente", "admin", "motorista"]],
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const regra = protegidas.find(([p]) => path === p || path.startsWith(p + "/"));
  if (!regra) return NextResponse.next();
  const token = req.cookies.get("cr_sessao")?.value;
  const login = new URL(`/login?next=${encodeURIComponent(path)}`, req.url);
  if (!token) return NextResponse.redirect(login);
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
    if (!regra[1].includes(String(payload.papel))) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = { matcher: ["/admin/:path*", "/motorista/:path*", "/conta/:path*", "/checkout"] };
