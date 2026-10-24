import { describe, expect, it } from 'vitest';
import { analyseExperiment, fogAuditExperiment, metricValue } from '../../src/lib/experiments';
import { fogAudit } from '../../src/lib/metrics';
import type { DailyLog } from '../../src/lib/db';
import { addDays, rangeKeys } from '../../src/lib/dates';

describe('experiments', () => {
  const exp = {
    metric: 'clarity',
    baselineStart: '2026-11-01',
    interventionStart: '2026-11-08',
    end: '2026-11-14',
  };

  it('compares baseline and intervention means', () => {
    const values: Record<string, number> = {};
    rangeKeys('2026-11-01', '2026-11-07').forEach((d, i) => (values[d] = 5 + (i % 2) * 0.5));
    rangeKeys('2026-11-08', '2026-11-14').forEach((d, i) => (values[d] = 7 + (i % 2) * 0.5));
    const r = analyseExperiment(exp, (d) => values[d] ?? null);
    expect(r.baselineN).toBe(7);
    expect(r.interventionN).toBe(7);
    expect(r.difference).toBeCloseTo(2);
    expect(r.verdict).toMatch(/^Better/);
  });

  it('asks for more data with fewer than 5 days per period', () => {
    const r = analyseExperiment(exp, (d) => (d < '2026-11-04' ? 5 : null));
    expect(r.verdict).toMatch(/Not enough data/);
  });

  it('reads metrics from logs and sessions', () => {
    const log: DailyLog = {
      date: 'd',
      checks: {},
      mvd: false,
      clarityAM: 6,
      clarityPM: 8,
      sleepHours: 7,
    };
    expect(metricValue('clarity', log, [])).toBe(7);
    expect(metricValue('sleepHours', log, [])).toBe(7);
    expect(
      metricValue('wandersPerBlock', undefined, [
        { date: 'd', kind: 'focus', plannedMin: 25, actualMin: 25, wanders: 2 },
        { date: 'd', kind: 'focus', plannedMin: 25, actualMin: 20, wanders: 4 },
      ]),
    ).toBe(3);
  });

  it('pre-configures a 14-day fog audit', () => {
    const f = fogAuditExperiment('2026-10-26');
    expect(f.interventionStart).toBe(addDays('2026-10-26', 14));
    expect(f.metric).toBe('clarity');
  });
});

describe('fog audit', () => {
  it('correlates clarity with logged factors once 7+ days exist', () => {
    const logs: DailyLog[] = rangeKeys('2026-11-01', '2026-11-10').map((d, i) => ({
      date: d,
      checks: {},
      mvd: false,
      sleepHours: 5 + i * 0.3,
      clarityAM: 4 + i * 0.5,
      stress: 5,
    }));
    const f = Object.fromEntries(fogAudit(logs).map((x) => [x.id, x]));
    expect(f.sleepHours.r).toBeCloseTo(1);
    expect(f.stress.r).toBeNull(); // no variance
    expect(f.exerciseMin.n).toBe(0);
  });
});
