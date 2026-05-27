import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/"]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hasSession = !!req.cookies.get("session")?.value;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/audios/upload)(?!.*\\\\..*).*)"],
};

