import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

export type ThumbPair = {
  x1: string; // data URI for 1x DPR
  x2: string; // data URI for 2x DPR
};

function resolvePublicPath(p: string): string {
  // Accept absolute "/assets/..." and relative paths; resolve against project root `public`.
  const clean = p.replace(/^\/*/, '');
  return path.join(process.cwd(), 'public', clean);
}

export async function makeSquareThumbs(
  srcPath: string,
  size = 84,
): Promise<ThumbPair> {
  const abs = srcPath.startsWith('/') ? resolvePublicPath(srcPath) : path.resolve(process.cwd(), srcPath);
  // Ensure source exists
  await fs.access(abs);

  // Common resize options for best quality downscale
  // Use center cropping for consistent framing across posts
  const resize = { width: size, height: size, fit: 'cover' as const, position: 'center' as const, kernel: sharp.kernel.lanczos3, fastShrinkOnLoad: false };
  const resize2x = { ...resize, width: size * 2, height: size * 2 };

  const pipeline = sharp(abs, { failOn: 'none' });
  const metadata = await pipeline.metadata();
  const animated = Boolean(metadata.pages && metadata.pages > 1);

  // For GIFs/APNGs just take the first frame for the thumb.
  const base = sharp(abs, { pages: 1, limitInputPixels: false });

  const [b1, b2] = await Promise.all([
    base.clone().resize(resize).webp({ quality: 82, effort: 4, alphaQuality: 80 }).toBuffer(),
    base.clone().resize(resize2x).webp({ quality: 84, effort: 4, alphaQuality: 80 }).toBuffer(),
  ]);

  const x1 = `data:image/webp;base64,${b1.toString('base64')}`;
  const x2 = `data:image/webp;base64,${b2.toString('base64')}`;
  return { x1, x2 };
}
