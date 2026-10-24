// The mentor: turns the protocol, your morning check-in and your history into one next step,
// plain-language feedback and visible progress. Deterministic and offline — never AI-dependent.
import { DIMENSION_BY_ID, type DimensionId } from '../content/dimensions';
import { dailyProtocol, LIGHT_SKIP_IDS, MVD_ITEMS, type ProtocolItem } from '../content/protocol';
import type { PhaseState } from '../content/roadmap';
import { brainCheckStatus } from './brainCheck';
import type { BrainCheckEntry, DailyLog, DrillEntry, FocusSession, TalkEntry } from './db';
import { addDays, daysBetween, rangeKeys, type DateKey } from './dates';
import type { WeekMetrics } from './metrics';
import { mean, round } from './stats';
import type { DayStatus } from './streak';

// --- Check-in -------------------------------------------------------------------------------

export interface Choice {
  label: string;
  value: number;
}

// Five tappable answers per question, stored on the same 1–10 scales as the detailed log.
export const SLEEP_CHOICES: Choice[] = [
  { label: 'Under 5 h', value: 4.5 },
  { label: '5–6 h', value: 5.5 },
  { label: '6–7 h', value: 6.5 },
  { label: '7–8 h', value: 7.5 },
  { label: '8 h +', value: 8.5 },
];
export const ENERGY_CHOICES: Choice[] = [
  { label: 'Drained', value: 2 },
  { label: 'Low', value: 4 },
  { label: 'Okay', value: 6 },
  { label: 'Good', value: 8 },
  { label: 'Energised', value: 10 },
];
export const STRESS_CHOICES: Choice[] = [
  { label: 'Calm', value: 2 },
  { label: 'Mild', value: 4 },
  { label: 'Tense', value: 6 },
  { label: 'Stressed', value: 8 },
  { label: 'Overwhelmed', value: 10 },
];
export const MOOD_CHOICES: Choice[] = [
  { label: 'Low', value: 2 },
  { label: 'Flat', value: 4 },
  { label: 'Okay', value: 6 },
  { label: 'Good', value: 8 },
  { label: 'Great', value: 10 },
];
export const CLARITY_CHOICES: Choice[] = [
  { label: 'Foggy', value: 2 },
  { label: 'Dull', value: 4 },
  { label: 'Okay', value: 6 },
  { label: 'Clear', value: 8 },
  { label: 'Sharp', value: 10 },
];
export const EXERCISE_CHOICES: Choice[] = [
  { label: 'None', value: 0 },
  { label: 'Under 20 min', value: 10 },
  { label: '20–30 min', value: 25 },
  { label: '30–45 min', value: 40 },
  { label: '45 min +', value: 50 },
];

/** Exercise minutes that count as the day's "Exercise 30–45 min". */
export const EXERCISE_DONE_MIN = 30;

/** The choice closest to a stored value, e.g. one typed into the detailed log. */
export function nearestChoice(choices: Choice[], value: number | undefined): number | undefined {
  if (value == null) return undefined;
  return choices.reduce((best, c) =>
    Math.abs(c.value - value) < Math.abs(best.value - value) ? c : best,
  ).value;
}

export type DayMode = 'full' | 'light' | 'minimum';

export const MODE_INFO: Record<DayMode, { label: string; summary: string }> = {
  full: { label: 'Full day', summary: 'The whole plan for your phase.' },
  light: {
    label: 'Light day',
    summary: 'Shorter attention practice; no drill or talk. It still counts.',
  },
  minimum: {
    label: 'Minimum day',
    summary: 'About 5 minutes: breathe, one tiny step, one line in the journal. It still counts.',
  },
};

export function modeOf(log: DailyLog | undefined): DayMode {
  return log?.mvd ? 'minimum' : log?.light ? 'light' : 'full';
}

export function modePatch(mode: DayMode): Pick<DailyLog, 'mvd' | 'light'> {
  return { mvd: mode === 'minimum', light: mode === 'light' };
}

export interface CheckIn {
  sleepHours: number;
  energy: number;
  stress: number;
  mood: number;
}

export interface PlanSuggestion {
  mode: DayMode;
  reasons: string[];
  /** Overwhelmed or very low today: worth naming where support is, gently. */
  support?: boolean;
}

export const SUPPORT_LINE =
  'If days like this keep coming, talk to someone you trust — or call Tele-MANAS on 14416 (free, 24×7).';

/** Sizes the day to how you are (programme rule 3: ~80% success beats heroic plans that fail). */
export function suggestPlan(c: CheckIn, { doubleMiss = false } = {}): PlanSuggestion {
  const flags: [boolean, number, string][] = [
    [c.sleepHours < 5, 2, 'you slept under 5 hours'],
    [c.sleepHours >= 5 && c.sleepHours < 6, 1, 'you slept under 6 hours'],
    [c.energy <= 2, 2, 'your energy is very low'],
    [c.energy > 2 && c.energy <= 4, 1, 'your energy is low'],
    [c.stress >= 10, 2, 'you feel overwhelmed'],
    [c.stress >= 8 && c.stress < 10, 1, 'stress is high'],
    [c.mood <= 2, 1, 'your mood is low'],
  ];
  const raised = flags.filter(([on]) => on);
  const load = raised.reduce((s, [, weight]) => s + weight, 0);
  const reasons = raised.map(([, , reason]) => reason);

  let mode: DayMode = load >= 3 ? 'minimum' : load >= 1 ? 'light' : 'full';
  // Handbook rule after two missed days: restart with a minimum viable day.
  if (doubleMiss && mode !== 'minimum') {
    mode = 'minimum';
    reasons.unshift('you are restarting after two missed days');
  }
  return { mode, reasons, ...(c.stress >= 10 || c.mood <= 2 ? { support: true } : {}) };
}

