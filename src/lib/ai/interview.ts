// AI mock Personality Test board. The conversation is append-only and assistant turns are
// replayed exactly as returned (thinking blocks included), so earlier turns are never edited.
import type Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlockParam,
  BetaMessageParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { InterviewDebrief, InterviewMessage } from '../db';
import type { InterviewProfile } from '../settings';
import { AiError, assertUsable, FALLBACK_BETA, MODEL, recordUsage, toAiError } from './client';

export const BOARD_CRITERIA = [
  'Mental alertness',
  'Critical powers of assimilation',
  'Clear and logical exposition',
  'Balance of judgement',
  'Variety and depth of interest',
  'Social cohesion and leadership',
  'Intellectual and moral integrity',
];

export const OPENING_MESSAGE = 'Good morning. I am ready to begin the interview.';

export function boardSystemPrompt(p: InterviewProfile): string {
  const field = (label: string, v: string) => (v.trim() ? `- ${label}: ${v.trim()}` : null);
  const profile = [
    field('Name', p.name),
    field('Home state / district', p.homeState),
    field('Education', p.education),
    field('Work experience', p.work),
    field('Hobbies and interests', p.hobbies),
    field('Service preferences', p.servicePreference),
    field('Optional subject', p.optional),
  ]
    .filter(Boolean)
    .join('\n');

  return `You are simulating a UPSC Civil Services Personality Test board: a Chairperson and four members, for practice. The candidate is preparing for the Civil Services Examination.

The board assesses: ${BOARD_CRITERIA.join(', ')}.

Candidate's profile (as in a Detailed Application Form):
${profile || '- (not provided — ask the candidate to introduce themselves)'}

How to conduct the interview:
- Ask exactly one question per turn, prefixed by who is asking (e.g., "Chairperson:", "Member 2:").
- Begin with a short welcome and an opening question from the profile.
- Mix profile-based questions (home state, education, hobbies, optional subject, work) with current affairs, governance, ethics and situational questions. Follow up on the candidate's answers; probe inconsistencies politely; occasionally ask for an opinion on a contested issue to test balance.
- Keep questions concise, as a real board would. Be courteous and neutral: do not praise, coach or give feedback during the interview.
- After about 15 questions, the Chairperson thanks the candidate and ends the interview with the words "Thank you, that will be all."
- Do not invent facts about the candidate beyond the profile and their answers.`;
}

export type StreamClient = Pick<Anthropic, 'beta'>;

/** Builds the API history: the synthetic opening, then each turn exactly as stored. */
export function toApiMessages(messages: InterviewMessage[]): BetaMessageParam[] {
  return messages.map((m) =>
    m.role === 'assistant' && m.raw
      ? { role: 'assistant', content: m.raw as BetaContentBlockParam[] }
      : { role: m.role, content: m.content },
  );
}

export interface TurnResult {
  text: string;
  raw: unknown[];
}

export async function boardTurn(
  client: StreamClient,
  system: string,
  messages: InterviewMessage[],
  onText: (delta: string) => void,
): Promise<TurnResult> {
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system,
      messages: toApiMessages(messages),
    });
    stream.on('text', onText);
    const final = await stream.finalMessage();
    await recordUsage('interview-turn', final.usage);
    assertUsable(final.stop_reason);
    const text = final.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
    if (!text) throw new AiError('invalid-output', 'The board did not reply. Try again.');
    return { text, raw: final.content as unknown[] };
  } catch (err) {
    throw toAiError(err);
  }
}

export const INTERVIEW_ENDED = /that will be all/i;

const DebriefSchema = z.object({
  scores: z
    .array(
      z.object({
        criterion: z.string().describe('Exactly one of the board criteria'),
        score: z.number().describe('Integer from 1 to 5'),
      }),
    )
    .describe('One entry per board criterion'),
  strengths: z.array(z.string()).describe('2–3 specific strengths, citing answers'),
  improvements: z.array(z.string()).describe('2–3 specific, actionable improvements'),
  summary: z.string().describe('3–4 sentences: overall impression as a board would record it'),
});

const DEBRIEF_SYSTEM = `You are an experienced UPSC Personality Test board member writing a candid practice debrief. Score each criterion 1–5 (1 = poor, 3 = acceptable, 5 = outstanding; most practice interviews deserve 2–4). Base every judgement on specific answers in the transcript. Be honest and constructive; do not inflate.`;

export function transcriptText(messages: InterviewMessage[]): string {
  return messages
    .slice(1) // skip the synthetic opening line
    .map((m) => `${m.role === 'assistant' ? 'BOARD' : 'CANDIDATE'}: ${m.content}`)
    .join('\n\n');
}

export async function boardDebrief(
  client: StreamClient,
  messages: InterviewMessage[],
): Promise<InterviewDebrief> {
  const answers = messages.filter((m, i) => i > 0 && m.role === 'user');
  if (answers.length < 3)
    throw new AiError(
      'bad-request',
      'Answer at least three questions before asking for a debrief.',
    );
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: betaZodOutputFormat(DebriefSchema) },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: DEBRIEF_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Board criteria: ${BOARD_CRITERIA.join('; ')}\n\n<transcript>\n${transcriptText(messages)}\n</transcript>`,
        },
      ],
    });
    await recordUsage('interview-debrief', res.usage);
    assertUsable(res.stop_reason);
    const out = res.parsed_output;
    if (!out) throw new AiError('invalid-output', 'The debrief could not be read. Try again.');
    const scores: Record<string, number> = {};
    for (const c of BOARD_CRITERIA) {
      const hit = out.scores.find((s) => s.criterion.trim().toLowerCase() === c.toLowerCase());
      if (hit) scores[c] = Math.min(5, Math.max(1, Math.round(hit.score)));
    }
    return {
      scores,
      strengths: out.strengths,
      improvements: out.improvements,
      summary: out.summary,
    };
  } catch (err) {
    throw toAiError(err);
  }
}
