import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizeHorsePhoto, PHOTO_MAX_BYTES } from '../src/lib/horse-photo';
async function main() {
 const jpeg = await sharp({ create: { width: 640, height: 640, channels: 3, background: '#e67133' } }).withMetadata().jpeg().toBuffer();
 const photo = await normalizeHorsePhoto(jpeg), metadata = await sharp(photo.data).metadata();
 assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 640); assert.equal(metadata.height, 640);
 assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined); assert.ok(photo.data.length < PHOTO_MAX_BYTES);
 assert.equal((await normalizeHorsePhoto(jpeg)).version, photo.version);
 const different = await sharp({ create: { width: 640, height: 640, channels: 3, background: '#3355dd' } }).jpeg().toBuffer();
 assert.notEqual((await normalizeHorsePhoto(different)).version, photo.version);
 for (const input of [Buffer.from('<svg onload="alert(1)"></svg>'), Buffer.alloc(PHOTO_MAX_BYTES + 1), jpeg.subarray(0, 150), await sharp({ create: { width: 4096, height: 4096, channels: 3, background: '#fff' } }).jpeg().toBuffer(), await sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } }).jpeg().toBuffer()]) await assert.rejects(normalizeHorsePhoto(input));
 console.log('PASS: decoded dimensions/pixel limits, JPEG-only validation, malformed/truncated/oversized rejection, deterministic versions and metadata-free 640px WebP output.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
