import crypto from "node:crypto";

type JwtPayload = {
  sub: number;
  account: string;
  role: "USER" | "ADMIN";
  exp: number;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const DAY_SECONDS = 24 * 60 * 60;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(input: string) {
  return crypto.createHmac("sha256", JWT_SECRET).update(input).digest("base64url");
}

export function issueToken(input: { sub: number; account: string; role: "USER" | "ADMIN" }, maxAgeSeconds = 7 * DAY_SECONDS) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: input.sub,
      account: input.account,
      role: input.role,
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    } satisfies JwtPayload),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const body = `${header}.${payload}`;
  const expected = sign(body);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtPayload;
    if (!decoded.sub || !decoded.account || !decoded.role || !decoded.exp) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
