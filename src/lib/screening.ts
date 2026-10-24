// Deterministic interpretation of PHQ-9 / GAD-7. Never AI-dependent.
import { SCREENINGS, type ScreeningKind } from '../content/screening';

export type ScreeningAction = 'ok' | 'professional' | 'urgent' | 'crisis';

export interface ScreeningResult {
  kind: ScreeningKind;
  total: number;
  severity: string;
  action: ScreeningAction;
}

export function scoreScreening(kind: ScreeningKind, answers: number[]): ScreeningResult {
  const expected = SCREENINGS[kind].items.length;
  if (answers.length !== expected || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    throw new Error(`${kind} needs ${expected} answers between 0 and 3`);
  }
  const total = answers.reduce((s, a) => s + a, 0);
  const severity = severityLabel(kind, total);
  let action: ScreeningAction = 'ok';
  if (total >= 15) action = 'urgent';
  else if (total >= 10) action = 'professional';
  // PHQ-9 item 9 above zero always shows crisis contacts, whatever the total.
  if (kind === 'phq9' && answers[8] > 0) action = 'crisis';
  return { kind, total, severity, action };
}

function severityLabel(kind: ScreeningKind, total: number): string {
  if (total <= 4) return 'Minimal';
  if (total <= 9) return 'Mild';
  if (total <= 14) return 'Moderate';
  if (kind === 'phq9') return total <= 19 ? 'Moderately severe' : 'Severe';
  return 'Severe';
}

export const ACTION_MESSAGES: Record<ScreeningAction, string> = {
  ok: 'Recorded. Keep watching the trend month to month.',
  professional:
    'Your score is in a range where talking to a counsellor or doctor is recommended. Please book within the next 2 weeks and tell your accountability partner.',
  urgent:
    'Your score is high. Please talk to a counsellor or doctor in the next few days, and consider lowering the programme dose until you have.',
  crisis:
    'You indicated thoughts of being better off dead or of hurting yourself. Please contact Tele-MANAS (14416) or a professional today, and tell one trusted person now.',
};
