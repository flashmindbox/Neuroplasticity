import { describe, expect, it } from 'vitest';
import { evaluateRules, type RuleInputs } from '../../src/lib/rules';
import type { DailyLog } from '../../src/lib/db';
import { addDays, rangeKeys } from '../../src/lib/dates';

const today = '2026-12-15';
const base = (over: Partial<RuleInputs> = {}): RuleInputs => ({
  today,
  programmeStart: '2026-10-26',
  logs: new Map(),
  completionOf: () => 1,
  doubleMissNow: false,
  screenings: [],
  brainChecks: [],
  ratings: [],
  targets: [],
  lastBackupAt: '2026-12-10T10:00:00Z',
  deload: false,
  taper: false,
  ...over,
});
const ids = (i: RuleInputs) => evaluateRules(i).map((a) => a.id);

describe('decision rules', () => {
  it('is quiet when everything is fine', () => {
    expect(ids(base())).toEqual([]);
  });

  it('shows crisis contacts for PHQ-9 item 9 > 0', () => {
    const alerts = evaluateRules(
      base({
        screenings: [
          { date: '2026-12-10', kind: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 1], total: 1 },
        ],
      }),
    );
    expect(alerts[0]).toMatchObject({ id: 'crisis', level: 'crisis' });
    expect(alerts[0].action).toMatch(/14416/);
  });

  it('ignores screenings older than 35 days', () => {
    expect(
      ids(
        base({
          screenings: [
            { date: '2026-10-01', kind: 'gad7', answers: [2, 2, 2, 2, 2, 2, 2], total: 14 },
          ],
        }),
      ),
    ).not.toContain('screen-professional');
  });

  it('fires the stress rule after 7 consecutive days at 7+', () => {
    const logs = new Map<string, DailyLog>();
    for (const d of rangeKeys(addDays(today, -6), today))
      logs.set(d, { date: d, checks: {}, mvd: false, stress: 8 });
    expect(ids(base({ logs }))).toContain('stress');
    logs.set(today, { date: today, checks: {}, mvd: false, stress: 5 });
    expect(ids(base({ logs }))).not.toContain('stress');
  });

  it('pairs low clarity with an elevated screen', () => {
    const logs = new Map<string, DailyLog>();
    for (const d of rangeKeys(addDays(today, -6), today))
      logs.set(d, { date: d, checks: {}, mvd: false, clarityAM: 3, clarityPM: 4 });
    const screenings = [
      { date: '2026-12-12', kind: 'gad7' as const, answers: [2, 2, 1, 1, 2, 1, 1], total: 10 },
    ];
    expect(ids(base({ logs, screenings }))).toEqual(
      expect.arrayContaining(['clarity-mood', 'screen-professional']),
    );
    expect(ids(base({ logs }))).not.toContain('clarity-mood');
  });

  it('suggests shrinking challenges when completion is under 70%', () => {
    expect(ids(base({ completionOf: () => 0.5 }))).toContain('habit-low');
  });

  it('flags a stalled target after 4 weeks without improvement', () => {
    const ratings = [
      { date: '2026-11-10', source: 'self' as const, ratings: { focus: 4 } },
      { date: '2026-12-12', source: 'self' as const, ratings: { focus: 4 } },
    ];
    expect(ids(base({ ratings, targets: ['focus'] }))).toContain('stalled-focus');
    const improved = [ratings[0], { ...ratings[1], ratings: { focus: 5 } }];
    expect(ids(base({ ratings: improved, targets: ['focus'] }))).not.toContain('stalled-focus');
  });

  it('reminds about backups after 30 days', () => {
    expect(ids(base({ lastBackupAt: null }))).toContain('backup');
    expect(ids(base({ lastBackupAt: '2026-11-01T00:00:00Z' }))).toContain('backup');
  });
});

describe('robustness', () => {
  it('skips malformed screening rows instead of throwing', () => {
    const screenings = [{ date: '2026-12-10', kind: 'phq9' as const, answers: [1, 2], total: 3 }];
    expect(() => evaluateRules(base({ screenings }))).not.toThrow();
  });
});
