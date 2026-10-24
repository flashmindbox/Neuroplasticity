// Phase-aware daily protocol (handbook/02-daily-protocol.md).
import { dayOfWeek, type DateKey } from '../lib/dates';
import type { PhaseId, PhaseState } from './roadmap';

export type Slot = 'morning' | 'study' | 'midday' | 'evening';

export interface ProtocolItem {
  id: string;
  title: string;
  detail: string;
  minutes: number;
  slot: Slot;
  /** In-app route that helps you do it. */
  route?: string;
}

export interface WeeklyItem {
  id: string;
  title: string;
  detail: string;
  route?: string;
}

export const SLOT_LABELS: Record<Slot, string> = {
  morning: 'Morning',
  study: 'During study',
  midday: 'Midday',
  evening: 'Evening',
};

export const MVD_ITEMS: ProtocolItem[] = [
  {
    id: 'mvd-breath',
    title: '1 minute of breathing',
    detail: 'A few slow cyclic sighs.',
    minutes: 1,
    slot: 'morning',
    route: '/focus',
  },
  {
    id: 'mvd-journal',
    title: 'One line in the journal',
    detail: 'One thing you did or felt today.',
    minutes: 1,
    slot: 'evening',
    route: '/journal',
  },
  {
    id: 'mvd-target',
    title: 'Tiny version of your top target',
    detail: 'E.g., a single 10-minute focus block.',
    minutes: 3,
    slot: 'study',
  },
];

export function attentionMinutes(state: PhaseState): number {
  if (state.examWeek) return 5;
  if (state.taper) return 10;
  if (state.phase === 'diagnose') return 10;
  if (state.phase === 'build') return state.phaseWeek <= 2 ? 10 : state.phaseWeek <= 6 ? 15 : 20;
  return 20;
}

export function focusBlockMinutes(state: PhaseState): number {
  if (state.phase === 'diagnose') return 25;
  if (state.phase === 'build') return state.phaseWeek <= 3 ? 25 : state.phaseWeek <= 7 ? 50 : 90;
  return 90;
}

const isTalkDay = (date: DateKey, phase: PhaseId) =>
  phase === 'interview' || [1, 3, 5].includes(dayOfWeek(date));

export function dailyProtocol(date: DateKey, state: PhaseState): ProtocolItem[] {
  const att = attentionMinutes(state);
  const block = focusBlockMinutes(state);
  const light = state.taper || state.examWeek !== null;

  const items: ProtocolItem[] = [
    {
      id: 'wake',
      title: 'Fixed wake time',
      detail: 'Same time every day, aligned to the 9:30 exam slot.',
      minutes: 0,
      slot: 'morning',
    },
    {
      id: 'light',
      title: 'Daylight + movement',
      detail: '5–10 minutes outside soon after waking.',
      minutes: 8,
      slot: 'morning',
    },
    {
      id: 'attention',
      title: `Attention training · ${att} min`,
      detail: 'Notice the wander, return to the breath. Each return is one repetition.',
      minutes: att,
      slot: 'morning',
      route: '/focus',
    },
    {
      id: 'vision',
      title: 'Purpose + process simulation',
      detail: 'Read your purpose; rehearse how today’s hardest task will go.',
      minutes: 2,
      slot: 'morning',
      route: '/charter',
    },
    {
      id: 'ifthen',
      title: 'Today’s if-then plan',
      detail: '“If [obstacle], then I will [action].” Write it in the journal.',
      minutes: 1,
      slot: 'morning',
      route: '/journal',
    },
    {
      id: 'blocks',
      title: `Study blocks with the focus protocol (${block}-min blocks)`,
      detail: 'Intention → phone in another room → tally wanders → one-line review.',
      minutes: 0,
      slot: 'study',
      route: '/focus',
    },
  ];

  if (state.phase !== 'diagnose' && !light) {
    items.push({
      id: 'drill',
      title: 'Thinking drill',
      detail: 'One prompt, one thinking move, timed. Score yourself first.',
      minutes: 15,
      slot: 'midday',
      route: '/drills',
    });
  }

  items.push({
    id: 'exercise',
    title: 'Exercise 30–45 min',
    detail: 'Brisk walk, run, cycle or sport — part of the training, not optional.',
    minutes: 0,
    slot: 'evening',
  });

  if (state.phase !== 'diagnose' && !light && isTalkDay(date, state.phase)) {
    items.push({
      id: 'talk',
      title: 'Recorded 2-minute talk',
      detail: '30 s to plan (PREP), 2 min to speak, then listen back.',
      minutes: 5,
      slot: 'evening',
      route: '/speak',
    });
  }

  items.push(
    {
      id: 'journal',
      title: 'Reflection journal',
      detail: 'One win · one emotion named · one lesson · tomorrow’s if-then.',
      minutes: 10,
      slot: 'evening',
      route: '/journal',
    },
    {
      id: 'quicklog',
      title: 'Quick log',
      detail: 'Sleep, exercise, stress, mood, clarity — under 3 minutes.',
      minutes: 3,
      slot: 'evening',
    },
    {
      id: 'winddown',
      title: 'Screens off before bed',
      detail: '45–60 minutes before your fixed bedtime.',
      minutes: 0,
      slot: 'evening',
    },
  );
  return items;
}

