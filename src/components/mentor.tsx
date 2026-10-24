import { Link } from 'react-router-dom';
import type { Choice, Highlight, Locked, Milestone } from '../lib/mentor';

export function MentorAvatar({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="./icon.svg"
      alt=""
      className={`${className} shrink-0 rounded-full bg-white p-1 ring-1 ring-brand-200`}
    />
  );
}

/** What the mentor says right after you finish something, with the way back to Today. */
export function MentorFeedback({ lines, back = true }: { lines: string[]; back?: boolean }) {
  if (!lines.length) return null;
  return (
    <div
      role="status"
      className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-50"
    >
      <MentorAvatar />
      <div className="min-w-0 space-y-1">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {back && (
          <Link
            to="/"
            className="inline-block pt-1 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-200"
          >
            Back to Today — see your next step →
          </Link>
        )}
      </div>
    </div>
  );
}

/** One question answered with a single tap. */
export function ChoiceRow({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice[];
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            role="radio"
            aria-checked={value === c.value}
            onClick={() => onChange(c.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              value === c.value
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

const TREND_MARK = { up: '▲', down: '▼', flat: '■' } as const;

export function HighlightRow({ h }: { h: Highlight }) {
  const tone =
    h.good === true
      ? 'text-emerald-700 dark:text-emerald-400'
      : h.good === false
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-slate-500 dark:text-slate-400';
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="muted text-xs">{h.label}</div>
        <div className="font-semibold tabular-nums">{h.value}</div>
        <div className="muted text-xs">{h.detail}</div>
      </div>
      {(h.trend || h.good !== null) && (
        <span
          className={`shrink-0 text-sm ${tone}`}
          aria-label={h.good === true ? 'good' : h.good === false ? 'needs attention' : 'neutral'}
        >
          {h.trend ? TREND_MARK[h.trend] : '●'}
        </span>
      )}
    </li>
  );
}

export function LockedRow({ l }: { l: Locked }) {
  return (
    <li className="space-y-1.5 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{l.label}</span>
        {l.route && (
          <Link
            to={l.route}
            className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-200"
          >
            Start →
          </Link>
        )}
      </div>
      <p className="muted text-xs">{l.unlock}</p>
      {l.progress > 0 && <ProgressBar value={l.progress} label={`${l.label} unlock progress`} />}
    </li>
  );
}

export function MilestoneRow({ m, label }: { m: Milestone; label?: string }) {
  const shown = m.unit === 'h' ? m.current.toFixed(1) : Math.min(m.current, m.target);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          {label && <span className="muted text-xs">{label}: </span>}
          <span className="font-medium">{m.title}</span>
        </span>
        <span className="muted shrink-0 text-xs tabular-nums">
          {m.done ? 'reached ✓' : `${shown} / ${m.target} ${m.unit}`}
        </span>
      </div>
      <ProgressBar value={m.current / m.target} label={m.title} />
    </div>
  );
}
