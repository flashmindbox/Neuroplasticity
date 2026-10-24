import { describe, expect, it } from 'vitest';
import { phaseFor, type ExamDates } from '../../src/content/roadmap';
import type { DailyLog, DrillEntry, FocusSession, TalkEntry } from '../../src/lib/db';
import { addDays, rangeKeys } from '../../src/lib/dates';
import {
  attentionFeedback,
  compare,
  dayItems,
  drillFeedback,
  focusBlockFeedback,
  formatMinutes,
  greeting,
  journalFeedback,
  mentorNote,
  milestones,
  modeOf,
  nearestChoice,
  nextMilestone,
  nextStep,
  planExplanation,
  progressHighlights,
  STRESS_CHOICES,
  suggestPlan,
  talkFeedback,
  ticksFor,
  topHighlights,
  weeklyNote,
  weeklyTicksFor,
  type ProgressInput,
  type Step,
} from '../../src/lib/mentor';
import type { WeekMetrics } from '../../src/lib/metrics';
import { completionRatio, dayStatus } from '../../src/lib/streak';

const dates: ExamDates = {
  programmeStart: '2026-10-01',
  prelims: '2027-05-23',
  mains: '2027-08-20',
  interview: '2028-02-01',
};
// A Monday in the Build phase: drill and talk are both on the plan.
const monday = '2026-11-02';
const state = phaseFor(monday, dates);

const good = { sleepHours: 7.5, energy: 8, stress: 4, mood: 8 };

describe('check-in sizes the day', () => {
  it('keeps the full plan when you are fine', () => {
    expect(suggestPlan(good)).toEqual({ mode: 'full', reasons: [] });
    expect(planExplanation(suggestPlan(good))).toMatch(/full plan/);
  });

  it('suggests a light day for one or two warning signs, with the reasons', () => {
    const s = suggestPlan({ ...good, sleepHours: 5.5, stress: 8 });
    expect(s.mode).toBe('light');
    expect(s.reasons).toEqual(['you slept under 6 hours', 'stress is high']);
    expect(planExplanation(s)).toBe(
      'Light day, because you slept under 6 hours and stress is high. Shorter attention practice; no drill or talk. It still counts.',
    );
  });

  it('suggests a minimum day on a really hard day, and says where support is', () => {
    const hard = suggestPlan({ sleepHours: 4.5, energy: 2, stress: 10, mood: 2 });
    expect(hard.mode).toBe('minimum');
    expect(planExplanation(hard)).toMatch(/14416/);
    expect(suggestPlan({ ...good, stress: 10, energy: 4 }).mode).toBe('minimum');
    expect(planExplanation(suggestPlan({ ...good, sleepHours: 4.5, energy: 4 }))).not.toMatch(
      /14416/,
    );
  });

  it('restarts small after two missed days', () => {
    const s = suggestPlan(good, { doubleMiss: true });
    expect(s.mode).toBe('minimum');
    expect(s.reasons[0]).toMatch(/two missed days/);
  });

  it('maps stored values to the nearest tappable answer', () => {
    expect(nearestChoice(STRESS_CHOICES, 7.4)).toBe(8);
    expect(nearestChoice(STRESS_CHOICES, 1)).toBe(2);
    expect(nearestChoice(STRESS_CHOICES, undefined)).toBeUndefined();
  });
});

