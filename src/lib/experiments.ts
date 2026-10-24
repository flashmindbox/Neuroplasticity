// Personal (n-of-1) experiments (handbook/05-personal-experiments.md).
import type { DailyLog, Experiment, FocusSession } from './db';
import { addDays, rangeKeys, type DateKey } from './dates';
import { mean, round, sd } from './stats';

export interface MetricDef {
  id: string;
  label: string;
  /** Higher is better? Used to phrase the result. */
  higherIsBetter: boolean;
}

export const EXPERIMENT_METRICS: MetricDef[] = [
  { id: 'clarity', label: 'Clarity (avg of AM/PM, 1–10)', higherIsBetter: true },
  { id: 'focusMinutes', label: 'Focus minutes per day', higherIsBetter: true },
  { id: 'wandersPerBlock', label: 'Mind-wanders per focus block', higherIsBetter: false },
  { id: 'sleepHours', label: 'Sleep hours', higherIsBetter: true },
  { id: 'stress', label: 'Stress (1–10)', higherIsBetter: false },
  { id: 'mood', label: 'Mood (1–10)', higherIsBetter: true },
  { id: 'energy', label: 'Energy (1–10)', higherIsBetter: true },
];

export function metricValue(
  metric: string,
  log: DailyLog | undefined,
  sessions: FocusSession[],
): number | null {
  const focus = sessions.filter((s) => s.kind === 'focus');
  switch (metric) {
    case 'clarity': {
      const vals = [log?.clarityAM, log?.clarityPM].filter((v): v is number => v != null);
      return mean(vals);
    }
    case 'focusMinutes':
      return focus.length ? focus.reduce((s, f) => s + f.actualMin, 0) : null;
    case 'wandersPerBlock': {
      const w = focus.filter((f) => f.wanders != null);
      return w.length ? w.reduce((s, f) => s + (f.wanders ?? 0), 0) / w.length : null;
    }
    case 'sleepHours':
    case 'stress':
    case 'mood':
    case 'energy':
      return (log?.[metric] as number | undefined) ?? null;
    default:
      return null;
  }
}

export interface ExperimentResult {
  baselineN: number;
  interventionN: number;
  baselineMean: number | null;
  interventionMean: number | null;
  difference: number | null;
  /** Difference divided by pooled SD (a rough effect size). */
  effectSize: number | null;
  verdict: string;
}

export function analyseExperiment(
  exp: Pick<Experiment, 'metric' | 'baselineStart' | 'interventionStart' | 'end'>,
  valueOn: (date: DateKey) => number | null,
): ExperimentResult {
  const collect = (from: DateKey, to: DateKey) =>
    rangeKeys(from, to)
      .map(valueOn)
      .filter((v): v is number => v != null);
  const base = collect(exp.baselineStart, addDays(exp.interventionStart, -1));
  const inter = collect(exp.interventionStart, exp.end);
  const bm = mean(base);
  const im = mean(inter);
  const difference = bm != null && im != null ? im - bm : null;
  const sds = [sd(base), sd(inter)].filter((v): v is number => v != null);
  const pooled = sds.length ? Math.sqrt(sds.reduce((s, v) => s + v * v, 0) / sds.length) : null;
  const effectSize =
    difference != null && pooled ? round(difference / pooled, 2) : difference === 0 ? 0 : null;

  const def = EXPERIMENT_METRICS.find((m) => m.id === exp.metric);
  let verdict = 'Not enough data yet — aim for at least 5 logged days in each period.';
  if (base.length >= 5 && inter.length >= 5 && difference != null) {
    const better = def?.higherIsBetter ? difference > 0 : difference < 0;
    const size = Math.abs(effectSize ?? 0);
    if (size < 0.3) verdict = 'No clear difference — within normal day-to-day variation.';
    else
      verdict = `${better ? 'Better' : 'Worse'} during the intervention (${
        size >= 0.8 ? 'large' : size >= 0.5 ? 'moderate' : 'small'
      } difference relative to day-to-day variation). Check for confounds before deciding.`;
  }
  return {
    baselineN: base.length,
    interventionN: inter.length,
    baselineMean: bm == null ? null : round(bm, 2),
    interventionMean: im == null ? null : round(im, 2),
    difference: difference == null ? null : round(difference, 2),
    effectSize,
    verdict,
  };
}

/** Phase-0 fog audit, pre-configured as the first experiment (baseline only, 14 days). */
export function fogAuditExperiment(start: DateKey): Experiment {
  return {
    title: 'Fog audit (14 days)',
    metric: 'clarity',
    baselineStart: start,
    interventionStart: addDays(start, 14),
    end: addDays(start, 27),
    status: 'running',
    note: 'Log clarity AM/PM plus sleep, caffeine, screens and exercise. After 14 days, use the Fog audit view on Tests to choose a lever, then run it as the intervention period.',
  };
}
