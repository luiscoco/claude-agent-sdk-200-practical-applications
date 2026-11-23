import { createHash } from 'node:crypto';

export function validateImage(
  mediaType: unknown,
  data: unknown,
): {
  mediaType: 'image/png' | 'image/jpeg';
  data: string;
  bytes: number;
  sha256: string;
} {
  if (mediaType !== 'image/png' && mediaType !== 'image/jpeg')
    throw new Error('UNSUPPORTED_MEDIA_TYPE · This lab accepts PNG and JPEG images.');
  if (typeof data !== 'string' || !data || data.length > 7 * 1024 * 1024)
    throw new Error(
      'INVALID_IMAGE_DATA · Supply base64 image bytes within this lab’s 5 MiB decoded limit.',
    );
  const bytes = Buffer.from(data, 'base64');
  if (bytes.toString('base64') !== data || bytes.length > 5 * 1024 * 1024)
    throw new Error(
      'INVALID_IMAGE_DATA · Supply canonical base64 bytes without a data-URL prefix.',
    );
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(mediaType === 'image/png' ? png : jpeg))
    throw new Error(
      'MIME_MISMATCH · The selected media type does not match the image format header.',
    );
  return {
    mediaType,
    data,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function validateQuestion(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw new Error('INVALID_QUESTION · Enter between 1 and 2000 characters.');
  return value.trim();
}
