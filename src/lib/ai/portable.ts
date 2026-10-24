// Copy-and-paste bridge for using your Claude subscription (Claude Code in a terminal, claude.ai or
// the Claude app) instead of an API key. The app builds a self-contained prompt; you paste Claude's
// reply back and it is validated here. Same instructions and schemas as the API path.
import { z } from 'zod';
import type { AiEvaluation, InterviewDebrief, InterviewMessage } from '../db';
import type { WeeklyNote } from '../mentor';
import type { WeekMetrics } from '../metrics';
import type { InterviewProfile } from '../settings';
import { AiError } from './client';
import {
  buildUserMessage,
  EVALUATOR_SYSTEM,
  EvaluationSchema,
  normaliseEvaluation,
  type EvaluationRequest,
} from './evaluate';
import {
  BOARD_CRITERIA,
  boardSystemPrompt,
  DEBRIEF_SYSTEM,
  DebriefSchema,
  normaliseDebrief,
  OPENING_MESSAGE,
} from './interview';

export const SUBSCRIPTION_MODEL = 'Claude (subscription)';
export const EVALUATION_HEADER = 'REWIRE · EVALUATION REQUEST v1';
export const BOARD_HEADER = 'REWIRE · MOCK BOARD v1';
export const MENTOR_HEADER = 'REWIRE · MENTOR REVIEW v1';

const SAFETY_LINE =
  'If anything I write suggests I am in crisis or thinking of harming myself, stop the exercise, respond with care, and give me Tele-MANAS: 14416 (India, free, 24×7).';

export function portableEvaluationPrompt(req: EvaluationRequest): string {
  const template = {
    scores: req.rubric.map((criterion) => ({
      criterion,
      score: '<integer 1-5>',
      comment: '<one sentence of evidence>',
    })),
    strength: '<the single most important strength>',
    fix: '<the single most important, concrete improvement>',
    improved: '<a short example (under 150 words) of the fix applied>',
    overall: '<integer 1-10>',
  };
  return [
    EVALUATION_HEADER,
    '',
    'Act as the evaluator described below for my Rewire training exercise.',
    '',
    '<evaluator_instructions>',
    EVALUATOR_SYSTEM,
    '</evaluator_instructions>',
    '',
    buildUserMessage(req),
    '',
    'Reply with ONLY one JSON object inside a ```json code block, with numbers (not strings) for score and overall, in exactly this shape:',
    '```json',
    JSON.stringify(template, null, 2),
    '```',
  ].join('\n');
}

/** Finds the JSON object in a pasted reply (a ```json block, or the outermost {...}). */
export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  let candidate = fence?.[1];
  if (!candidate) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    candidate = start >= 0 && end > start ? text.slice(start, end + 1) : '';
  }
  try {
    return JSON.parse(candidate);
  } catch {
    throw new AiError(
      'invalid-output',
      'Couldn’t find a valid JSON object in what you pasted. Paste Claude’s whole reply, including the ```json block.',
    );
  }
}

/** Accepts "3" as well as 3 for score fields — an easy slip when copying the template. */
function coerceScores(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(coerceScores);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        (k === 'score' || k === 'overall') && typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v)
          ? Number(v)
          : coerceScores(v),
      ]),
    );
  }
  return value;
}

export function parsePortableEvaluation(text: string, rubric: string[]): AiEvaluation {
  const parsed = EvaluationSchema.safeParse(coerceScores(extractJson(text)));
  if (!parsed.success)
    throw new AiError(
      'invalid-output',
      'The pasted reply is missing some fields (scores, strength, fix, improved, overall). Ask Claude to answer again in the exact JSON shape.',
    );
  return normaliseEvaluation(parsed.data, rubric, SUBSCRIPTION_MODEL);
}

export function portableInterviewPrompt(profile: InterviewProfile): string {
  const template = {
    rewire: 'interview-debrief',
    transcript: [
      { role: 'board', text: '<question, prefixed by who asked>' },
      { role: 'candidate', text: '<my answer>' },
    ],
    scores: BOARD_CRITERIA.map((criterion) => ({ criterion, score: '<integer 1-5>' })),
    strengths: ['<2-3 specific strengths, citing answers>'],
    improvements: ['<2-3 specific, actionable improvements>'],
    summary: '<3-4 sentences, as a board would record it>',
  };
  return [
    BOARD_HEADER,
    '',
    'Run a practice interview with me in this chat.',
    '',
    '<board_instructions>',
    boardSystemPrompt(profile),
    '- Ask one question, then wait for my answer before asking the next.',
    `- ${SAFETY_LINE}`,
    '</board_instructions>',
    '',
    '<debrief_instructions>',
    `When the interview ends, or when I type DEBRIEF: ${DEBRIEF_SYSTEM}`,
    'Then reply with ONLY one JSON object inside a ```json code block (numbers, not strings, for score), including the full transcript, in exactly this shape:',
    '```json',
    JSON.stringify(template, null, 2),
    '```',
    '</debrief_instructions>',
    '',
    'Begin the interview now.',
  ].join('\n');
}

