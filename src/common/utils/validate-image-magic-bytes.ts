/**
 * Multer's fileFilter only sees the client-declared Content-Type before the
 * body is read, so it can't catch a renamed/relabeled file — anyone can send
 * a .exe with `Content-Type: image/png` and it would pass. This checks the
 * actual file signature (magic bytes) once the buffer is available, for the
 * exact three formats every upload endpoint in this app accepts.
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng(buf: Buffer): boolean {
  return buf.length >= PNG_SIGNATURE.length && buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export function isValidImageBuffer(buffer: Buffer): boolean {
  return isJpeg(buffer) || isPng(buffer) || isWebp(buffer);
}
