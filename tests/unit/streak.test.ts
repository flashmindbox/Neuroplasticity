import { describe, expect, it } from 'vitest';
import { dayStatus, neverMissTwiceChain, type DayStatus } from '../../src/lib/streak';
import type { DailyLog } from '../../src/lib/db';

const planned = ['a', 'b', 'c', 'd'];
const log = (checks: string[], mvd = false): DailyLog => ({
  date: 'x',
  checks: Object.fromEntries(checks.map((c) => [c, true])),
  mvd,
});

describe('dayStatus', () => {
  it('needs half the planned items', () => {
    expect(dayStatus(log(['a', 'b']), planned)).toBe('done');
    expect(dayStatus(log(['a']), planned)).toBe('missed');
    expect(dayStatus(undefined, planned)).toBe('missed');
  });
  it('accepts a completed minimum viable day', () => {
    expect(dayStatus(log(['mvd-breath', 'mvd-journal', 'mvd-target'], true), planned)).toBe('mvd');
    expect(dayStatus(log(['mvd-breath'], true), planned)).toBe('missed');
  });
});

function chain(statuses: Record<string, DayStatus>, today: string, start: string) {
  return neverMissTwiceChain(today, start, (d) => statuses[d] ?? 'missed');
}

describe('never miss twice', () => {
  it('lets a single miss stay in the chain', () => {
    const s = {
      '2026-11-01': 'done',
      '2026-11-02': 'missed',
      '2026-11-03': 'done',
      '2026-11-04': 'done',
    } as const;
    expect(chain(s, '2026-11-04', '2026-11-01')).toEqual({
      length: 4,
      singleMisses: 1,
      doubleMissNow: false,
    });
  });

  it('breaks the chain at two consecutive misses', () => {
    const s = {
      '2026-11-01': 'done',
      '2026-11-02': 'missed',
      '2026-11-03': 'missed',
      '2026-11-04': 'done',
      '2026-11-05': 'mvd',
    } as const;
    expect(chain(s, '2026-11-05', '2026-11-01')).toEqual({
      length: 2,
      singleMisses: 0,
      doubleMissNow: false,
    });
  });

  it('does not count an unfinished today as a miss', () => {
    const s = { '2026-11-01': 'done', '2026-11-02': 'done' } as const;
    expect(chain(s, '2026-11-03', '2026-11-01').length).toBe(2);
  });

  it('flags a double miss right now', () => {
    const s = { '2026-11-01': 'done' } as const;
    expect(chain(s, '2026-11-04', '2026-11-01')).toMatchObject({ length: 0, doubleMissNow: true });
  });
});
