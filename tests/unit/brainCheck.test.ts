import { describe, expect, it } from 'vitest';
import {
  baselineOf,
  brainCheckStatus,
  checkSpan,
  compositeChange,
  digitSequence,
} from '../../src/lib/brainCheck';
import type { BrainCheckEntry } from '../../src/lib/db';

const session = (date: string, rt: number, sym: number, fwd = 7, bwd = 5): BrainCheckEntry => ({
  date,
  rtMedianMs: rt,
  symbolCorrect: sym,
  symbolErrors: 0,
  spanForward: fwd,
  spanBackward: bwd,
});

describe('Brain Check', () => {
  const dates = [
    '2026-11-01',
    '2026-11-08',
    '2026-11-15',
    '2026-11-22',
    '2026-11-29',
    '2026-12-06',
    '2026-12-13',
  ];
  const practiceAndBaseline = dates.map((d) => session(d, 300, 40));

  it('treats the first four sessions as practice', () => {
    expect(brainCheckStatus(practiceAndBaseline.slice(0, 2))).toEqual({
      kind: 'practice',
      remaining: 2,
    });
    expect(brainCheckStatus(practiceAndBaseline.slice(0, 5))).toEqual({
      kind: 'baseline',
      remaining: 2,
    });
  });

  it('builds the baseline from sessions 5–7', () => {
    const s = [
      ...practiceAndBaseline.slice(0, 4).map((e) => ({ ...e, rtMedianMs: 500 })),
      ...practiceAndBaseline.slice(4),
    ];
    expect(baselineOf(s)).toEqual({ rtMedianMs: 300, symbolCorrect: 40, span: 12 });
  });

  it('scores faster and more accurate sessions as positive change', () => {
    const base = { rtMedianMs: 300, symbolCorrect: 40, span: 12 };
    expect(compositeChange(session('x', 270, 44, 7, 5), base)).toBeCloseTo((0.1 + 0.1 + 0) / 3);
  });

  it('flags a decline only after two low sessions a week apart', () => {
    const low1 = session('2026-12-20', 360, 32, 6, 4);
    const low2 = session('2026-12-27', 360, 32, 6, 4);
    const one = brainCheckStatus([...practiceAndBaseline, low1]);
    expect(one).toMatchObject({ kind: 'tracking', decline: false });
    const two = brainCheckStatus([...practiceAndBaseline, low1, low2]);
    expect(two).toMatchObject({ kind: 'tracking', decline: true });
    const sameWeek = brainCheckStatus([
      ...practiceAndBaseline,
      low1,
      { ...low2, date: '2026-12-21' },
    ]);
    expect(sameWeek).toMatchObject({ decline: false });
  });

  it('generates and checks digit spans', () => {
    // Repeats in the random stream must be skipped, not emitted.
    const stream = [0.42, 0.42, 0.11, 0.11, 0.93, 0.5, 0.5, 0.05, 0.7];
    let i = 0;
    const seq = digitSequence(6, () => stream[i++ % stream.length]);
    expect(seq).toEqual([4, 1, 9, 5, 0, 7]);
    expect(seq).toHaveLength(6);
    expect(checkSpan([1, 2, 3], '1 2 3', false)).toBe(true);
    expect(checkSpan([1, 2, 3], '321', true)).toBe(true);
    expect(checkSpan([1, 2, 3], '123', true)).toBe(false);
  });
});