describe('today’s items by mode', () => {
  it('drops the drill and talk and halves attention on a light day', () => {
    const full = dayItems(monday, state, 'full').map((i) => i.id);
    expect(full).toContain('drill');
    expect(full).toContain('talk');
    const light = dayItems(monday, state, 'light');
    expect(light.map((i) => i.id)).not.toContain('drill');
    expect(light.map((i) => i.id)).not.toContain('talk');
    const fullAttention = dayItems(monday, state, 'full').find((i) => i.id === 'attention')!;
    const lightAttention = light.find((i) => i.id === 'attention')!;
    expect(lightAttention.minutes).toBe(Math.max(5, Math.round(fullAttention.minutes / 2)));
    expect(lightAttention.title).toBe(`Attention training · ${lightAttention.minutes} min`);
  });

  it('uses the three minimum-day items', () => {
    expect(dayItems(monday, state, 'minimum').map((i) => i.id)).toEqual([
      'mvd-breath',
      'mvd-journal',
      'mvd-target',
    ]);
  });

  it('counts a light day against its smaller plan', () => {
    const planned = dayItems(monday, state, 'full').map((i) => i.id);
    const done = planned.filter((id) => id !== 'drill' && id !== 'talk');
    const half = done.slice(0, Math.ceil(done.length / 2));
    const log: DailyLog = {
      date: monday,
      mvd: false,
      light: true,
      checks: Object.fromEntries(half.map((id) => [id, true])),
    };
    expect(dayStatus(log, planned)).toBe('done');
    expect(completionRatio(log, planned)).toBeCloseTo(half.length / done.length);
    expect(dayStatus({ ...log, light: false }, planned)).toBe(
      half.length / planned.length >= 0.5 ? 'done' : 'missed',
    );
  });
});

describe('next step', () => {
  const items = dayItems(monday, state, 'full');
  const logWith = (checks: string[], over: Partial<DailyLog> = {}): DailyLog => ({
    date: monday,
    mvd: false,
    checkedIn: true,
    checks: Object.fromEntries(checks.map((c) => [c, true])),
    ...over,
  });
  const step = (log: DailyLog | undefined, hour = 9, targets: Step['id'][] = []) =>
    nextStep({ hour, items, targets: targets as never[], log });

  it('starts with the check-in', () => {
    expect(step(undefined)).toMatchObject({ kind: 'checkin', title: 'Morning check-in' });
    expect(step(logWith([], { checkedIn: false }), 15)).toMatchObject({
      kind: 'checkin',
      title: 'Quick check-in',
    });
  });

  it('walks through the morning briefing and practice in order', () => {
    expect(step(logWith([])).kind).toBe('briefing');
    expect(step(logWith(['vision', 'ifthen'])).id).toBe('attention');
    expect(step(logWith(['vision', 'ifthen', 'attention'])).id).toBe('blocks');
    expect(step(logWith(['vision', 'ifthen', 'attention', 'blocks'])).id).toBe('drill');
    expect(step(logWith(['vision', 'ifthen', 'attention', 'blocks', 'drill'])).id).toBe('talk');
  });

  it('respects “not today” and a skipped briefing', () => {
    const log = logWith([], { skipped: { briefing: true, attention: true } });
    expect(step(log).id).toBe('blocks');
  });

  it('offers active targets after the core practice', () => {
    const log = logWith(['vision', 'ifthen', 'attention', 'blocks', 'drill', 'talk']);
    const s = step(log, 10, ['resilience']);
    expect(s.id).toBe('target-resilience');
    expect(s.route).toBe('/journal');
  });

  it('sends you to study during the day, then to the journal and close-out in the evening', () => {
    const practised = ['vision', 'ifthen', 'attention', 'blocks', 'drill', 'talk'];
    expect(step(logWith(practised), 11).kind).toBe('study');
    expect(step(logWith(practised), 18).id).toBe('journal');
    expect(step(logWith([...practised, 'journal']), 18).kind).toBe('close');
    expect(step(logWith([...practised, 'journal'], { closed: true }), 18).kind).toBe('done');
  });

  it('skips the morning briefing in the evening', () => {
    expect(step(logWith([]), 18).id).toBe('attention');
  });

  it('lets the rest go late in the evening', () => {
    const s = step(logWith(['vision', 'ifthen']), 21);
    expect(s.id).toBe('journal');
  });

  it('runs the minimum day as three tiny steps', () => {
    const mvd = dayItems(monday, state, 'minimum');
    const log = (checks: string[], over: Partial<DailyLog> = {}) =>
      nextStep({ hour: 9, items: mvd, targets: [], log: logWith(checks, { mvd: true, ...over }) });
    expect(log([]).id).toBe('mvd-breath');
    expect(log(['mvd-breath']).id).toBe('mvd-target');
    expect(log(['mvd-breath', 'mvd-target']).id).toBe('mvd-journal');
    expect(log(['mvd-breath', 'mvd-target', 'mvd-journal']).kind).toBe('close');
    expect(log(['mvd-breath', 'mvd-target', 'mvd-journal'], { closed: true }).kind).toBe('done');
  });

  it('reads the mode from the log', () => {
    expect(modeOf(undefined)).toBe('full');
    expect(modeOf(logWith([], { light: true }))).toBe('light');
    expect(modeOf(logWith([], { light: true, mvd: true }))).toBe('minimum');
  });
});

