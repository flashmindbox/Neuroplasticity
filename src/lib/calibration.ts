// Prelims calibration maths (handbook/modules/L3-judgement-calibration.md).
// UPSC GS Paper I: +2 for a correct answer, −1/3 of 2 (≈0.66) for a wrong one.

export type BucketId = 'sure' | 'likely' | 'fifty' | 'guess';

export const BUCKETS: { id: BucketId; label: string; confidence: number }[] = [
  { id: 'sure', label: 'Sure', confidence: 0.95 },
  { id: 'likely', label: 'Likely', confidence: 0.75 },
  { id: 'fifty', label: '50-50', confidence: 0.5 },
  { id: 'guess', label: 'Guess', confidence: 0.3 },
];

export const MARKS_CORRECT = 2;
export const MARKS_WRONG = 2 / 3;
/** Attempting is worth it on average when accuracy exceeds this. */
export const BREAK_EVEN_ACCURACY = MARKS_WRONG / (MARKS_CORRECT + MARKS_WRONG); // 0.25

export interface BucketCounts {
  attempted: number;
  correct: number;
}

export type MockBuckets = Record<BucketId, BucketCounts>;

export function emptyBuckets(): MockBuckets {
  return {
    sure: { attempted: 0, correct: 0 },
    likely: { attempted: 0, correct: 0 },
    fifty: { attempted: 0, correct: 0 },
    guess: { attempted: 0, correct: 0 },
  };
}

export function validateBuckets(b: MockBuckets): string | null {
  for (const { id, label } of BUCKETS) {
    const { attempted, correct } = b[id];
    if (![attempted, correct].every((n) => Number.isInteger(n) && n >= 0)) {
      return `${label}: counts must be whole numbers ≥ 0`;
    }
    if (correct > attempted) return `${label}: correct cannot exceed attempted`;
  }
  return null;
}

/** Expected marks per attempt at accuracy p. */
export function evPerAttempt(p: number): number {
  return MARKS_CORRECT * p - MARKS_WRONG * (1 - p);
}

export function marksFor(b: BucketCounts): number {
  return b.correct * MARKS_CORRECT - (b.attempted - b.correct) * MARKS_WRONG;
}

export function sumBuckets(mocks: MockBuckets[]): MockBuckets {
  const total = emptyBuckets();
  for (const m of mocks) {
    for (const { id } of BUCKETS) {
      total[id].attempted += m[id].attempted;
      total[id].correct += m[id].correct;
    }
  }
  return total;
}

export interface BucketReport {
  id: BucketId;
  label: string;
  confidence: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
  /** Stated confidence minus actual accuracy (positive = overconfident). */
  gap: number | null;
  ev: number | null;
  marks: number;
  advice: 'attempt' | 'caution' | 'skip' | 'more-data';
}

/** Below this many attempts a bucket's accuracy is too noisy to act on. */
export const MIN_SAMPLE = 20;

export function bucketReports(b: MockBuckets): BucketReport[] {
  return BUCKETS.map(({ id, label, confidence }) => {
    const { attempted, correct } = b[id];
    const accuracy = attempted > 0 ? correct / attempted : null;
    const ev = accuracy === null ? null : evPerAttempt(accuracy);
    let advice: BucketReport['advice'] = 'more-data';
    if (ev !== null && attempted >= MIN_SAMPLE) {
      advice = ev > 0.15 ? 'attempt' : ev >= 0 ? 'caution' : 'skip';
    }
    return {
      id,
      label,
      confidence,
      attempted,
      correct,
      accuracy,
      gap: accuracy === null ? null : confidence - accuracy,
      ev,
      marks: marksFor(b[id]),
      advice,
    };
  });
}

/**
 * Brier score using each bucket's nominal confidence as the forecast.
 * 0 is perfect; 0.25 is what always saying 50% scores.
 */
export function brierScore(b: MockBuckets): number | null {
  let sum = 0;
  let n = 0;
  for (const { id, confidence } of BUCKETS) {
    const { attempted, correct } = b[id];
    sum += correct * (confidence - 1) ** 2 + (attempted - correct) * confidence ** 2;
    n += attempted;
  }
  return n > 0 ? sum / n : null;
}

export function totalMarks(b: MockBuckets): number {
  return BUCKETS.reduce((s, { id }) => s + marksFor(b[id]), 0);
}
