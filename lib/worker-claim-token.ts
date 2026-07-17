import { randomBytes } from "node:crypto";

const CLAIM_TOKEN_TTL_DAYS = 21;

export function generateClaimToken(): { token: string; expiresAt: Date } {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}
