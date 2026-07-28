import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, keyLength);
  return `${salt}:${(derivedKey as Buffer).toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