export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function planExplanation(s: PlanSuggestion): string {
  if (s.mode === 'full') return 'You’re good to go — the full plan today.';
  const text = `${MODE_INFO[s.mode].label}, because ${joinList(s.reasons)}. ${MODE_INFO[s.mode].summary}`;
  return s.support ? `${text} ${SUPPORT_LINE}` : text;
}

// --- Today's items --------------------------------------------------------------------------

/** Habits are ticked, not "done" as a session; they live in the plan's habit row and the close-out. */
export const HABIT_IDS = ['wake', 'light', 'exercise', 'winddown'];

export function lightAttentionMinutes(minutes: number): number {
  return Math.max(5, Math.round(minutes / 2));
}

export function dayItems(date: DateKey, state: PhaseState, mode: DayMode): ProtocolItem[] {
  if (mode === 'minimum') return MVD_ITEMS;
  const items = dailyProtocol(date, state);
  if (mode === 'full') return items;
  return items
    .filter((i) => !LIGHT_SKIP_IDS.includes(i.id))
    .map((i) => {
      if (i.id !== 'attention') return i;
      const minutes = lightAttentionMinutes(i.minutes);
      return { ...i, minutes, title: `Attention training · ${minutes} min` };
    });
}

// --- Next step ------------------------------------------------------------------------------

export type StepKind = 'checkin' | 'briefing' | 'task' | 'study' | 'close' | 'done';

export interface Step {
  kind: StepKind;
  /** Protocol item id for tasks (`target-<id>` for an active target). */
  id: string;
  title: string;
  why: string;
  minutes?: number;
  route?: string;
  cta?: string;
}

const WHY: Record<string, string> = {
  attention:
    'Trains the notice-and-return skill a 3-hour paper depends on. Every return to the breath is one rep.',
  blocks:
    'Write an intention, put the phone in another room, tap each time your mind wanders. Ordinary study becomes focus training.',
  drill:
    'One timed prompt a day builds the multi-angle thinking that Mains and the Essay reward. Score yourself before anyone else does.',
  talk: 'Speaking against a timer and listening back once is how fillers fall and structure becomes automatic.',
  journal:
    'One win, one emotion named, one lesson, tomorrow’s if-then. This is where the day turns into learning.',
  'mvd-breath': 'A few slow sighs settle the body. On a hard day, that is enough.',
  'mvd-target': 'One 10-minute focus block or one short drill. Small keeps the habit alive.',
  'mvd-journal': 'One line about what you did or felt. That keeps the chain unbroken.',
};

const CTA: Record<string, string> = {
  attention: 'Start attention training',
  blocks: 'Start a focus block',
  drill: 'Open today’s drill',
  talk: 'Record a talk',
  journal: 'Write tonight’s reflection',
  'mvd-breath': 'Breathe for a minute',
  'mvd-target': 'Start a 10-minute block',
  'mvd-journal': 'Write one line',
};

/** Where each target's daily practice happens in the app. */
export const TARGET_ROUTE: Record<DimensionId, string> = {
  focus: '/focus',
  discipline: '/journal',
  stress: '/focus?tab=breathe',
  vision: '/charter',
  motivation: '/journal',
  confidence: '/journal?tab=evidence',
  resilience: '/journal',
  thinking: '/drills',
  judgement: '/drills?type=calibration',
  expression: '/drills?type=structure',
  communication: '/speak',
  leadership: '/journal?tab=stories',
  integrity: '/drills?type=dilemma',
};

export const CHECKIN_STEP: Step = {
  kind: 'checkin',
  id: 'checkin',
  title: 'Morning check-in',
  why: 'Four taps. I’ll size today’s plan to how you actually are, not how you wish you were.',
};

export const BRIEFING_STEP: Step = {
  kind: 'briefing',
  id: 'briefing',
  title: 'Your why, and a plan for the hard moment',
  why: 'Reading your purpose and rehearsing the moment you’ll want to quit makes follow-through likelier. Picture the process, not the result.',
  minutes: 2,
};

const STUDY_STEP: Step = {
  kind: 'study',
  id: 'study',
  title: 'Practice done — now study',
  why: 'Run each study block with the focus timer. Come back this evening to close the day.',
  route: '/focus',
  cta: 'Start a focus block',
};

export const CLOSE_STEP: Step = {
  kind: 'close',
  id: 'close',
  title: 'Close the day',
  why: 'One minute of logging is how we find out what actually works for you.',
  minutes: 1,
};

const DONE_STEP: Step = {
  kind: 'done',
  id: 'done',
  title: 'Day complete',
  why: 'Rest well. Sleep is when today’s practice gets consolidated.',
};

const PRACTICE_ORDER = ['attention', 'blocks', 'drill', 'talk'];
const MVD_ORDER = ['mvd-breath', 'mvd-target', 'mvd-journal'];
export const EVENING_HOUR = 17;
/** After this, the mentor stops suggesting practice and moves to the evening close-out. */
export const LATE_HOUR = 20;

function taskStep(item: ProtocolItem): Step {
  return {
    kind: 'task',
    id: item.id,
    title: item.title,
    why: WHY[item.id] ?? item.detail,
    minutes: item.minutes || undefined,
    route: item.route,
    cta: CTA[item.id] ?? 'Open',
  };
}

function targetStep(t: DimensionId): Step {
  const d = DIMENSION_BY_ID[t];
  return {
    kind: 'task',
    id: `target-${t}`,
    title: `${d.name} — today’s practice`,
    why: d.practice,
    route: TARGET_ROUTE[t],
    cta: 'Open',
  };
}

