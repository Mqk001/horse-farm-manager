import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const PHOTO_MAX_BYTES = 256 * 1024;
export async function normalizeHorsePhoto(input: Uint8Array) {
  if (!input.length || input.length > PHOTO_MAX_BYTES || input[0] !== 0xff || input[1] !== 0xd8 || input[2] !== 0xff) throw new Error('Upload a cropped JPEG photo under 256 KiB.');
  const image = sharp(input, { limitInputPixels: 1024 * 1024, failOn: 'warning' }).timeout({ seconds: 5 });
  const metadata = await image.metadata();
  if (metadata.format !== 'jpeg' || metadata.width !== 640 || metadata.height !== 640) throw new Error('Use the photo cropper to prepare a square photo.');
  // Re-encode on the server. Do not retain EXIF, location, original bytes or filenames.
  const data = await image.rotate().resize(640, 640, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
  if (data.length > PHOTO_MAX_BYTES) throw new Error('This photo is too detailed. Try a smaller crop.');
  const version = createHash('sha256').update(data).digest('hex').slice(0, 20);
  return { data, version };
}

export function horsePhotoUrl(horseId: string, version: string) {
  return `/api/horses/${encodeURIComponent(horseId)}/photo?v=${version}`;
}