const PortableDebriefSchema = DebriefSchema.extend({
  transcript: z
    .array(z.object({ role: z.enum(['board', 'candidate']), text: z.string() }))
    .optional(),
});

export function parsePortableDebrief(text: string): {
  debrief: InterviewDebrief;
  messages: InterviewMessage[];
} {
  const parsed = PortableDebriefSchema.safeParse(coerceScores(extractJson(text)));
  if (!parsed.success)
    throw new AiError(
      'invalid-output',
      'The pasted debrief is missing fields (scores, strengths, improvements, summary). Type DEBRIEF again in Claude and paste the whole reply.',
    );
  const messages: InterviewMessage[] = [
    { role: 'user', content: OPENING_MESSAGE },
    ...(parsed.data.transcript ?? []).map((t) => ({
      role: t.role === 'board' ? ('assistant' as const) : ('user' as const),
      content: t.text,
    })),
  ];
  return { debrief: normaliseDebrief(parsed.data), messages };
}

export interface MentorReviewInput {
  phase: string;
  programmeWeek: number;
  daysToPrelims: number;
  targets: string[];
  /** Oldest first; the last one is the week under review. */
  weeks: { weekStart: string; metrics: WeekMetrics }[];
  review: { worked: string; change: string; lowestSource: string; nextWeek: string };
  note: WeeklyNote;
}

const show = (v: number | null, unit = '') => (v == null ? '–' : `${v}${unit}`);

/**
 * A weekly mentor conversation for your Claude subscription: numbers and your Sunday-review
 * answers only — never the journal. The reply is read in Claude; nothing is pasted back.
 */
export function portableMentorPrompt(i: MentorReviewInput): string {
  return [
    MENTOR_HEADER,
    '',
    'Act as my mentor for Rewire, a neuroplasticity programme I follow alongside my UPSC CSE preparation. Review my week and help me plan the next one.',
    '',
    '<mentor_instructions>',
    '- Warm, direct and specific. Talk to me, not about me. Under 250 words.',
    '- Start with the one thing that is working, citing the number that shows it.',
    '- Name the single biggest bottleneck and why it matters for the exam.',
    '- Give at most 3 actions for next week, each small enough to succeed on ~80% of days, each with when, where and how much.',
    '- Keep to the programme rules: at most 2–3 active targets; never miss twice (a 5-minute minimum day counts); stress at 7/10 or more for a week means a lighter week; behaviour first, feelings follow.',
    '- Do not suggest brain-training games, power posing or other techniques the Rewire handbook excludes. Do not diagnose.',
    `- ${SAFETY_LINE}`,
    '</mentor_instructions>',
    '',
    '<my_week>',
    `Phase: ${i.phase} · programme week ${i.programmeWeek} · ${i.daysToPrelims} days to Prelims`,
    `Active targets: ${i.targets.join(', ') || 'none chosen yet'}`,
    'Weekly numbers (oldest first):',
    ...i.weeks.map(
      ({ weekStart, metrics: m }) =>
        `- Week of ${weekStart}: plan done ${show(m.habitPct, '%')} · deep focus ${m.focusMinutes} min · attention sessions ${m.attentionSessions} · sleep ${show(m.avgSleep, ' h')} · exercise days ${m.exerciseDays} · stress ${show(m.avgStress, '/10')} · clarity ${show(m.avgClarity, '/10')} · mocks ${m.mocks}`,
    ),
    '',
    'My Sunday review:',
    `- What worked: ${i.review.worked.trim() || '(not filled in)'}`,
    `- What I will change: ${i.review.change.trim() || '(not filled in)'}`,
    `- Lowest motivation source: ${i.review.lowestSource || '(not chosen)'}`,
    `- Next week: ${i.review.nextWeek.trim() || '(not filled in)'}`,
    '',
    'The app’s automatic note on this week:',
    `- ${i.note.headline}`,
    ...i.note.wins.map((w) => `- Went well: ${w}`),
    ...i.note.watch.map((w) => `- Watch: ${w}`),
    `- Suggested change: ${i.note.change}`,
    '</my_week>',
    '',
    'Reply in plain text (no JSON). End with one sentence I can read tomorrow morning.',
  ].join('\n');
}
