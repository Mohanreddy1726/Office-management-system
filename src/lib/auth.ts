import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SessionPayload, AUTH_COOKIE_NAME, UserRole, ROLE_LABELS } from "@/types/auth";

export * from "@/types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_officeflow_production_key_change_me_in_prod_998877";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
