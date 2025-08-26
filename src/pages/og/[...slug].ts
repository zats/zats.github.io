import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION, OG_VERSION } from '../../consts';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { OGImageRoute } from 'astro-og-canvas';

// Build a mapping from blog post slug to its frontmatter data
const posts = await getCollection('blog');
const pages: Record<string, any> = Object.fromEntries(posts.map((p) => [p.id, p.data]));

// Add a root entry for the homepage OG image
pages['index'] = { title: SITE_TITLE, description: SITE_DESCRIPTION };
pages['blog'] = { title: SITE_TITLE, description: SITE_DESCRIPTION };

export const { GET, getStaticPaths } = OGImageRoute({
  // Catch-all param matches `[...slug].ts`
  param: 'slug',
  pages,
  // Map each page's data to image options
  getImageOptions: async (routePath, data) => {
    const seed = routePath ?? data.title ?? 'og';
    const stops = gradientFromSlug(seed);
    const angle = randomAngle(seed);
    const cacheBase = pathForCacheBase();
    const bgPath = await ensureGradientImage(cacheBase, seed, 1200, 630, stops, angle);
    const borderColor = borderFromStops(stops);
    return {
      cacheDir: path.join(cacheBase, 'og-canvas'),
      title: data.title,
      description: data.description,
      width: 1200,
      height: 630,
      padding: 72,
      // Base gradient (will be fully covered by bgImage)
      bgGradient: stops,
      bgImage: {
        path: bgPath,
        fit: 'fill',
        position: 'center',
      },
      border: {
        color: borderColor,
        width: 0,
        side: 'block-start',
      },
      font: {
        title: { size: 72, lineHeight: 78, families: ['Noto Sans'] },
        description: { size: 40, lineHeight: 46, families: ['Noto Sans'] },
      },
      // Ensure fonts are available during render
      fonts: [
        'https://api.fontsource.org/v1/fonts/noto-sans/latin-700-normal.ttf',
        'https://api.fontsource.org/v1/fonts/noto-sans/latin-400-normal.ttf',
      ],
};
  },
});

// Deterministic gradient generator based on slug
function gradientFromSlug(slug: string) {
  const rnd = mulberry32(hashString(slug));
  const base = Math.floor(rnd() * 360);
  const variant = rnd();
  // Keep backgrounds dark for readable white text
  const s = 68 + rnd() * 20; // 68–88% saturation
  const l1 = 26 + rnd() * 4; // 26–30% lightness
  const l2 = l1 + 6;         // +6
  const l3 = l2 + 6;         // +12

  let hues: number[];
  if (variant < 0.45) {
    // Analogous cluster (safe & smooth)
    const offset = 12 + rnd() * 10; // 12–22°
    hues = [wrap(base - offset), base, wrap(base + offset)];
  } else if (variant < 0.8) {
    // Split complementary — pleasing contrast without clashing
    const off = 30 + rnd() * 15; // 30–45° from complement
    hues = [base, wrap(base + 180 - off), wrap(base + 180 + off)];
  } else {
    // Golden-angle duo for interesting two-stop gradients
    const golden = 137.5;
    hues = [base, wrap(base + golden)];
  }

  let baseStops = hues.map((h, i) => hslToRgb(h, s, i === 0 ? l1 : i === 1 ? l3 : l2));
  if (baseStops.length < 2) baseStops.push(hslToRgb(wrap(base + 180), s, l3));
  // Always two-color gradient: pick two most distinct stops
  let stops = [baseStops[0], baseStops[baseStops.length - 1]] as [number, number, number][];

  // Randomly flip direction (top↔bottom) to vary perceived direction
  if (rnd() < 0.5) stops.reverse();

  return stops;
}

function borderFromStops(stops: [number, number, number][]) {
  // Use a brightened complement of the first stop for a subtle accent
  const [r, g, b] = stops[0];
  const { h, s, l } = rgbToHsl(r, g, b);
  const br = hslToRgb(wrap(h + 180), Math.min(90, s + 10), Math.min(55, l + 20));
  return br;
}

function hashString(str: string) {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function interpolateRgb(a: [number, number, number], b: [number, number, number], t = 0.5): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function wrap(x: number) { return (x % 360 + 360) % 360; }

function randomAngle(seed: string): number {
  const rnd = mulberry32(hashString(seed + ':angle'));
  // Avoid near-vertical-only; choose any angle 0–360 but bias away from 0/180 by adding +/-15°
  const a = Math.floor(rnd() * 360);
  return (a + 15) % 360;
}

function pathForCacheBase() {
  return path.resolve(process.cwd(), 'node_modules', '.astro-og-canvas', `v${OG_VERSION}`);
}

async function ensureGradientImage(baseDir: string, seed: string, width: number, height: number, stops: [number, number, number][], angleDeg: number): Promise<string> {
  const key = `g-${hashString(JSON.stringify({ seed, width, height, stops, angleDeg }))}.png`;
  const bgDir = path.join(baseDir, 'bg');
  const filePath = path.join(bgDir, key);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {}
  await fs.mkdir(bgDir, { recursive: true });
  const buffer = await renderLinearGradientPng(width, height, stops, angleDeg);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function renderLinearGradientPng(width: number, height: number, stops: [number, number, number][], angleDeg: number): Promise<Buffer> {
  const channels = 3; // RGB
  const data = Buffer.alloc(width * height * channels);
  const angle = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const halfW = width / 2;
  const halfH = height / 2;
  const denom = Math.abs(ux) * halfW + Math.abs(uy) * halfH || 1;

  // Helper to sample the gradient with 2 or 3 stops
  const sample = (t: number): [number, number, number] => {
    t = Math.max(0, Math.min(1, t));
    if (stops.length === 2) {
      return interpolateRgb(stops[0], stops[1], t);
    } else {
      if (t <= 0.5) return interpolateRgb(stops[0], stops[1], t * 2);
      return interpolateRgb(stops[1], stops[2], (t - 0.5) * 2);
    }
  };

  for (let y = 0; y < height; y++) {
    const Py = y - halfH;
    for (let x = 0; x < width; x++) {
      const Px = x - halfW;
      const proj = (Px * ux + Py * uy) / denom; // -1..1
      const t = (proj + 1) / 2; // 0..1
      const [r, g, b] = sample(t);
      const idx = (y * width + x) * channels;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }
  const img = sharp(data, { raw: { width, height, channels } }).png();
  return await img.toBuffer();
}
