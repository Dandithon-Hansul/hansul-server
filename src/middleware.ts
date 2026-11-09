import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(allowed: string[], requestOrigin: string): Record<string, string> | null {
  if (!allowed.includes(requestOrigin)) return null;
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin",
  };
}

export function middleware(request: NextRequest) {
  const headers = corsHeaders(allowedOrigins, request.headers.get("origin") ?? "");
  if (!headers) return NextResponse.next();

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 200, headers });
  }

  const response = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = { matcher: "/api/:path*" };
