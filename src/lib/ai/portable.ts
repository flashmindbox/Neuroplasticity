// Copy-and-paste bridge for using your Claude subscription (Claude Code in a terminal, claude.ai or
// the Claude app) instead of an API key. The app builds a self-contained prompt; you paste Claude's
// reply back and it is validated here. Same instructions and schemas as the API path.
import { z } from 'zod';
import type { AiEvaluation, InterviewDebrief, InterviewMessage } from '../db';
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
