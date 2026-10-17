import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

// OWASP's memory/CPU-balanced scrypt profile: 32 MiB, N=2^15, r=8, p=3.
// Fixed parameters also prevent an encoded hash from requesting unbounded work.
const PREFIX = '$scrypt$v1$32768$8$3$';
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const LEGACY = /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}
function validInput(password: string) {
  return password.length > 0 && password.length <= 128;
}
export function isLegacyPasswordHash(encoded: string) { return LEGACY.test(encoded); }
export async function hashPassword(password: string): Promise<string> {
  if (!validInput(password)) throw new Error('Password must contain 1–128 characters.');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${PREFIX}${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!validInput(password)) return false;
  if (isLegacyPasswordHash(encoded)) {
    // bcrypt discards bytes after byte 72. Never authenticate a supplied suffix
    // that the stored hash cannot verify; those users can use password recovery.
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    return bcrypt.compare(password, encoded);
  }
  if (!encoded.startsWith(PREFIX)) return false;
  const parts = encoded.slice(PREFIX.length).split('$');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]{22}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const salt = Buffer.from(parts[0], 'base64url');
  const expected = Buffer.from(parts[1], 'base64url');
  if (salt.toString('base64url') !== parts[0] || expected.toString('base64url') !== parts[1]) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
