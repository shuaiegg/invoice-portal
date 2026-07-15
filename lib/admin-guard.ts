import { auth } from "./auth";
import { isAdminUser } from "./auth-role";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!(await isAdminUser(session.user.id))) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    session,
  };
}
