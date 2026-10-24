import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DEFAULT_EXAM_DATES, type ExamDates } from '../content/roadmap';
import { Card, ConfirmButton, Field, HandbookLink, Notice, Page, Stat } from '../components/ui';
import { exportBackup, importBackup, parseBackup } from '../lib/backup';
import { db, TABLE_NAMES } from '../lib/db';
import { todayKey } from '../lib/dates';
import { ensureInitialised, setSetting, useSetting } from '../lib/settings';

export default function Settings() {
  return (
    <Page title="Settings" subtitle="Everything is stored only on this device.">
      <DatesCard />
      <ApiKeyCard />
      <BackupCard />
      <Card title="About">
        <p className="text-sm">
          Rewire is a personal, evidence-graded programme — not medical or psychological care. If
          you are struggling, call Tele-MANAS on{' '}
          <a className="font-semibold underline" href="tel:14416">
            14416
          </a>{' '}
          (free, 24×7).{' '}
          <HandbookLink path="04-safety-and-wellbeing.md">Safety & wellbeing</HandbookLink>
        </p>
      </Card>
    </Page>
  );
}

function DatesCard() {
  const dates = useSetting('dates');
  return dates ? <DatesForm initial={dates} /> : null;
}

function DatesForm({ initial }: { initial: ExamDates }) {
  const [d, setD] = useState<ExamDates>(initial);
  const [saved, setSaved] = useState(false);
  const fields: [keyof ExamDates, string][] = [
    ['programmeStart', 'Programme start'],
    ['prelims', 'Prelims'],
    ['mains', 'Mains (first day)'],
    ['interview', 'Personality Test (estimate)'],
  ];
  const valid = d.programmeStart < d.prelims && d.prelims < d.mains && d.mains < d.interview;
  return (
    <Card title="Exam dates">
      <p className="muted mb-3">
        UPSC 2027 calendar: Prelims {DEFAULT_EXAM_DATES.prelims}, Mains from{' '}
        {DEFAULT_EXAM_DATES.mains}. Phases move automatically if you change these.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              type="date"
              className="input"
              value={d[k]}
              onChange={(e) => setD({ ...d, [k]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      {!valid && (
        <div className="mt-2">
          <Notice tone="warning">
            Dates must be in order: start → Prelims → Mains → interview.
          </Notice>
        </div>
      )}
      <button
        className="btn-primary mt-3"
        disabled={!valid}
        onClick={async () => {
          await setSetting('dates', d);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        {saved ? 'Saved ✓' : 'Save dates'}
      </button>
    </Card>
  );
}

function ApiKeyCard() {
  const apiKey = useSetting('apiKey');
  const usage = useLiveQuery(() => db.aiUsage.toArray(), []);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const month = todayKey().slice(0, 7);
  const monthUsage = (usage ?? []).filter((u) => u.date.startsWith(month));
  const total = (usage ?? []).reduce((s, u) => s + u.costUsd, 0);

  return (
    <Card title="AI second opinion (optional)">
      <div className="space-y-3 text-sm">
        <p>
          Drills, talks and the mock board can be rated by Claude (model{' '}
          <code>claude-opus-5-5</code>) using <strong>your own</strong> Anthropic API key. Calls
          happen only when you press an AI button. Your journal is never sent.
        </p>
        <ul className="muted list-disc space-y-1 pl-5 text-xs">
          <li>
            Create a dedicated key at console.anthropic.com and set a monthly spend limit on it.
          </li>
          <li>
            The key is stored only in this browser’s storage and is never included in backups.
          </li>
          <li>
            If the model declines a request, the API may retry it on a default fallback model
            (server-side fallback).
          </li>
        </ul>
        {apiKey ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {show ? apiKey : `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`}
            </code>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
            <ConfirmButton onConfirm={() => setSetting('apiKey', '')}>Remove key</ConfirmButton>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              className="input"
              placeholder="sk-ant-…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={!value.trim().startsWith('sk-')}
              onClick={async () => {
                await setSetting('apiKey', value.trim());
                setValue('');
              }}
            >
              Save
            </button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Calls this month" value={monthUsage.length} />
          <Stat
            label="Cost this month"
            value={`$${monthUsage.reduce((s, u) => s + u.costUsd, 0).toFixed(2)}`}
          />
          <Stat label="Total cost" value={`$${total.toFixed(2)}`} />
        </div>
        <p className="muted text-xs">
          Costs are estimates from token counts at list price ($4 / $20 per million input / output
          tokens).
        </p>
      </div>
    </Card>
  );
}

function BackupCard() {
  const lastBackupAt = useSetting('lastBackupAt');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [pending, setPending] = useState<File | null>(null);

  async function doExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rewire-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await setSetting('lastBackupAt', new Date().toISOString());
    setMessage({
      tone: 'success',
      text: 'Backup downloaded. Keep it somewhere safe (e.g., your email or cloud drive).',
    });
  }

  async function doImport() {
    if (!pending) return;
    try {
      const backup = parseBackup(await pending.text());
      await importBackup(backup);
      setMessage({
        tone: 'success',
        text: `Restored backup from ${backup.exportedAt.slice(0, 10)}.`,
      });
    } catch (e) {
      setMessage({ tone: 'warning', text: e instanceof Error ? e.message : 'Import failed.' });
    }
    setPending(null);
  }

  async function resetAll() {
    await db.transaction(
      'rw',
      TABLE_NAMES.map((n) => db.table(n)),
      async () => {
        for (const n of TABLE_NAMES) await db.table(n).clear();
      },
    );
    await ensureInitialised();
    setMessage({ tone: 'success', text: 'All data erased. The programme restarts today.' });
  }

  return (
    <Card title="Backup & data">
      <div className="space-y-3 text-sm">
        <p>
          Your data lives only in this browser. Export a backup monthly.{' '}
          <span className="muted">
            Last backup: {lastBackupAt ? lastBackupAt.slice(0, 10) : 'never'}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={doExport}>
            Export backup
          </button>
          <label className="btn-secondary cursor-pointer">
            Choose backup to restore…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => setPending(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {pending && (
          <Notice tone="warning">
            Restoring <strong>{pending.name}</strong> replaces all current data on this device (your
            API key is kept). <ConfirmButton onConfirm={doImport}>Restore now</ConfirmButton>
          </Notice>
        )}
        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <ConfirmButton onConfirm={resetAll} confirmLabel="Tap again — this erases everything">
            Erase all data
          </ConfirmButton>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </Card>
  );
}
