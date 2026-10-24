import { describe, expect, it } from 'vitest';
import {
  BREAK_EVEN_ACCURACY,
  brierScore,
  bucketReports,
  emptyBuckets,
  evPerAttempt,
  sumBuckets,
  totalMarks,
  validateBuckets,
} from '../../src/lib/calibration';

describe('UPSC expected value', () => {
  it('breaks even at 25% accuracy', () => {
    expect(BREAK_EVEN_ACCURACY).toBeCloseTo(0.25);
    expect(evPerAttempt(0.25)).toBeCloseTo(0);
  });
  it('matches the handbook figures', () => {
    expect(evPerAttempt(1 / 3)).toBeCloseTo(0.222, 2);
    expect(evPerAttempt(0.5)).toBeCloseTo(0.667, 2);
  });
});

describe('bucket reports', () => {
  const b = emptyBuckets();
  b.sure = { attempted: 40, correct: 38 };
  b.likely = { attempted: 30, correct: 21 };
  b.fifty = { attempted: 20, correct: 11 };
  b.guess = { attempted: 10, correct: 2 };

  it('computes accuracy, gap and advice', () => {
    const r = Object.fromEntries(bucketReports(b).map((x) => [x.id, x]));
    expect(r.sure.accuracy).toBeCloseTo(0.95);
    expect(r.sure.gap).toBeCloseTo(0);
    expect(r.likely.gap).toBeCloseTo(0.05);
    expect(r.fifty.advice).toBe('attempt');
    expect(r.guess.advice).toBe('more-data'); // only 10 attempts
  });

  it('advises skipping a well-sampled bucket below break-even', () => {
    const g = emptyBuckets();
    g.guess = { attempted: 40, correct: 8 };
    expect(bucketReports(g).find((x) => x.id === 'guess')!.advice).toBe('skip');
  });

  it('totals marks with negative marking', () => {
    // 72 correct, 28 wrong → 144 − 18.67
    expect(totalMarks(b)).toBeCloseTo(144 - 28 * (2 / 3));
  });

  it('computes a Brier score and sums mocks', () => {
    const perfect = emptyBuckets();
    perfect.sure = { attempted: 10, correct: 10 };
    expect(brierScore(perfect)).toBeCloseTo(0.0025);
    expect(brierScore(emptyBuckets())).toBeNull();
    expect(sumBuckets([b, b]).sure).toEqual({ attempted: 80, correct: 76 });
  });

  it('validates counts', () => {
    const bad = emptyBuckets();
    bad.likely = { attempted: 3, correct: 5 };
    expect(validateBuckets(bad)).toMatch(/cannot exceed/);
    expect(validateBuckets(b)).toBeNull();
  });
});
