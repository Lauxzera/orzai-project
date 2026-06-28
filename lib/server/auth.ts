import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getUserById, type SessionUser } from "@/lib/server/crm-repository";

const SESSION_COOKIE = "belart-crm-auth";
const SESSION_MAX_AGE = 60 * 60 * 12;

function shouldUseSecureCookie() {
  const explicit = (process.env.AUTH_COOKIE_SECURE || "").trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(explicit)) return true;
  if (["false", "0", "no", "nao"].includes(explicit)) return false;

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().toLowerCase();
  return appUrl.startsWith("https://");
}

function getSecret() {
  const raw = process.env.AUTH_SECRET || "";
  if (!raw || raw === "belart-crm-dev-secret-change-me") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET nao configurado. Defina a variavel de ambiente AUTH_SECRET antes de rodar em producao.");
    }
    return new TextEncoder().encode("belart-crm-dev-secret-change-me");
  }
  return new TextEncoder().encode(raw);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    const userId = String(verified.payload.sub || "");
    if (!userId) return null;
    return getUserById(userId);
  } catch {
    return null;
  }
}
