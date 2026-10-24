// AI second-opinion ratings for drills and recorded talks. The AI never sees your self-scores
// (independent rating), and its scores are stored as an external rating.
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AiEvaluation } from '../db';
import { AiError, assertUsable, FALLBACK_BETA, MODEL, recordUsage, toAiError } from './client';

export const EvaluationSchema = z.object({
  scores: z
    .array(
      z.object({
        criterion: z.string().describe('Exactly one of the rubric criteria names'),
        score: z.number().describe('Integer from 1 to 5'),
        comment: z.string().describe('One sentence of evidence from the response'),
      }),
    )
    .describe('One entry per rubric criterion, in rubric order'),
  strength: z.string().describe('The single most important strength, specific to this response'),
  fix: z.string().describe('The single most important, concrete improvement'),
  improved: z
    .string()
    .describe('A short example (under 150 words) showing the fix applied — not a full rewrite'),
  overall: z.number().describe('Integer from 1 to 10'),
});

export type EvaluationOutput = z.infer<typeof EvaluationSchema>;

export const EVALUATOR_SYSTEM = `You are a strict, fair evaluator in a training programme for a UPSC Civil Services aspirant. The programme trains thinking, judgement, expression and communication — not syllabus recall.

Score each rubric criterion from 1 to 5 using these anchors:
1 = absent; 2 = weak or generic; 3 = adequate; 4 = strong and specific; 5 = topper-grade, rare.
Most early attempts deserve 2–3. Do not inflate scores to encourage — honest scores are the point.

Be specific: refer to what the response actually says. Give one strength, the one fix that would most improve it, and a short example of that fix applied. Do not invent statistics, cases or quotations; if you mention facts, keep to well-established ones. Judge the thinking skill and clarity, not how much syllabus content is packed in.`;

const TALK_NOTE = `This is a speech-recognition transcript of a ~2-minute spoken answer. Ignore transcription errors and missing punctuation. You cannot hear tone or body language — judge content, structure, balance and clarity. For "Pace & fillers", use the measured metrics provided: a comfortable pace is about 120–160 words per minute and fewer than 3 fillers per minute.`;

export interface EvaluationRequest {
  kind: 'drill' | 'talk';
  title: string;
  instructions: string;
  prompt: string;
  response: string;
  rubric: string[];
  metrics?: { wpm: number | null; fillersPerMin: number | null };
}

/** The subset of the SDK client this module uses (lets tests inject a fake). */
export type ParseClient = Pick<Anthropic, 'beta'>;

export function buildUserMessage(r: EvaluationRequest): string {
  const lines = [
    `Exercise: ${r.title}`,
    `Instructions given to the aspirant: ${r.instructions}`,
    `Prompt: ${r.prompt}`,
    `Rubric criteria (in order): ${r.rubric.join('; ')}`,
  ];
  if (r.kind === 'talk') {
    lines.push(TALK_NOTE);
    if (r.metrics)
      lines.push(
        `Measured pace: ${r.metrics.wpm ?? 'unknown'} words/min. Fillers: ${
          r.metrics.fillersPerMin ?? 'unknown'
        } per minute.`,
      );
  }
  lines.push('', '<response>', r.response, '</response>');
  return lines.join('\n');
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function normaliseEvaluation(
  out: EvaluationOutput,
  rubric: string[],
  model: string,
): AiEvaluation {
  const scores: Record<string, number> = {};
  for (const criterion of rubric) {
    const hit = out.scores.find(
      (s) => s.criterion.trim().toLowerCase() === criterion.toLowerCase(),
    );
    if (hit) scores[criterion] = clamp(hit.score, 1, 5);
  }
  if (Object.keys(scores).length === 0)
    throw new AiError('invalid-output', 'The AI response did not match the rubric. Try again.');
  return {
    scores,
    strength: out.strength.trim(),
    fix: out.fix.trim(),
    improved: out.improved.trim(),
    overall: clamp(out.overall, 1, 10),
    model,
    at: new Date().toISOString(),
  };
}

export async function evaluate(client: ParseClient, req: EvaluationRequest): Promise<AiEvaluation> {
  if (!req.response.trim()) throw new AiError('bad-request', 'Write or record a response first.');
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: betaZodOutputFormat(EvaluationSchema) },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: EVALUATOR_SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(req) }],
    });
    await recordUsage(`${req.kind}-evaluation`, res.usage);
    assertUsable(res.stop_reason);
    if (!res.parsed_output)
      throw new AiError('invalid-output', 'The AI response could not be read. Try again.');
    return normaliseEvaluation(res.parsed_output, req.rubric, res.model);
  } catch (err) {
    throw toAiError(err);
  }
}
