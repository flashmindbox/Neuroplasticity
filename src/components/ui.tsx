import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Page({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-28 lg:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="muted mt-1">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Card({
  title,
  children,
  className = '',
  aside,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="h2">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            value === t.id
              ? 'bg-brand-700 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Row of numbered buttons, e.g. 1–5 or 1–10. */
export function Scale({
  value,
  onChange,
  min = 1,
  max = 10,
  label,
  lowLabel,
  highLabel,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  lowLabel?: string;
  highLabel?: string;
}) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-9 min-w-9 rounded-lg border text-sm font-medium transition ${
              value === n
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="muted mt-1 flex justify-between text-xs">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="muted mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`input ${props.className ?? ''}`} />;
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'crisis' | 'success';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100',
    warning:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    crisis:
      'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
    success:
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  }[tone];
  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
      <div className="muted text-xs">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="muted text-xs">{hint}</div>}
    </div>
  );
}

export function HandbookLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <Link
      to={`/handbook/${path}`}
      className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-200"
    >
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-4 text-center">{children}</p>;
}

/** Two-step confirmation button for destructive actions. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to confirm',
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={armed ? 'btn bg-rose-600 text-white hover:bg-rose-700' : 'btn-secondary'}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function SavedFlash({ show }: { show: boolean }) {
  return show ? (
    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Saved ✓</span>
  ) : null;
}