describe('activities tick the plan for you', () => {
  it('maps activities to checklist items and targets', () => {
    expect(ticksFor('focus')).toEqual(['blocks', 'mvd-target', 'target-focus']);
    expect(ticksFor('drill:structure')).toEqual(['drill', 'mvd-target', 'target-expression']);
    expect(ticksFor('drill:unknown')).toEqual(['drill', 'mvd-target']);
    expect(ticksFor('journal')).toContain('mvd-journal');
    expect(ticksFor('close')).toEqual(['quicklog']);
    expect(ticksFor('brain')).toEqual([]);
  });

  it('ticks weekly items too', () => {
    expect(weeklyTicksFor('drill:dilemma')).toEqual(['dilemma']);
    expect(weeklyTicksFor('drill:lenses')).toEqual([]);
    expect(weeklyTicksFor('review')).toEqual(['review']);
  });
});

describe('what the mentor says', () => {
  const note = (over: Partial<Parameters<typeof mentorNote>[0]> = {}) =>
    mentorNote({
      today: monday,
      dayNumber: 33,
      chainLength: 3,
      doubleMissNow: false,
      missedYesterday: false,
      state,
      step: { kind: 'task', id: 'attention', title: '', why: '' },
      ...over,
    });

  it('greets by time of day and first name', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(14, 'Asha Rao')).toBe('Good afternoon, Asha');
    expect(greeting(19, '  ')).toBe('Good evening');
  });

  it('prioritises what matters most today', () => {
    expect(note({ dayNumber: 1 })).toMatch(/day 1/);
    expect(note({ doubleMissNow: true, missedYesterday: true })).toMatch(/restart small/);
    expect(note({ missedYesterday: true })).toMatch(/not to make it two/);
    expect(note({ reviewDue: true })).toMatch(/Sunday review/);
    expect(note({ step: { kind: 'done', id: 'done', title: '', why: '' } })).toMatch(/Rest well/);
    expect(note({ chainLength: 30 })).toMatch(/^30 days of showing up/);
    expect(note()).toBeTruthy();
  });
});

const session = (
  date: string,
  kind: FocusSession['kind'],
  actualMin: number,
  wanders = 0,
): FocusSession => ({ date, kind, plannedMin: actualMin, actualMin, wanders });

const progressInput = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  today: '2026-10-31',
  programmeStart: '2026-10-01',
  logs: [],
  sessions: [],
  drills: [],
  talks: [],
  brainChecks: [],
  statusOf: () => 'missed',
  ...over,
});

