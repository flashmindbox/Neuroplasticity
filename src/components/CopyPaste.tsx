import { useState } from 'react';
import { AiError } from '../lib/ai/client';
import { Notice } from './ui';

/** Copies text to the clipboard; falls back to a selectable box where the clipboard is unavailable. */
export function CopyBox({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      // e.g. opened over plain http on a phone: let the user copy by hand.
      setState('manual');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={copy}>
          {state === 'copied' ? 'Copied ✓' : label}
        </button>
        <button
          className="btn-ghost"
          onClick={() => setState((s) => (s === 'manual' ? 'idle' : 'manual'))}
        >
          {state === 'manual' ? 'Hide text' : 'Show text'}
        </button>
      </div>
      {state === 'manual' && (
        <textarea
          readOnly
          aria-label="Prompt to copy"
          className="input font-mono text-xs"
          rows={8}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}

/** A box for pasting Claude's reply back; `onPaste` validates and saves, throwing AiError on bad input. */
export function PasteBox({
  label,
  button,
  onSubmit,
}: {
  label: string;
  button: string;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setText('');
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'That could not be read.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label">{label}</span>
        <textarea
          className="input font-mono text-xs"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'```json\n{ … }\n```'}
        />
      </label>
      <button
        className="btn-secondary w-full sm:w-auto"
        disabled={busy || !text.trim()}
        onClick={submit}
      >
        {button}
      </button>
      {error && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}