export interface StepInput {
  hour: number;
  items: ProtocolItem[];
  targets: DimensionId[];
  log: DailyLog | undefined;
}

/** The single most useful thing to do now. Everything else waits in the plan list. */
export function nextStep({ hour, items, targets, log }: StepInput): Step {
  const checks = log?.checks ?? {};
  const skipped = log?.skipped ?? {};
  const open = (id: string) => !checks[id] && !skipped[id];
  const item = (id: string) => items.find((i) => i.id === id);

  if (!log?.checkedIn)
    return hour < 12 ? CHECKIN_STEP : { ...CHECKIN_STEP, title: 'Quick check-in' };

  if (log.mvd) {
    for (const id of MVD_ORDER) {
      const i = item(id);
      if (i && open(id)) return taskStep(i);
    }
    return log.closed ? DONE_STEP : CLOSE_STEP;
  }

  // The briefing rehearses the day ahead, so it is only offered before the evening.
  const briefingOpen = ['vision', 'ifthen'].some((id) => item(id) && !checks[id]);
  if (briefingOpen && !skipped.briefing && hour < EVENING_HOUR) return BRIEFING_STEP;

  if (hour < LATE_HOUR) {
    for (const id of PRACTICE_ORDER) {
      const i = item(id);
      if (i && open(id)) return taskStep(i);
    }
    for (const t of targets) if (open(`target-${t}`)) return targetStep(t);
  }

  const journal = item('journal');
  const journalOpen = !!journal && open('journal');
  if (log.closed && !journalOpen) return DONE_STEP;
  if (hour < EVENING_HOUR) return STUDY_STEP;
  if (journal && journalOpen) return taskStep(journal);
  return log.closed ? DONE_STEP : CLOSE_STEP;
}

// --- Activity → automatic ticks -------------------------------------------------------------

export type Activity =
  | 'attention'
  | 'breath'
  | 'focus'
  | 'talk'
  | 'journal'
  | 'ifthen'
  | 'vision'
  | 'evidence'
  | 'mock'
  | 'brain'
  | 'review'
  | 'close'
  | `drill:${string}`;

const DRILL_TARGET: Record<string, DimensionId> = {
  lenses: 'thinking',
  steelman: 'thinking',
  causal: 'thinking',
  dm: 'thinking',
  structure: 'expression',
  dilemma: 'integrity',
  calibration: 'judgement',
};

const target = (d: DimensionId) => `target-${d}`;

/** Checklist ids an activity completes, so you never tick by hand what the app already saw you do. */
export function ticksFor(activity: Activity): string[] {
  if (activity.startsWith('drill:')) {
    const dim = DRILL_TARGET[activity.slice('drill:'.length)];
    return ['drill', 'mvd-target', ...(dim ? [target(dim)] : [])];
  }
  switch (activity) {
    case 'attention':
      return ['attention', 'mvd-breath', target('focus')];
    case 'breath':
      return ['mvd-breath', target('stress')];
    case 'focus':
      return ['blocks', 'mvd-target', target('focus')];
    case 'talk':
      return ['talk', 'mvd-target', target('communication')];
    case 'journal':
      return ['journal', 'mvd-journal', target('motivation')];
    case 'ifthen':
      return ['ifthen', target('discipline')];
    case 'vision':
      return ['vision', target('vision')];
    case 'evidence':
      return [target('confidence')];
    case 'mock':
      return [target('judgement')];
    case 'close':
      return ['quicklog'];
    default:
      return [];
  }
}

/** Weekly checklist ids an activity completes. */
export function weeklyTicksFor(activity: Activity): string[] {
  switch (activity) {
    case 'drill:dilemma':
      return ['dilemma'];
    case 'mock':
      return ['mock'];
    case 'brain':
      return ['brain'];
    case 'review':
      return ['review'];
    default:
      return [];
  }
}

// --- What the mentor says -------------------------------------------------------------------

export function greeting(hour: number, name?: string): string {
  const part = hour < 12 ? 'Good morning' : hour < EVENING_HOUR ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

const TIPS = [
  'Behaviour first, feelings follow. You don’t need to feel disciplined to act disciplined.',
  'Each time you notice your mind has wandered and bring it back, that is one rep. Wandering is not failure.',
  'Aim for about 80% success. If something fails most days, make it smaller — not harder.',
  'Judge four-week trends, not single days. One bad day is noise.',
  'Sleep, exercise and a weekly half-day off are part of the training, not rewards for it.',
  'Rehearse the process, not the result: picture the hard moment and what you will do then.',
  'Your worth rests on your values, not on a rank. That makes you calmer — and calm performs better.',
  'Distrust your own ratings a little. Claude’s second opinion and real people keep you honest.',
  'Train the real task: exam-format questions, timed, in exam-like conditions.',
  'A minimum day still counts. The only rule is: never miss twice.',
];

const CHAIN_MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250];

