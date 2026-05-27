import crypto from "node:crypto";

export function hashPassword(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
