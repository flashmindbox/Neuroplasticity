// Delivery metrics computed locally from a talk transcript.

// Conservative list: words that are almost always fillers in spoken Indian English.
export const FILLERS = [
  'um',
  'umm',
  'uh',
  'uhh',
  'er',
  'erm',
  'ah',
  'hmm',
  'you know',
  'i mean',
  'basically',
  'actually',
  'kind of',
  'sort of',
  'matlab',
];

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function countFillers(text: string): number {
  const t = ` ${text
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .replace(/\s+/g, ' ')} `;
  // Lookarounds so adjacent repeats ("um um") are each counted.
  return FILLERS.reduce(
    (n, f) => n + (t.match(new RegExp(`(?<= )${f}(?= )`, 'g'))?.length ?? 0),
    0,
  );
}

export function wordsPerMinute(text: string, durationSec: number): number | null {
  if (durationSec < 10) return null;
  return Math.round(countWords(text) / (durationSec / 60));
}