function dayHash(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export interface NoteInput {
  today: DateKey;
  dayNumber: number;
  chainLength: number;
  doubleMissNow: boolean;
  missedYesterday: boolean;
  /** Sunday, and this week's review isn't done yet. */
  reviewDue?: boolean;
  state: PhaseState;
  step: Step;
}

/** One short, situational line — the thing a mentor would say first. */
export function mentorNote(i: NoteInput): string {
  if (i.state.examWeek)
    return 'Exam time. Nothing new today: your usual routine, slow breathing before the paper, one question at a time.';
  if (i.state.taper)
    return 'Taper: keep sleep, exercise, short attention practice and the journal. Nothing new — you are consolidating.';
  if (i.dayNumber <= 1)
    return 'Welcome to day 1. Today is about setting up, not about being perfect. I’ll give you one step at a time.';
  if (i.doubleMissNow)
    return 'Two days slipped. No guilt — the rule is simply to restart small. A 5-minute day today puts you back on track.';
  if (i.missedYesterday)
    return 'Yesterday slipped. One miss undoes nothing — the only rule is not to make it two.';
  if (i.reviewDue)
    return 'It’s Sunday — take ten minutes to look back. My note on your week is waiting in the Sunday review.';
  if (i.step.kind === 'done')
    return 'Everything on today’s plan is done. Rest well — sleep is when today’s practice gets locked in.';
  if (i.state.deload)
    return 'Lighter week: the programme dose is halved (not your study). Recovery is part of training.';
  if (CHAIN_MILESTONES.includes(i.chainLength))
    return `${i.chainLength} days of showing up. This is how change happens — repetition, not intensity.`;
  return TIPS[dayHash(i.today) % TIPS.length];
}

/** Honest expectations, so a slow start isn't mistaken for failure (how-the-brain-changes.md). */
export function expectation(dayNumber: number): string {
  if (dayNumber <= 14)
    return 'Weeks 1–2 set your baseline — the numbers everything is compared against. Results aren’t expected yet.';
  if (dayNumber <= 42)
    return 'Weeks 3–6: look for behaviour changes first — more blocks finished, longer blocks, quicker returns. New habits take about 66 days to become automatic.';
  if (dayNumber <= 90)
    return 'Months 2–3: skills move — compare your first and latest drill scores and fillers per minute. Keep the dose steady.';
  return 'Calm and confidence change at the trait level over about 24 weeks. Judge 4-week trends, not single days.';
}

// --- Visible progress -----------------------------------------------------------------------

export interface ProgressInput {
  today: DateKey;
  programmeStart: DateKey;
  logs: DailyLog[];
  sessions: FocusSession[];
  drills: DrillEntry[];
  talks: TalkEntry[];
  brainChecks: BrainCheckEntry[];
  statusOf: (date: DateKey) => DayStatus;
}

export interface Highlight {
  id: string;
  label: string;
  value: string;
  detail: string;
  /** Direction of change since you started, when there is enough data to compare. */
  trend: 'up' | 'down' | 'flat' | null;
  /** Whether the current picture is good news (null = neutral or too early). */
  good: boolean | null;
}

export interface Locked {
  id: string;
  label: string;
  unlock: string;
  /** 0–1 towards unlocking. */
  progress: number;
  route?: string;
}

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

type Trend = NonNullable<Highlight['trend']>;

export function compare(current: number, start: number, tolerance = 0.1): Trend {
  if (start === 0) return current > 0 ? 'up' : 'flat';
  const ratio = current / start;
  return ratio > 1 + tolerance ? 'up' : ratio < 1 - tolerance ? 'down' : 'flat';
}

const goodIf = (trend: Trend, higherIsBetter: boolean): boolean | null =>
  trend === 'flat' ? null : (trend === 'up') === higherIsBetter;

const byDate = <T extends { date: DateKey; id?: number }>(a: T, b: T) =>
  a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1;

const inRange = (d: DateKey, from: DateKey, to: DateKey) => d >= from && d <= to;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const avgOf = (scores: Record<string, number>) => mean(Object.values(scores));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** First-k vs last-k comparison for a short series (k ≤ 3, never overlapping). */
function firstLast(values: number[]): { first: number; last: number } | null {
  if (values.length < 4) return null;
  const k = Math.min(3, Math.floor(values.length / 2));
  return { first: mean(values.slice(0, k))!, last: mean(values.slice(-k))! };
}

function showingUp(i: ProgressInput): Highlight | Locked {
  const from = i.programmeStart > addDays(i.today, -13) ? i.programmeStart : addDays(i.today, -13);
  // An unfinished today is not a miss yet.
  const days = rangeKeys(from, i.today).filter((d) => d !== i.today || i.statusOf(d) !== 'missed');
  if (!days.length)
    return {
      id: 'showing-up',
      label: 'Showing up',
      unlock: 'Finish today’s plan (or a minimum day) to start your record.',
      progress: 0,
    };
  const shown = days.filter((d) => i.statusOf(d) !== 'missed').length;
  const share = shown / days.length;
  return {
    id: 'showing-up',
    label: 'Showing up',
    value: `${shown} of ${plural(days.length, 'day')}`,
    detail:
      days.length >= 14
        ? 'Days in the last two weeks with half your plan done, or a minimum day.'
        : 'Days so far with half your plan done, or a minimum day.',
    trend: null,
    good: share >= 0.8 ? true : share < 0.6 ? false : null,
  };
}

function deepFocus(i: ProgressInput): Highlight | Locked {
  const blocks = i.sessions.filter((s) => s.kind === 'focus').sort(byDate);
  if (!blocks.length)
    return {
      id: 'focus',
      label: 'Deep focus',
      unlock: 'Run your first focus block — every block is counted here.',
      progress: 0,
      route: '/focus',
    };
  const week = sum(
    blocks.filter((s) => inRange(s.date, addDays(i.today, -6), i.today)).map((s) => s.actualMin),
  );
  const firstDate = blocks[0].date;
  if (daysBetween(firstDate, i.today) >= 13) {
    const firstWeek = sum(
      blocks
        .filter((s) => inRange(s.date, firstDate, addDays(firstDate, 6)))
        .map((s) => s.actualMin),
    );
    const trend = compare(week, firstWeek);
    return {
      id: 'focus',
      label: 'Deep focus',
      value: `${formatMinutes(week)} this week`,
      detail:
        trend === 'flat'
          ? `About the same as your first week (${formatMinutes(firstWeek)}).`
          : `${trend === 'up' ? 'Up' : 'Down'} from ${formatMinutes(firstWeek)} in your first week.`,
      trend,
      good: goodIf(trend, true),
    };
  }
  const longest = Math.max(...blocks.map((s) => s.actualMin));
  return {
    id: 'focus',
    label: 'Deep focus',
    value: `${formatMinutes(week)} this week`,
    detail: `${plural(blocks.length, 'block')} so far · longest ${longest} min.`,
    trend: null,
    good: null,
  };
}

function attentionReps(i: ProgressInput): Highlight | Locked {
  const counted = i.sessions.filter((s) => s.kind === 'attention' || s.kind === 'focus');
  const training = i.sessions.filter((s) => s.kind === 'attention');
  const reps = sum(counted.map((s) => s.wanders ?? 0));
  if (!training.length && reps === 0)
    return {
      id: 'reps',
      label: 'Attention reps',
      unlock: 'Do one attention-training session. Each return to the breath is one rep.',
      progress: 0,
      route: '/focus?tab=attention',
    };
  const thisWeek = sum(
    counted
      .filter((s) => inRange(s.date, addDays(i.today, -6), i.today))
      .map((s) => s.wanders ?? 0),
  );
  return {
    id: 'reps',
    label: 'Attention reps',
    value: plural(reps, 'rep'),
    detail: `+${thisWeek} this week · ${plural(training.length, 'training session')} · ${formatMinutes(
      sum(training.map((s) => s.actualMin)),
    )} of training.`,
    trend: null,
    good: null,
  };
}

function thinking(i: ProgressInput): Highlight | Locked {
  const drills = i.drills
    .filter((d) => d.type !== 'calibration' && Object.keys(d.selfScores).length)
    .sort(byDate);
  const rated = drills.filter((d) => d.ai);
  // One consistent source: Claude's ratings once there are two, otherwise your own scores.
  const useAi = rated.length >= 2;
  const series = (useAi ? rated : drills).map((d) => avgOf(useAi ? d.ai!.scores : d.selfScores)!);
  if (series.length < 2)
    return {
      id: 'thinking',
      label: 'Thinking drills',
      unlock: `Do ${plural(2 - series.length, 'more thinking drill')} to see your trend.`,
      progress: series.length / 2,
      route: '/drills',
    };
  const source = useAi ? 'Claude’s ratings' : 'your own scores';
  const fl = firstLast(series);
  const recent = mean(series.slice(-3))!;
  if (fl) {
    const trend = compare(fl.last, fl.first, 0.05);
    return {
      id: 'thinking',
      label: 'Thinking drills',
      value: `${round(recent, 1)}/5`,
      detail: `First drills ${round(fl.first, 1)}/5 → latest ${round(fl.last, 1)}/5 (${source}).`,
      trend,
      good: goodIf(trend, true),
    };
  }
  return {
    id: 'thinking',
    label: 'Thinking drills',
    value: `${round(recent, 1)}/5`,
    detail: `${plural(series.length, 'drill')} so far (${source}). Two more and I can show a trend.`,
    trend: null,
    good: null,
  };
}

function speaking(i: ProgressInput): Highlight | Locked {
  const talks = i.talks.filter((t) => t.durationSec >= 10).sort(byDate);
  if (talks.length < 2)
    return {
      id: 'speaking',
      label: 'Speaking',
      unlock: `Record ${plural(2 - talks.length, 'more 2-minute talk')} to see fillers and pace.`,
      progress: talks.length / 2,
      route: '/speak',
    };
  const fpm = talks.map((t) => t.fillers / (t.durationSec / 60));
  const recent = mean(fpm.slice(-3))!;
  const fl = firstLast(fpm);
  if (fl) {
    const trend = compare(fl.last, fl.first);
    return {
      id: 'speaking',
      label: 'Speaking',
      value: `${round(recent, 1)} fillers/min`,
      detail:
        trend === 'flat'
          ? `About the same as your first talks (${round(fl.first, 1)}/min).`
          : `${trend === 'down' ? 'Down' : 'Up'} from ${round(fl.first, 1)}/min in your first talks.`,
      trend,
      good: goodIf(trend, false),
    };
  }
  const wpm = talks[talks.length - 1].wpm;
  return {
    id: 'speaking',
    label: 'Speaking',
    value: `${round(recent, 1)} fillers/min`,
    detail: `${plural(talks.length, 'talk')} so far${wpm ? ` · latest pace ${wpm} wpm` : ''}.`,
    trend: null,
    good: null,
  };
}

function dailyMetric(
  i: ProgressInput,
  opts: {
    id: string;
    label: string;
    unit: string;
    pick: (l: DailyLog) => number | null | undefined;
    higherIsBetter: boolean;
    goodAt?: (v: number) => boolean | null;
    how: string;
  },
): Highlight | Locked {
  const points = i.logs
    .map((l) => ({ date: l.date, v: opts.pick(l) }))
    .filter((p): p is { date: DateKey; v: number } => typeof p.v === 'number')
    .sort(byDate);
  const last7 = points.filter((p) => inRange(p.date, addDays(i.today, -6), i.today));
  if (last7.length < 3)
    return {
      id: opts.id,
      label: opts.label,
      unlock: `Log it on ${plural(3 - last7.length, 'more day')} this week — ${opts.how}.`,
      progress: last7.length / 3,
    };
  const current = mean(last7.map((p) => p.v))!;
  const firstDate = points[0].date;
  const firstWeek = points.filter((p) => inRange(p.date, firstDate, addDays(firstDate, 6)));
  if (daysBetween(firstDate, i.today) >= 13 && firstWeek.length >= 3) {
    const start = mean(firstWeek.map((p) => p.v))!;
    const trend = compare(current, start, 0.05);
    return {
      id: opts.id,
      label: opts.label,
      value: `${round(current, 1)}${opts.unit}`,
      detail:
        trend === 'flat'
          ? `About the same as your first week (${round(start, 1)}${opts.unit}).`
          : `${trend === 'up' ? 'Up' : 'Down'} from ${round(start, 1)}${opts.unit} in your first week.`,
      trend,
      good: goodIf(trend, opts.higherIsBetter),
    };
  }
  return {
    id: opts.id,
    label: opts.label,
    value: `${round(current, 1)}${opts.unit}`,
    detail: 'Average over the last 7 days.',
    trend: null,
    good: opts.goodAt?.(current) ?? null,
  };
}

function brainCheck(i: ProgressInput): Highlight | Locked {
  const status = brainCheckStatus(i.brainChecks);
  if (status.kind !== 'tracking') {
    const total = 7;
    const done = Math.min(total, i.brainChecks.length);
    return {
      id: 'brain',
      label: 'Brain Check',
      unlock: `${plural(status.remaining, 'more weekly Brain Check')} to set your baseline (3 min each).`,
      progress: done / total,
      route: '/tests',
    };
  }
  const pct = Math.round(status.latestChange * 100);
  return {
    id: 'brain',
    label: 'Brain Check',
    value: `${pct >= 0 ? '+' : ''}${pct}% vs baseline`,
    detail: status.decline
      ? 'Below your baseline twice. Rule out sleep, illness or a stressful week first.'
      : pct >= 5
        ? 'Above your baseline.'
        : 'Within your normal range.',
    trend: pct >= 5 ? 'up' : pct <= -5 ? 'down' : 'flat',
    good: status.decline ? false : pct >= -5 ? true : null,
  };
}

function calibration(i: ProgressInput): Highlight | Locked {
  const results = i.drills
    .filter((d) => d.calibration && d.date >= addDays(i.today, -60))
    .flatMap((d) => d.calibration!);
  if (results.length < 10)
    return {
      id: 'calibration',
      label: 'Calibration',
      unlock: 'Take one calibration quiz (10 statements, 5 minutes).',
      progress: results.length / 10,
      route: '/drills?type=calibration',
    };
  const confidence = mean(results.map((r) => r.confidence))! * 100;
  const accuracy = (results.filter((r) => r.correct).length / results.length) * 100;
  const gap = Math.round(confidence - accuracy);
  return {
    id: 'calibration',
    label: 'Calibration',
    value: `${gap > 0 ? '+' : ''}${gap} pts`,
    detail:
      gap > 10
        ? 'Overconfident: your “sure” answers are wrong more often than you think.'
        : gap < -10
          ? 'Underconfident: trust your 70%s more — you are right more than you think.'
          : 'Your confidence matches your accuracy. That is what saves marks in Prelims.',
    trend: null,
    good: Math.abs(gap) <= 10,
  };
}

const isHighlight = (x: Highlight | Locked): x is Highlight => 'value' in x;

/** The few highlights worth a glance on Today: showing up first, then real before/after comparisons. */
export function topHighlights(ready: Highlight[], n = 4): Highlight[] {
  const rank = (h: Highlight) => (h.id === 'showing-up' ? 0 : h.trend ? 1 : 2);
  return [...ready].sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

/** Every progress signal, ordered by how much it tells you early on. */
export function progressHighlights(i: ProgressInput): { ready: Highlight[]; locked: Locked[] } {
  const all = [
    showingUp(i),
    deepFocus(i),
    attentionReps(i),
    thinking(i),
    speaking(i),
    dailyMetric(i, {
      id: 'sleep',
      label: 'Sleep',
      unit: ' h',
      pick: (l) => l.sleepHours,
      higherIsBetter: true,
      goodAt: (v) => (v >= 7 ? true : v < 6.5 ? false : null),
      how: 'the morning check-in asks',
    }),
    dailyMetric(i, {
      id: 'stress',
      label: 'Stress',
      unit: '/10',
      pick: (l) => l.stress,
      higherIsBetter: false,
      goodAt: (v) => (v <= 5 ? true : v >= 7 ? false : null),
      how: 'the morning check-in asks',
    }),
    dailyMetric(i, {
      id: 'clarity',
      label: 'Mental clarity',
      unit: '/10',
      pick: (l) => mean([l.clarityAM, l.clarityPM].filter((v): v is number => v != null)),
      higherIsBetter: true,
      how: 'closing the day asks',
    }),
    brainCheck(i),
    calibration(i),
  ];
  return {
    ready: all.filter(isHighlight),
    locked: all.filter((x): x is Locked => !isHighlight(x)),
  };
}

export interface Milestone {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  done: boolean;
}

/** Cumulative milestones: once reached, they stay reached. */
export function milestones(i: ProgressInput & { weeklyReviews: number }): Milestone[] {
  const blocks = i.sessions.filter((s) => s.kind === 'focus');
  const focusHours = round(sum(blocks.map((s) => s.actualMin)) / 60, 1);
  const longest = Math.max(0, ...blocks.map((s) => s.actualMin));
  const reps = sum(i.sessions.filter((s) => s.kind !== 'breath').map((s) => s.wanders ?? 0));
  const daysShown = rangeKeys(i.programmeStart, i.today).filter(
    (d) => i.statusOf(d) !== 'missed',
  ).length;
  const drills = i.drills.filter((d) => d.type !== 'calibration').length;
  const talks = i.talks.length;
  const defs: [string, string, number, number, string][] = [
    ['first-block', 'First focus block', blocks.length, 1, 'block'],
    ['days-7', 'Show up on 7 days', daysShown, 7, 'days'],
    ['first-drill', 'First thinking drill', drills, 1, 'drill'],
    ['reps-100', '100 attention reps', reps, 100, 'reps'],
    ['first-talk', 'First recorded talk', talks, 1, 'talk'],
    ['focus-10h', '10 hours of deep focus', focusHours, 10, 'h'],
    ['block-50', 'A 50-minute block', longest, 50, 'min'],
    ['reviews-4', 'Four Sunday reviews', i.weeklyReviews, 4, 'reviews'],
    ['days-30', 'Show up on 30 days', daysShown, 30, 'days'],
    ['drills-20', '20 thinking drills', drills, 20, 'drills'],
    ['talks-10', '10 recorded talks', talks, 10, 'talks'],
    ['reps-500', '500 attention reps', reps, 500, 'reps'],
    ['focus-50h', '50 hours of deep focus', focusHours, 50, 'h'],
    ['block-90', 'A 90-minute block', longest, 90, 'min'],
    ['days-100', 'Show up on 100 days', daysShown, 100, 'days'],
    ['focus-200h', '200 hours of deep focus', focusHours, 200, 'h'],
  ];
  return defs.map(([id, title, current, goal, unit]) => ({
    id,
    title,
    current,
    target: goal,
    unit,
    done: current >= goal,
  }));
}

/** The unreached milestone you are closest to. */
export function nextMilestone(ms: Milestone[]): Milestone | null {
  let best: Milestone | null = null;
  for (const m of ms) {
    if (m.done) continue;
    if (!best || m.current / m.target > best.current / best.target) best = m;
  }
  return best;
}

// --- Feedback right after you do something --------------------------------------------------

export function focusBlockFeedback(s: FocusSession, earlier: FocusSession[]): string[] {
  const blocks = earlier.filter((e) => e.kind === 'focus');
  const lines: string[] = [];
  const longest = Math.max(0, ...blocks.map((e) => e.actualMin));
  const minutes = plural(s.actualMin, 'minute');
  if (!blocks.length)
    lines.push(`${minutes} — your first focus block. Everything from here is measured against it.`);
  else if (s.actualMin > longest) lines.push(`${minutes} — your longest block yet.`);
  else lines.push(`${minutes} of focused work.`);

  const todays = blocks.filter((e) => e.date === s.date);
  if (todays.length)
    lines.push(
      `That makes ${formatMinutes(sum(todays.map((e) => e.actualMin)) + s.actualMin)} across ${todays.length + 1} blocks today.`,
    );
  const w = s.wanders ?? 0;
  if (w > 0)
    lines.push(
      `${plural(w, 'wander')} noticed and brought back — that noticing is the skill you are training.`,
    );
  if (s.quality != null && s.quality >= 4)
    lines.push('A deep block. Note what helped (time of day, task, place) and repeat it.');
  else if (s.quality != null && s.quality <= 2)
    lines.push('Scattered blocks happen. Next time try a sharper intention or a shorter block.');
  return lines;
}

export function attentionFeedback(s: FocusSession, earlier: FocusSession[]): string[] {
  const sessions = earlier.filter((e) => e.kind === 'attention');
  const reps = s.wanders ?? 0;
  const total = sum(sessions.map((e) => e.wanders ?? 0)) + reps;
  const lines = [
    sessions.length
      ? `${plural(reps, 'rep')} in ${s.actualMin} min. Session ${sessions.length + 1} — ${plural(total, 'rep')} in total.`
      : `First session: ${plural(reps, 'rep')}. Lots of wandering early on is normal — each return is the training.`,
  ];
  if (s.actualMin < s.plannedMin)
    lines.push('Stopped early — it still counts. Next time, try to stay for the full time.');
  return lines;
}

export function drillFeedback(entry: DrillEntry, earlier: DrillEntry[]): string[] {
  const score = avgOf(entry.selfScores);
  if (score == null) return [];
  const prev = earlier
    .filter((d) => d.type !== 'calibration' && Object.keys(d.selfScores).length)
    .sort(byDate);
  const lines: string[] = [];
  if (!prev.length)
    lines.push(
      `First drill done — your starting point is ${round(score, 1)}/5. Get Claude’s second opinion below: the gap between your score and Claude’s is worth knowing.`,
    );
  else if (prev.length >= 3) {
    const base = mean(prev.slice(0, 3).map((d) => avgOf(d.selfScores)!))!;
    lines.push(
      `You scored ${round(score, 1)}/5 — your first three drills averaged ${round(base, 1)}/5.`,
    );
  } else lines.push(`You scored ${round(score, 1)}/5.`);

  const entries = Object.entries(entry.selfScores);
  const [weakest, low] = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (entries.some(([, v]) => v !== low))
    lines.push(
      `Weakest today: ${weakest} (${low}/5). Make that the one thing to improve next time.`,
    );
  return lines;
}

export const CALM_PACE = { min: 120, max: 160 };

export function talkFeedback(entry: TalkEntry, earlier: TalkEntry[]): string[] {
  const lines: string[] = [];
  if (!earlier.length)
    lines.push(
      'First talk recorded. Listening back once is the most useful part — and the most uncomfortable.',
    );
  if (entry.durationSec >= 10) {
    const fpm = entry.fillers / (entry.durationSec / 60);
    const prev = earlier
      .filter((t) => t.durationSec >= 10)
      .map((t) => t.fillers / (t.durationSec / 60));
    const before = mean(prev);
    if (before == null)
      lines.push(`${round(fpm, 1)} fillers per minute. The trend matters more than any one talk.`);
    else {
      const trend = compare(fpm, before);
      lines.push(
        `${round(fpm, 1)} fillers per minute — ${
          trend === 'down' ? 'down from' : trend === 'up' ? 'up from' : 'about the same as'
        } your earlier average of ${round(before, 1)}.`,
      );
    }
  }
  if (entry.wpm != null) {
    const { min, max } = CALM_PACE;
    lines.push(
      entry.wpm > max + 10
        ? `Pace ${entry.wpm} wpm — a little fast. Aim for about ${min}–${max}.`
        : entry.wpm < min - 20
          ? `Pace ${entry.wpm} wpm — on the slow side. Aim for about ${min}–${max}.`
          : `Pace ${entry.wpm} wpm — a calm, conversational speed.`,
    );
  }
  return lines;
}

export function journalFeedback(o: {
  count: number;
  ifThen: boolean;
  daysThisWeek: number;
}): string[] {
  const lines = [`Reflection ${o.count} saved.`];
  if (o.ifThen) lines.push('I’ll show you your if-then plan tomorrow morning.');
  if (o.daysThisWeek >= 2) lines.push(`You’ve reflected on ${o.daysThisWeek} of the last 7 days.`);
  return lines;
}

// --- The weekly note ------------------------------------------------------------------------

export interface WeeklyNote {
  headline: string;
  wins: string[];
  watch: string[];
  change: string;
}

/** A mentor's read of the week: what went well, what to watch, and the one change that matters. */
export function weeklyNote(cur: WeekMetrics, prev: WeekMetrics | null): WeeklyNote {
  const wins: string[] = [];
  const watch: string[] = [];
  const habit = cur.habitPct;
  const logged =
    (habit ?? 0) > 0 || cur.focusMinutes > 0 || cur.avgSleep != null || cur.avgStress != null;
  if (!logged)
    return {
      headline: 'Not enough data yet this week.',
      wins: [],
      watch: [],
      change:
        'Start with the morning check-in and one focus block a day. That’s enough for a useful note next week.',
    };

  if (habit != null && habit >= 80)
    wins.push(`You completed ${habit}% of your plan — right in the ~80% sweet spot.`);
  if (prev && cur.focusMinutes > 0 && cur.focusMinutes > prev.focusMinutes * 1.1)
    wins.push(
      `Deep focus up: ${formatMinutes(cur.focusMinutes)} vs ${formatMinutes(prev.focusMinutes)} last week.`,
    );
  else if (!prev && cur.focusMinutes >= 60)
    wins.push(`${formatMinutes(cur.focusMinutes)} of deep focus logged.`);
  if (cur.avgSleep != null && cur.avgSleep >= 7)
    wins.push(`Sleep averaged ${cur.avgSleep} h — that is what consolidates practice.`);
  if (cur.exerciseDays >= 4) wins.push(`Exercise on ${cur.exerciseDays} days.`);
  if (prev?.avgStress != null && cur.avgStress != null && cur.avgStress <= prev.avgStress - 0.5)
    wins.push(`Stress eased from ${prev.avgStress} to ${cur.avgStress}.`);
  if (cur.attentionSessions >= 5) wins.push(`${cur.attentionSessions} attention sessions.`);

  const stressed = cur.avgStress != null && cur.avgStress >= 7;
  const lowHabit = habit != null && habit < 60;
  const lowSleep = cur.avgSleep != null && cur.avgSleep < 6.5;
  const lowExercise = cur.exerciseDays <= 1;
  const focusDrop =
    !!prev && prev.focusMinutes >= 60 && cur.focusMinutes < prev.focusMinutes * 0.75;
  if (lowHabit)
    watch.push(
      `Plan completion was ${habit}%. That means the plan is too big right now — not that you are weak.`,
    );
  if (lowSleep) watch.push(`Sleep averaged ${cur.avgSleep} h.`);
  if (stressed) watch.push(`Stress averaged ${cur.avgStress}/10.`);
  if (focusDrop)
    watch.push(
      `Deep focus fell to ${formatMinutes(cur.focusMinutes)} from ${formatMinutes(prev!.focusMinutes)}.`,
    );
  if (lowExercise) watch.push(`Exercise on ${plural(cur.exerciseDays, 'day')} only.`);

  const change = stressed
    ? 'Take a lighter week: choose a Light day at each check-in, protect sleep, and talk to someone you trust.'
    : lowHabit
      ? 'Shrink the plan: next week aim only for attention training, one focus block and the journal. Grow back once you hit 80%.'
      : lowSleep
        ? 'Fix one sleep lever: screens off 60 minutes before a fixed bedtime, and no caffeine after 2 pm.'
        : lowExercise
          ? 'Book exercise like an exam slot: same time, four days, 30 minutes.'
          : focusDrop
            ? 'Put your first focus block at the same time every morning, before anything else.'
            : habit != null && habit >= 80 && cur.focusMinutes > 0
              ? 'You’re ready to stretch: lengthen one focus block by 10–15 minutes, or take on a harder drill.'
              : 'Keep the same plan for another week — consistency beats intensity.';

  const headline =
    habit != null && habit < 40
      ? 'A hard week. You’re still here, and that counts. Let’s make next week smaller.'
      : !watch.length && wins.length >= 2
        ? 'A strong week.'
        : wins.length >= watch.length
          ? 'A solid week, with one thing to adjust.'
          : 'A mixed week — here is the one change that matters.';
  return { headline, wins, watch, change };
}