describe('visible progress', () => {
  it('starts with everything locked, each with a way to unlock it', () => {
    const { ready, locked } = progressHighlights(
      progressInput({ today: '2026-10-01', programmeStart: '2026-10-01' }),
    );
    expect(ready).toEqual([]);
    expect(locked.map((l) => l.id)).toContain('focus');
    for (const l of locked) expect(l.unlock.length).toBeGreaterThan(10);
  });

  it('compares deep focus with your first week', () => {
    const sessions = [
      session('2026-10-05', 'focus', 25),
      session('2026-10-06', 'focus', 25),
      session('2026-10-28', 'focus', 50),
      session('2026-10-30', 'focus', 50),
    ];
    const focus = progressHighlights(progressInput({ sessions })).ready.find(
      (h) => h.id === 'focus',
    )!;
    expect(focus.value).toBe('1 h 40 min this week');
    expect(focus.detail).toBe('Up from 50 min in your first week.');
    expect(focus).toMatchObject({ trend: 'up', good: true });
  });

  it('shows falling fillers as good news', () => {
    const talk = (date: string, fillers: number): TalkEntry => ({
      date,
      prompt: '',
      durationSec: 120,
      transcript: '',
      wpm: 140,
      fillers,
      selfScores: {},
    });
    const talks = [
      talk('2026-10-02', 20),
      talk('2026-10-04', 18),
      talk('2026-10-20', 8),
      talk('2026-10-28', 6),
    ];
    const s = progressHighlights(progressInput({ talks })).ready.find((h) => h.id === 'speaking')!;
    expect(s.value).toBe('5.3 fillers/min');
    expect(s).toMatchObject({ trend: 'down', good: true });
  });

  it('counts the days you showed up', () => {
    const done = new Set(rangeKeys('2026-10-20', '2026-10-30'));
    const h = progressHighlights(
      progressInput({ statusOf: (d) => (done.has(d) ? 'done' : 'missed') }),
    ).ready.find((x) => x.id === 'showing-up')!;
    // Today (31st) is unfinished, so the window is the 13 days before it.
    expect(h.value).toBe('11 of 13 days');
    expect(h.good).toBe(true);
  });

  it('averages sleep from the check-ins', () => {
    const logs: DailyLog[] = ['2026-10-29', '2026-10-30', '2026-10-31'].map((date) => ({
      date,
      checks: {},
      mvd: false,
      sleepHours: 7.5,
    }));
    const sleep = progressHighlights(progressInput({ logs })).ready.find((h) => h.id === 'sleep')!;
    expect(sleep).toMatchObject({ value: '7.5 h', good: true });
  });

  it('tracks cumulative milestones and the next one to aim for', () => {
    const sessions = [
      session('2026-10-02', 'focus', 55, 10),
      session('2026-10-03', 'attention', 10, 40),
    ];
    const ms = milestones({ ...progressInput({ sessions }), weeklyReviews: 1 });
    expect(ms.find((m) => m.id === 'first-block')!.done).toBe(true);
    expect(ms.find((m) => m.id === 'block-50')!.done).toBe(true);
    expect(ms.find((m) => m.id === 'reps-100')!.current).toBe(50);
    // Closest to done: a 55-minute block is 61% of the way to 90 minutes.
    expect(nextMilestone(ms)!.id).toBe('block-90');
  });

  it('puts consistency and real comparisons first on Today', () => {
    const h = (id: string, trend: 'up' | null) => ({
      id,
      label: id,
      value: '',
      detail: '',
      trend,
      good: null,
    });
    const top = topHighlights(
      [h('reps', null), h('focus', 'up'), h('showing-up', null), h('sleep', 'up')],
      3,
    );
    expect(top.map((x) => x.id)).toEqual(['showing-up', 'focus', 'sleep']);
  });

  it('formats minutes and compares with a tolerance', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(135)).toBe('2 h 15 min');
    expect(compare(105, 100)).toBe('flat');
    expect(compare(120, 100)).toBe('up');
    expect(compare(3, 0)).toBe('up');
  });
});