export function weeklyProtocol(state: PhaseState): WeeklyItem[] {
  const items: WeeklyItem[] = [
    {
      id: 'review',
      title: 'Sunday review',
      detail: 'Numbers, what worked, one change, rule check.',
      route: '/review',
    },
    {
      id: 'stretch',
      title: 'Stretch challenge',
      detail: 'Slightly outside your comfort zone and winnable.',
    },
    {
      id: 'service',
      title: 'Service or leadership action',
      detail: 'Real contact with people; log it if it becomes a story.',
      route: '/journal',
    },
    { id: 'walk', title: 'Phone-free long walk', detail: 'Let the week consolidate.' },
    { id: 'brain', title: 'Brain Check', detail: '3-minute objective test.', route: '/tests' },
  ];
  if (state.phase !== 'diagnose') {
    items.push({
      id: 'dilemma',
      title: 'Ethical dilemma',
      detail: 'Stakeholders · options · principles · decision.',
      route: '/drills',
    });
  }
  if (state.phase === 'prelims' || state.phase === 'mains') {
    items.push({
      id: 'mock',
      title: state.phase === 'prelims' ? 'Mock with confidence tags' : '3-hour simulation',
      detail: 'At exam time, with your pre-mock routine. Log it in Mocks.',
      route: '/mocks',
    });
  }
  if (state.phase === 'interview') {
    items.push({
      id: 'board',
      title: 'AI mock board',
      detail: 'Board-style interview from your profile, then the debrief.',
      route: '/interview',
    });
  }
  return items;
}

export interface SetupTask {
  id: string;
  title: string;
  detail: string;
  route?: string;
  /** Programme week by which it should be done. */
  byWeek: number;
}

export const SETUP_TASKS: SetupTask[] = [
  {
    id: 'charter',
    title: 'Write your Personal Charter',
    detail: 'Purpose, values, Plan B, support contacts, 2–3 active targets.',
    route: '/charter',
    byWeek: 1,
  },
  {
    id: 'helpline',
    title: 'Save Tele-MANAS (14416) in your phone',
    detail: 'Free, 24×7, Government of India.',
    byWeek: 1,
  },
  {
    id: 'doctor',
    title: 'Doctor visit + blood tests',
    detail: 'Ask about CBC, ferritin, B12, vitamin D, TSH, HbA1c; mention any snoring.',
    route: '/handbook/modules/L0-brain-clarity.md',
    byWeek: 2,
  },
  {
    id: 'baseline',
    title: 'Baseline tests',
    detail:
      'Brain Check, focus test, PHQ-9/GAD-7, recorded talk, thinking drill, 13-dimension rating.',
    route: '/tests',
    byWeek: 2,
  },
  {
    id: 'fogaudit',
    title: 'Start the 2-week fog audit',
    detail: 'Log clarity morning and afternoon; it is set up as your first experiment.',
    route: '/experiments',
    byWeek: 1,
  },
  {
    id: 'partner',
    title: 'Recruit an accountability partner',
    detail: 'One person, a 15-minute weekly check-in.',
    route: '/handbook/modules/L4-leadership-integrity.md',
    byWeek: 4,
  },
  {
    id: 'counsellor',
    title: 'Identify a counsellor option',
    detail: 'Before you need one: college service, hospital, or a Tele-MANAS referral.',
    route: '/handbook/04-safety-and-wellbeing.md',
    byWeek: 4,
  },
];
