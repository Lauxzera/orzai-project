import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Auth is handled via JWT cookie (jose) in lib/server/auth.ts.
// No middleware-level auth required.
export function middleware(request: NextRequest) {
  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
