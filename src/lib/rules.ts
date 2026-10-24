// Pre-committed decision rules (handbook/06-failure-modes.md). Deterministic — never AI-dependent.
import type { DimensionId } from '../content/dimensions';
import { DIMENSION_BY_ID } from '../content/dimensions';
import { brainCheckStatus } from './brainCheck';
import type { BrainCheckEntry, DailyLog, RatingSet, ScreeningEntry } from './db';
import { addDays, daysBetween, rangeKeys, type DateKey } from './dates';
import { scoreScreening, type ScreeningAction } from './screening';
import { mean } from './stats';

export type AlertLevel = 'crisis' | 'warning' | 'info';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  action: string;
  route?: string;
}

export interface RuleInputs {
  today: DateKey;
  programmeStart: DateKey;
  logs: Map<DateKey, DailyLog>;
  completionOf: (date: DateKey) => number;
  doubleMissNow: boolean;
  screenings: ScreeningEntry[];
  brainChecks: BrainCheckEntry[];
  ratings: RatingSet[];
  targets: DimensionId[];
  lastBackupAt: string | null;
  deload: boolean;
  taper: boolean;
}

const SCREENING_FRESH_DAYS = 35;

export function latestScreenings(entries: ScreeningEntry[], today: DateKey) {
  const latest: Partial<
    Record<ScreeningEntry['kind'], { entry: ScreeningEntry; action: ScreeningAction }>
  > = {};
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (daysBetween(e.date, today) > SCREENING_FRESH_DAYS) continue;
    latest[e.kind] = { entry: e, action: scoreScreening(e.kind, e.answers).action };
  }
  return latest;
}

export function evaluateRules(i: RuleInputs): Alert[] {
  const alerts: Alert[] = [];
  const latest = latestScreenings(i.screenings, i.today);
  const actions = Object.values(latest).map((l) => l!.action);

  if (actions.includes('crisis')) {
    alerts.push({
      id: 'crisis',
      level: 'crisis',
      title: 'Please reach out today',
      action:
        'Call Tele-MANAS on 14416 (free, 24×7) or a professional, and tell one trusted person now. In an emergency call 112.',
      route: '/handbook/04-safety-and-wellbeing.md',
    });
  } else if (actions.includes('urgent')) {
    alerts.push({
      id: 'screen-urgent',
      level: 'warning',
      title: 'Your latest check-in score is high',
      action:
        'Talk to a counsellor or doctor in the next few days. Consider lowering the programme dose.',
      route: '/handbook/04-safety-and-wellbeing.md',
    });
  } else if (actions.includes('professional')) {
    alerts.push({
      id: 'screen-professional',
      level: 'warning',
      title: 'Your latest check-in suggests talking to a professional',
      action: 'Book a counsellor or doctor within 2 weeks and tell your accountability partner.',
      route: '/handbook/04-safety-and-wellbeing.md',
    });
  }

  // Stress ≥ 7 on 7 consecutive logged days.
  const last7 = rangeKeys(addDays(i.today, -6), i.today).map((d) => i.logs.get(d)?.stress);
  if (last7.every((s) => s != null && s >= 7)) {
    alerts.push({
      id: 'stress',
      level: 'warning',
      title: 'Stress has been 7+ for a week',
      action: 'Take a deload week (halve the programme dose), protect sleep, and talk to someone.',
      route: '/handbook/modules/L1-stress-emotions.md',
    });
  }

  // Low clarity together with elevated screening.
  const clarity = rangeKeys(addDays(i.today, -6), i.today)
    .map((d) => i.logs.get(d))
    .flatMap((l) => [l?.clarityAM, l?.clarityPM])
    .filter((v): v is number => v != null);
  const elevated = Object.values(latest).some((l) => l!.entry.total >= 10);
  if (clarity.length >= 5 && (mean(clarity) ?? 10) <= 4 && elevated) {
    alerts.push({
      id: 'clarity-mood',
      level: 'warning',
      title: 'Low clarity alongside a raised mood/anxiety score',
      action:
        'Brain fog this week may be linked to mood or anxiety. Please talk to a professional.',
      route: '/handbook/modules/L0-brain-clarity.md',
    });
  }

  const bc = brainCheckStatus(i.brainChecks);
  if (bc.kind === 'tracking' && bc.decline) {
    alerts.push({
      id: 'brain-decline',
      level: 'warning',
      title: 'Brain Check below your baseline for 2+ weeks',
      action:
        'First rule out obvious causes (poor sleep, illness, a stressful week). If none explains it, see a doctor.',
      route: '/handbook/modules/L0-brain-clarity.md',
    });
  }

  if (i.doubleMissNow) {
    alerts.push({
      id: 'double-miss',
      level: 'info',
      title: 'Two days missed in a row',
      action: 'Make today a minimum viable day (≈5 minutes). Then note in the journal what broke.',
    });
  }

  // Habit completion < 70% over the last 14 days (needs 10+ days of programme).
  if (daysBetween(i.programmeStart, i.today) >= 10) {
    const days = rangeKeys(addDays(i.today, -14), addDays(i.today, -1)).filter(
      (d) => d >= i.programmeStart,
    );
    const avg = mean(days.map(i.completionOf));
    if (avg != null && days.length >= 10 && avg < 0.7) {
      alerts.push({
        id: 'habit-low',
        level: 'info',
        title: `Habit completion ${Math.round(avg * 100)}% over two weeks`,
        action:
          'Shrink the challenge: fewer items or shorter doses until you succeed ~80% of days.',
        route: '/charter',
      });
    }
  }

  // Target stalled: self-rating not higher after 4+ weeks.
  const self = i.ratings
    .filter((r) => r.source === 'self')
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const latestRating = self[self.length - 1];
  if (latestRating) {
    const earlier = [...self].reverse().find((r) => daysBetween(r.date, latestRating.date) >= 28);
    for (const t of i.targets) {
      const now = latestRating.ratings[t];
      const then = earlier?.ratings[t];
      if (now != null && then != null && now <= then) {
        alerts.push({
          id: `stalled-${t}`,
          level: 'info',
          title: `${DIMENSION_BY_ID[t].name}: no improvement in 4+ weeks`,
          action:
            'Change the technique (not the goal). Pick another exercise from the module or run an experiment.',
          route: `/handbook/${DIMENSION_BY_ID[t].module}`,
        });
      }
    }
  }

  if (!i.lastBackupAt || daysBetween(i.lastBackupAt.slice(0, 10), i.today) > 30) {
    if (daysBetween(i.programmeStart, i.today) >= 7) {
      alerts.push({
        id: 'backup',
        level: 'info',
        title: 'Back up your data',
        action: 'Your data lives only on this device. Export a backup file from Settings.',
        route: '/settings',
      });
    }
  }

  if (i.deload) {
    alerts.push({
      id: 'deload',
      level: 'info',
      title: 'Deload week',
      action: 'Programme dose is halved this week (not your study). Absorb the training.',
    });
  }
  if (i.taper) {
    alerts.push({
      id: 'taper',
      level: 'info',
      title: 'Taper',
      action: 'Keep sleep, exercise, short attention practice and the journal. Nothing new.',
      route: '/handbook/modules/L5-exam-performance.md',
    });
  }

  return alerts;
}