describe('feedback after an activity', () => {
  it('celebrates a first and a longest focus block', () => {
    const s = { ...session(monday, 'focus', 30, 3), quality: 4 };
    expect(focusBlockFeedback(s, [])[0]).toMatch(/first focus block/);
    expect(focusBlockFeedback(session(monday, 'focus', 1), [])[0]).toMatch(/^1 minute — /);
    const lines = focusBlockFeedback(s, [session(monday, 'focus', 25)]);
    expect(lines[0]).toBe('30 minutes — your longest block yet.');
    expect(lines[1]).toBe('That makes 55 min across 2 blocks today.');
    expect(lines[2]).toMatch(/^3 wanders noticed/);
    expect(lines[3]).toMatch(/deep block/);
  });

  it('counts attention reps', () => {
    const s = { ...session(monday, 'attention', 8, 12), plannedMin: 10 };
    const lines = attentionFeedback(s, [session('2026-11-01', 'attention', 10, 20)]);
    expect(lines[0]).toBe('12 reps in 8 min. Session 2 — 32 reps in total.');
    expect(lines[1]).toMatch(/Stopped early/);
  });

  it('compares a drill with your first ones and names the weakest criterion', () => {
    const drill = (selfScores: Record<string, number>): DrillEntry => ({
      date: monday,
      type: 'lenses',
      prompt: '',
      response: '',
      durationSec: 90,
      selfScores,
    });
    const earlier = [drill({ a: 2, b: 2 }), drill({ a: 2, b: 3 }), drill({ a: 3, b: 3 })];
    const lines = drillFeedback(drill({ Breadth: 4, Depth: 2 }), earlier);
    expect(lines[0]).toBe('You scored 3/5 — your first three drills averaged 2.5/5.');
    expect(lines[1]).toBe(
      'Weakest today: Depth (2/5). Make that the one thing to improve next time.',
    );
    expect(drillFeedback(drill({ a: 3 }), [])[0]).toMatch(/starting point is 3\/5/);
  });

  it('reports fillers and pace for a talk', () => {
    const talk = (fillers: number, wpm: number): TalkEntry => ({
      date: monday,
      prompt: '',
      durationSec: 120,
      transcript: '',
      wpm,
      fillers,
      selfScores: {},
    });
    const lines = talkFeedback(talk(4, 185), [talk(12, 150)]);
    expect(lines[0]).toBe('2 fillers per minute — down from your earlier average of 6.');
    expect(lines[1]).toMatch(/a little fast/);
  });

  it('confirms a reflection', () => {
    expect(journalFeedback({ count: 3, ifThen: true, daysThisWeek: 3 })).toEqual([
      'Reflection 3 saved.',
      'I’ll show you your if-then plan tomorrow morning.',
      'You’ve reflected on 3 of the last 7 days.',
    ]);
  });
});

describe('weekly note', () => {
  const week = (over: Partial<WeekMetrics> = {}): WeekMetrics => ({
    habitPct: 85,
    focusMinutes: 300,
    attentionSessions: 6,
    avgSleep: 7.2,
    exerciseDays: 4,
    avgStress: 4,
    avgClarity: 7,
    mocks: 0,
    ...over,
  });

  it('says so when there is nothing to read yet', () => {
    const n = weeklyNote(
      week({ habitPct: 0, focusMinutes: 0, avgSleep: null, avgStress: null }),
      null,
    );
    expect(n.headline).toMatch(/Not enough data/);
  });

  it('recognises a strong week and suggests a stretch', () => {
    const n = weeklyNote(week(), week({ focusMinutes: 200 }));
    expect(n.headline).toBe('A strong week.');
    expect(n.wins[0]).toMatch(/85%/);
    expect(n.wins).toContain('Deep focus up: 5 h vs 3 h 20 min last week.');
    expect(n.change).toMatch(/ready to stretch/);
  });

  it('puts stress first when it is high', () => {
    const n = weeklyNote(week({ avgStress: 7.5, habitPct: 50 }), week());
    expect(n.watch.some((w) => w.includes('Stress averaged 7.5'))).toBe(true);
    expect(n.change).toMatch(/lighter week/);
  });

  it('shrinks the plan when completion is low', () => {
    const n = weeklyNote(week({ habitPct: 35, focusMinutes: 40 }), week());
    expect(n.headline).toMatch(/A hard week/);
    expect(n.change).toMatch(/Shrink the plan/);
  });

  it('flags a drop in deep focus', () => {
    const n = weeklyNote(week({ focusMinutes: 100 }), week({ focusMinutes: 300 }));
    expect(n.watch).toContain('Deep focus fell to 1 h 40 min from 5 h.');
    expect(n.change).toMatch(/same time every morning/);
  });
});

it('keeps date helpers consistent for the fixtures', () => {
  expect(addDays(monday, -1)).toBe('2026-11-01');
});
