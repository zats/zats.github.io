import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION, OG_VERSION } from '../../consts';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { interpolate, converter } from 'culori';
import { OGImageRoute } from 'astro-og-canvas';
const GRADIENT_VERSION = 4; // bump to regenerate bg PNGs when algo changes

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
    const cacheBase = pathForCacheBase();
    const bgPath = await ensureMeshGradientImage(cacheBase, seed, 1200, 630, stops);
    const borderColor = borderFromStops(stops);
    return {
      cacheDir: path.join(cacheBase, 'og-canvas'),
      title: data.title,
      description: data.description,
      width: 1200,
      height: 630,
      padding: 72,
      // Base gradient (covered by mesh bgImage, but kept for safety)
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

// Deterministic, aesthetically tuned two-stop palette in OKLCH → sRGB
function gradientFromSlug(slug: string) {
  const rnd = mulberry32(hashString(slug + ':stops'));
  const toRGB = converter('rgb');
  const baseHue = Math.floor(rnd() * 360);
  const scheme = rnd();
  let h1 = baseHue;
  let h2: number;
  if (scheme < 0.7) {
    const offset = 18 + rnd() * 10; // 18–28° analogous
    h2 = wrap(baseHue + (rnd() < 0.5 ? -offset : offset));
  } else {
    const off = 28 + rnd() * 8; // 28–36° off complement
    h2 = wrap(baseHue + 180 + (rnd() < 0.5 ? -off : off));
  }
  const Lbase = 0.60 + (rnd() - 0.5) * 0.06; // 0.57–0.63
  const dL = 0.06;
  const C = 0.14 + rnd() * 0.06; // 0.14–0.20
  const ok1 = { mode: 'oklch', l: Math.max(0, Math.min(1, Lbase - dL / 2)), c: C, h: h1 } as any;
  const ok2 = { mode: 'oklch', l: Math.max(0, Math.min(1, Lbase + dL / 2)), c: C, h: h2 } as any;
  const s1 = toRGB(ok1) as { r?: number; g?: number; b?: number };
  const s2 = toRGB(ok2) as { r?: number; g?: number; b?: number };
  const clamp255 = (v?: number) => Math.max(0, Math.min(255, Math.round((v ?? 0) * 255)));
  return [
    [clamp255(s1.r), clamp255(s1.g), clamp255(s1.b)],
    [clamp255(s2.r), clamp255(s2.g), clamp255(s2.b)],
  ];
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

function pathForCacheBase() {
  return path.resolve(process.cwd(), 'node_modules', '.astro-og-canvas', `v${OG_VERSION}`);
}

async function ensureMeshGradientImage(baseDir: string, seed: string, width: number, height: number, stops: [number, number, number][]): Promise<string> {
  const key = `mesh-${hashString(JSON.stringify({ v: GRADIENT_VERSION, seed, width, height, stops }))}.png`;
  const bgDir = path.join(baseDir, 'bg');
  const filePath = path.join(bgDir, key);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {}
  await fs.mkdir(bgDir, { recursive: true });
  const buffer = await renderMeshGradientPng(width, height, seed, stops);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function renderMeshGradientPng(width: number, height: number, seed: string, stops: [number, number, number][]): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  const rnd = mulberry32(hashString(seed + ':mesh'));

  // Utilities
  const toHex = (rgb: [number, number, number]) => '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  const toRGB = converter('rgb');
  const mixOKLCH = interpolate([toHex(stops[0]), toHex(stops[1])], 'oklch');
  const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const p = (min: number, max: number) => min + (max - min) * rnd();

  // Halton low-discrepancy sequence for well-spaced positions
  const halton = (index: number, base: number) => {
    let f = 1, r = 0; let i = index + 1;
    while (i > 0) { f = f / base; r = r + f * (i % base); i = Math.floor(i / base); }
    return r;
  };

  // Build N control points: positions + color + individual sigma
  const N = 18; // more control points for richer meshes (trade-off perf)
  const marginX = 0.08, marginY = 0.08;
  type Point = { x: number; y: number; rgb: [number, number, number]; sigma2: number };
  const points: Point[] = [];
  const clusters = [0.25, 0.5, 0.75];
  for (let i = 0; i < N; i++) {
    const baseX = halton(i, 2), baseY = halton(i, 3);
    const jx = (rnd() - 0.5) * 0.06, jy = (rnd() - 0.5) * 0.06; // smaller jitter
    const x = clamp(marginX + (1 - 2 * marginX) * clamp(baseX + jx));
    const y = clamp(marginY + (1 - 2 * marginY) * clamp(baseY + jy));

    // Choose t along gradient from soft clusters to keep harmony
    const center = clusters[i % clusters.length];
    let t = clamp(center + (rnd() - 0.5) * 0.18);
    const c = toRGB(mixOKLCH(t)) as { r?: number; g?: number; b?: number };
    let rgb: [number, number, number] = [
      Math.round(clamp(c.r ?? 0) * 255),
      Math.round(clamp(c.g ?? 0) * 255),
      Math.round(clamp(c.b ?? 0) * 255),
    ];

    // Gentle light/dark tweak only (keep palette cohesive)
    const factor = 0.94 + rnd() * 0.12; // 0.94..1.06
    rgb = [
      Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
      Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
      Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
    ];

    // Each point gets its own spread
    const baseSigma = Math.min(width, height) * (0.18 + 0.2 * rnd());
    const sigma2 = baseSigma * baseSigma;
    points.push({ x: x * width, y: y * height, rgb, sigma2 });
  }

  // Subtle vignette and grain
  const centerX = width / 2, centerY = height / 2;
  const maxR = Math.hypot(centerX, centerY);
  const noise = mulberry32(hashString(seed + ':noise'));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let wr = 0, wg = 0, wb = 0, wsum = 0;
      for (const pt of points) {
        const dx = x - pt.x, dy = y - pt.y;
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * pt.sigma2));
        wr += w * pt.rgb[0];
        wg += w * pt.rgb[1];
        wb += w * pt.rgb[2];
        wsum += w;
      }
      let r = wr / (wsum || 1);
      let g = wg / (wsum || 1);
      let b = wb / (wsum || 1);

      // Vignette
      const rr = Math.hypot(x - centerX, y - centerY) / maxR;
      const vignette = 1 - 0.10 * rr * rr;
      r *= vignette; g *= vignette; b *= vignette;

      // Fine grain
      const gn = (noise() - 0.5) * 4; // +/-2 levels in 0..255
      r = Math.max(0, Math.min(255, r + gn));
      g = Math.max(0, Math.min(255, g + gn));
      b = Math.max(0, Math.min(255, b + gn));

      const idx = (y * width + x) * channels;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }

  return await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}
