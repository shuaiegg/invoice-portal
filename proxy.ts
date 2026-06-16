import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"  
  ],
};
