// Brain Check scoring (handbook/modules/L0-brain-clarity.md).
import type { BrainCheckEntry } from './db';
import { daysBetween } from './dates';
import { mean } from './stats';

export const PRACTICE_SESSIONS = 4;
export const BASELINE_SESSIONS = 3;
/** A session this far below baseline (composite) counts as a decline. */
export const DECLINE_THRESHOLD = -0.1;

export interface Baseline {
  rtMedianMs: number;
  symbolCorrect: number;
  span: number;
}

const byDate = (a: BrainCheckEntry, b: BrainCheckEntry) =>
  a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1;

export function sortedSessions(entries: BrainCheckEntry[]) {
  return [...entries].sort(byDate);
}

export function baselineOf(entries: BrainCheckEntry[]): Baseline | null {
  const s = sortedSessions(entries).slice(PRACTICE_SESSIONS, PRACTICE_SESSIONS + BASELINE_SESSIONS);
  if (s.length < BASELINE_SESSIONS) return null;
  return {
    rtMedianMs: mean(s.map((e) => e.rtMedianMs))!,
    symbolCorrect: mean(s.map((e) => e.symbolCorrect))!,
    span: mean(s.map((e) => e.spanForward + e.spanBackward))!,
  };
}

/** Average relative change vs baseline; positive is better. */
export function compositeChange(e: BrainCheckEntry, base: Baseline): number {
  const rt = (base.rtMedianMs - e.rtMedianMs) / base.rtMedianMs;
  const sym = base.symbolCorrect ? (e.symbolCorrect - base.symbolCorrect) / base.symbolCorrect : 0;
  const span = base.span ? (e.spanForward + e.spanBackward - base.span) / base.span : 0;
  return (rt + sym + span) / 3;
}

export type BrainCheckStatus =
  | { kind: 'practice'; remaining: number }
  | { kind: 'baseline'; remaining: number }
  | { kind: 'tracking'; latestChange: number; decline: boolean };

export function brainCheckStatus(entries: BrainCheckEntry[]): BrainCheckStatus {
  const s = sortedSessions(entries);
  if (s.length < PRACTICE_SESSIONS)
    return { kind: 'practice', remaining: PRACTICE_SESSIONS - s.length };
  const base = baselineOf(s);
  if (!base) {
    return { kind: 'baseline', remaining: PRACTICE_SESSIONS + BASELINE_SESSIONS - s.length };
  }
  const tracked = s.slice(PRACTICE_SESSIONS + BASELINE_SESSIONS);
  const latest = s[s.length - 1];
  const latestChange = compositeChange(latest, base);
  const lastTwo = tracked.slice(-2);
  const decline =
    lastTwo.length === 2 &&
    lastTwo.every((e) => compositeChange(e, base) <= DECLINE_THRESHOLD) &&
    // "2+ weeks": the two low sessions must span at least a week.
    daysBetween(lastTwo[0].date, lastTwo[1].date) >= 7;
  return { kind: 'tracking', latestChange, decline };
}

// --- Task helpers -------------------------------------------------------------

export const SYMBOLS = ['◆', '●', '▲', '■', '★', '✚', '⬟', '◐', '☾'];

/** Digit-span sequence without immediate repeats. */
export function digitSequence(length: number, rand: () => number = Math.random): number[] {
  const out: number[] = [];
  while (out.length < length) {
    const d = Math.floor(rand() * 10);
    if (d !== out[out.length - 1]) out.push(d);
  }
  return out;
}

export function checkSpan(sequence: number[], answer: string, backward: boolean): boolean {
  const expected = (backward ? [...sequence].reverse() : sequence).join('');
  return answer.replace(/\D/g, '') === expected;
}
