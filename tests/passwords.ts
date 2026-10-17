import assert from 'node:assert/strict';
import { scrypt as nativeScrypt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword, isLegacyPasswordHash } from '../src/lib/passwords';

async function main() {
  const start = performance.now();
  const password = 'a'.repeat(72) + 'correct-suffix';
  const encoded = await hashPassword(password);
  console.log(`scrypt hash on this machine: ${Math.round(performance.now() - start)} ms`);
  assert.ok(encoded.startsWith('$scrypt$v1$32768$8$3$'));
  assert.ok(await verifyPassword(password, encoded));
  assert.equal(await verifyPassword('a'.repeat(72) + 'wrong-suffix', encoded), false);
  assert.equal(await verifyPassword('a'.repeat(72), encoded), false);
  const second = await hashPassword(password);
  assert.notEqual(encoded, second);
  const unicode = '🐎'.repeat(25);
  assert.ok(await verifyPassword(unicode, await hashPassword(unicode)));
  const parts = encoded.split('$');
  const independent = await new Promise<Buffer>((resolve, reject) => nativeScrypt(password, Buffer.from(parts[6], 'base64url'), 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
  assert.equal(independent.toString('base64url'), parts[7]);
  for (const invalid of ['', '$scrypt$v1$1$8$3$bad$bad', encoded.replace('$32768$', '$1073741824$'), encoded+'x', 'plaintext', '$2b$12$bad']) assert.equal(await verifyPassword('password', invalid), false);
  assert.equal(await verifyPassword('x'.repeat(129), encoded), false);
  await assert.rejects(hashPassword('x'.repeat(129)));
  const legacy = await bcrypt.hash('legacy-password', 4);
  assert.ok(isLegacyPasswordHash(legacy));
  assert.ok(await verifyPassword('legacy-password', legacy));
  assert.equal(await verifyPassword('wrong-password', legacy), false);
  const truncatedLegacy = await bcrypt.hash(password, 4);
  assert.equal(await verifyPassword(password, truncatedLegacy), false);
  assert.equal(await verifyPassword('a'.repeat(72)+'wrong-suffix', truncatedLegacy), false);
  const unicodeLegacy = await bcrypt.hash(unicode,4);
  assert.equal(await verifyPassword(unicode, unicodeLegacy), false);
  console.log('PASS: standard-library scrypt interoperability, random salts, long/Unicode suffix distinction, bounded parsing, legacy bcrypt verification and overlong legacy rejection.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
