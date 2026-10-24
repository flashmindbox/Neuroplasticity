import { describe, expect, it } from 'vitest';
import { scoreScreening } from '../../src/lib/screening';

describe('PHQ-9 / GAD-7 rules', () => {
  it('scores totals and severity bands', () => {
    expect(scoreScreening('phq9', [0, 0, 1, 1, 0, 0, 1, 0, 0])).toMatchObject({
      total: 3,
      severity: 'Minimal',
      action: 'ok',
    });
    expect(scoreScreening('gad7', [2, 2, 2, 1, 1, 1, 1])).toMatchObject({
      total: 10,
      severity: 'Moderate',
      action: 'professional',
    });
    expect(scoreScreening('phq9', [2, 2, 2, 2, 2, 2, 2, 2, 0]).action).toBe('urgent');
  });

  it('always escalates PHQ-9 item 9 to crisis, whatever the total', () => {
    expect(scoreScreening('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1])).toMatchObject({
      total: 1,
      action: 'crisis',
    });
  });

  it('rejects malformed answers', () => {
    expect(() => scoreScreening('gad7', [0, 1])).toThrow();
    expect(() => scoreScreening('gad7', [0, 1, 2, 3, 4, 0, 0])).toThrow();
  });
});
