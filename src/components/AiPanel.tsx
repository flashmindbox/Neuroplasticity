import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AiError, createClient } from '../lib/ai/client';
import { evaluate, type EvaluationRequest } from '../lib/ai/evaluate';
import type { AiEvaluation } from '../lib/db';
import { setSetting, useSetting } from '../lib/settings';
import { Notice } from './ui';

/** Explicit, opt-in AI second opinion. Nothing is sent until you press the button. */
export function AiPanel({
  build,
  existing,
  selfScores,
  onResult,
}: {
  build: () => EvaluationRequest;
  existing?: AiEvaluation;
  selfScores: Record<string, number>;
  onResult: (ai: AiEvaluation) => Promise<void> | void;
}) {
  const apiKey = useSetting('apiKey');
  const acknowledged = useSetting('aiAcknowledged');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const ai = await evaluate(createClient(apiKey ?? ''), build());
      await onResult(ai);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (existing) return <AiResult ai={existing} selfScores={selfScores} />;

  if (!apiKey)
    return (
      <Notice>
        Want an independent second opinion? Add your Anthropic API key in{' '}
        <Link className="underline" to="/settings">
          Settings
        </Link>
        .
      </Notice>
    );

  return (
    <div className="space-y-2">
      {!acknowledged && (
        <Notice>
          Pressing the button sends this exercise’s prompt and your response (not your journal, not
          your self-scores) to Anthropic’s API using your key. Typical cost: a few US cents.{' '}
          <button className="underline" onClick={() => setSetting('aiAcknowledged', true)}>
            I understand
          </button>
        </Notice>
      )}
      <button
        className="btn-secondary w-full sm:w-auto"
        disabled={busy || !acknowledged}
        onClick={run}
      >
        {busy ? 'Asking Claude…' : '✨ Get AI second opinion'}
      </button>
      {error && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

export function AiResult({
  ai,
  selfScores,
}: {
  ai: AiEvaluation;
  selfScores: Record<string, number>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-950/40">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AI second opinion</h3>
        <span className="chip">Overall {ai.overall}/10</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="muted text-left text-xs">
            <th className="py-1 font-medium">Criterion</th>
            <th className="py-1 text-right font-medium">You</th>
            <th className="py-1 text-right font-medium">AI</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ai.scores).map(([c, s]) => (
            <tr key={c} className="border-t border-violet-100 dark:border-violet-900">
              <td className="py-1">{c}</td>
              <td className="py-1 text-right tabular-nums">{selfScores[c] ?? '–'}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{s}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">
        <strong>Strength:</strong> {ai.strength}
      </p>
      <p className="text-sm">
        <strong>Most important fix:</strong> {ai.fix}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Example of the fix</summary>
        <p className="mt-1 whitespace-pre-wrap">{ai.improved}</p>
      </details>
      <p className="muted text-xs">
        A second opinion, not ground truth. The gap between your scores and these is tracked as a
        self-awareness measure.
      </p>
    </div>
  );
}
