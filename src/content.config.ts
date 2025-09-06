import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

// Treat date-only frontmatter (e.g. "2025-09-10") as midnight in NYC time
// so rendered dates match the author’s intended calendar day regardless of
// the machine/time zone used during build.
const PUBLISH_TZ = 'America/New_York';

function getTimeZoneOffset(timeZone: string, date: Date): number {
  // Returns offset in milliseconds where: asUTC - epochMs = offset
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  const hh = Number(parts.find((p) => p.type === 'hour')?.value);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value);
  const ss = Number(parts.find((p) => p.type === 'second')?.value);
  const asUTC = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
  return asUTC - date.getTime();
}

function parseNYCMidnight(input: unknown): Date {
  if (input instanceof Date) {
    // If this looks like a date-only value (UTC midnight), reinterpret as NYC midnight
    if (
      input.getUTCHours() === 0 &&
      input.getUTCMinutes() === 0 &&
      input.getUTCSeconds() === 0 &&
      input.getUTCMilliseconds() === 0
    ) {
      const y = input.getUTCFullYear();
      const mo = input.getUTCMonth() + 1;
      const da = input.getUTCDate();
      const middayUTC = Date.UTC(y, mo - 1, da, 12, 0, 0);
      const offsetMs = getTimeZoneOffset(PUBLISH_TZ, new Date(middayUTC));
      const utcEpoch = Date.UTC(y, mo - 1, da, 0, 0, 0) - offsetMs;
      return new Date(utcEpoch);
    }
    return input;
  }
  if (typeof input === 'number') return new Date(input);
  const s = String(input ?? '').trim();
  if (!s) return new Date(NaN);

  // If string contains a time or timezone, let native parser handle it
  if (/[Tt]/.test(s) || /Z$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return d;
  }

  // Expect date-only strings like YYYY-MM-DD (preferred)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let y: number, mo: number, da: number;
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    da = Number(m[3]);
  } else {
    // Fallback: try to parse other date-like strings and extract NYC calendar parts
    const tmp = new Date(s);
    if (isNaN(tmp.getTime())) return tmp; // will stay invalid, surfaced by schema
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PUBLISH_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(tmp);
    y = Number(parts.find((p) => p.type === 'year')?.value);
    mo = Number(parts.find((p) => p.type === 'month')?.value);
    da = Number(parts.find((p) => p.type === 'day')?.value);
  }

  // Use midday offset to avoid DST transition ambiguity
  const middayUTC = Date.UTC(y, mo - 1, da, 12, 0, 0);
  const offsetMs = getTimeZoneOffset(PUBLISH_TZ, new Date(middayUTC));
  const utcEpoch = Date.UTC(y, mo - 1, da, 0, 0, 0) - offsetMs; // NYC midnight → UTC
  return new Date(utcEpoch);
}

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
    schema: ({ image }) => z.object({
      title: z.string(),
      description: z.string(),
      // Interpret date-only strings as midnight in NYC time
      pubDate: z.preprocess((v) => parseNYCMidnight(v), z.date()),
      updatedDate: z.preprocess((v) => (v == null ? v : parseNYCMidnight(v)), z.date().optional()),
      heroImage: z.string().optional(),
      draft: z.boolean().default(false),
    }),
  });

export const collections = { blog };
