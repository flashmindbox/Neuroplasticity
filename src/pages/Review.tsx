import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { CopyBox } from '../components/CopyPaste';
import { MentorAvatar } from '../components/mentor';
import { CLUSTERS, DIMENSIONS, DIMENSION_BY_ID, type DimensionId } from '../content/dimensions';
import { PHASES } from '../content/roadmap';
import {
  Card,
  Field,
  HandbookLink,
  Notice,
  Page,
  Scale,
  Stat,
  Tabs,
  TextArea,
} from '../components/ui';
import { db, type DailyLog, type WeeklyReview } from '../lib/db';
import { addDays, formatKey, weekStart, type DateKey } from '../lib/dates';
import { portableMentorPrompt, type MentorReviewInput } from '../lib/ai/portable';
import { plannedIds, recordActivity, useProgramme } from '../lib/hooks';
import { weeklyNote, type WeeklyNote } from '../lib/mentor';
import { weekMetrics, type WeekMetrics } from '../lib/metrics';
import { useSetting } from '../lib/settings';

type Tab = 'weekly' | 'monthly';

export default function Review() {
  const [tab, setTab] = useState<Tab>('weekly');
  return (
    <Page
      title="Review"
      subtitle={
        <>
          The review adjusts the plan, never your worth.{' '}
          <HandbookLink path="03-weekly-monthly-rituals.md">Rituals</HandbookLink>
        </>
      }
    >
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'weekly', label: 'Sunday review' },
          { id: 'monthly', label: 'Monthly rating' },
        ]}
      />
      {tab === 'weekly' ? <Weekly /> : <Monthly />}
    </Page>
  );
}

const LOW_SOURCES = ['Purpose', 'Progress', 'Connection', 'Energy'];

function Weekly() {
  const prog = useProgramme();
  const charter = useSetting('charter');
  const [week, setWeek] = useState<DateKey | null>(null);
  const ws = week ?? (prog ? weekStart(prog.today) : '');
  // The week under review plus the three before it: enough for a trend and the mentor prompt.
  const from = ws && addDays(ws, -21);
  const to = ws && addDays(ws, 6);
  const logs = useLiveQuery(
    () => db.dailyLogs.where('date').between(from, to, true, true).toArray(),
    [from, to],
  );
  const sessions = useLiveQuery(
    () => db.focusSessions.where('date').between(from, to, true, true).toArray(),
    [from, to],
  );
  const mocks = useLiveQuery(
    () => db.mocks.where('date').between(from, to, true, true).toArray(),
    [from, to],
  );
  // null = no review yet; undefined = still loading.
  const existing = useLiveQuery(async () => (await db.weeklyReviews.get(ws)) ?? null, [ws]);

  const weeks = useMemo(() => {
    if (!prog || !logs || !sessions || !mocks || !ws) return null;
    const map = new Map<DateKey, DailyLog>(logs.map((l) => [l.date, l]));
    const first = weekStart(prog.dates.programmeStart);
    return [21, 14, 7, 0]
      .map((back) => addDays(ws, -back))
      .filter((w) => w >= first || w === ws)
      .map((w) => ({
        weekStart: w,
        metrics: weekMetrics(
          w,
          map,
          sessions,
          mocks,
          (d) => plannedIds(d, prog.dates, charter?.targets ?? []),
          prog.today,
        ),
      }));
  }, [prog, logs, sessions, mocks, ws, charter]);

  if (!prog || !weeks || existing === undefined) return null;
  const current = weeks[weeks.length - 1].metrics;
  const prev = weeks.length > 1 ? weeks[weeks.length - 2].metrics : null;
  const promptBase: Omit<MentorReviewInput, 'review' | 'note'> = {
    phase: PHASES[prog.state.phase].name,
    programmeWeek: prog.state.week,
    daysToPrelims: prog.state.daysToPrelims,
    targets: (charter?.targets ?? []).map((t) => DIMENSION_BY_ID[t].name),
    weeks: weeks.map((w) => ({ weekStart: formatKey(w.weekStart), metrics: w.metrics })),
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => setWeek(addDays(ws, -7))}>
          ← Previous
        </button>
        <span className="text-sm font-medium">
          Week of {formatKey(ws, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          className="btn-ghost"
          disabled={addDays(ws, 7) > prog.today}
          onClick={() => setWeek(addDays(ws, 7))}
        >
          Next →
        </button>
      </div>
      <WeeklyForm
        key={`${ws}-${existing ? 'saved' : 'new'}`}
        ws={ws}
        existing={existing}
        metrics={current}
        prev={prev}
        promptBase={promptBase}
      />
    </>
  );
}

function MentorNote({ note, onUse }: { note: WeeklyNote; onUse: () => void }) {
  return (
    <section
      aria-label="Your mentor on this week"
      className="card flex gap-3 border-brand-200 dark:border-brand-800"
    >
      <MentorAvatar />
      <div className="min-w-0 space-y-2 text-sm">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-200">
          Your mentor on this week
        </p>
        <p className="text-base font-semibold">{note.headline}</p>
        {note.wins.length > 0 && (
          <div>
            <h3 className="font-semibold">What went well</h3>
            <ul className="list-disc space-y-0.5 pl-5">
              {note.wins.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {note.watch.length > 0 && (
          <div>
            <h3 className="font-semibold">Keep an eye on</h3>
            <ul className="list-disc space-y-0.5 pl-5">
              {note.watch.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold">The one change for next week</h3>
          <p>{note.change}</p>
        </div>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onUse}>
          Use this as my change
        </button>
      </div>
    </section>
  );
}

function WeeklyForm({
  ws,
  existing,
  metrics,
  prev,
  promptBase,
}: {
  ws: DateKey;
  existing: WeeklyReview | null;
  metrics: WeekMetrics;
  prev: WeekMetrics | null;
  promptBase: Omit<MentorReviewInput, 'review' | 'note'>;
}) {
  const [form, setForm] = useState(() =>
    existing
      ? {
          worked: existing.worked,
          change: existing.change,
          ruleActions: existing.ruleActions,
          lowestSource: existing.lowestSource,
          nextWeek: existing.nextWeek,
        }
      : { worked: '', change: '', ruleActions: '', lowestSource: '', nextWeek: '' },
  );
  const [saved, setSaved] = useState(false);
  const note = weeklyNote(metrics, prev);

  const summary = [
    `Rewire — week of ${formatKey(ws)}`,
    `Habits ${metrics.habitPct ?? '–'}% · focus ${metrics.focusMinutes} min · sleep ${metrics.avgSleep ?? '–'} h · exercise ${metrics.exerciseDays} d · stress ${metrics.avgStress ?? '–'} · clarity ${metrics.avgClarity ?? '–'}`,
    form.worked && `Worked: ${form.worked}`,
    form.change && `Changing: ${form.change}`,
    form.nextWeek && `Next week: ${form.nextWeek}`,
  ]
    .filter(Boolean)
    .join('\n');

  async function save() {
    await db.weeklyReviews.put({ weekStart: ws, ...form, metrics: { ...metrics } });
    await recordActivity(ws, 'review');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <MentorNote
        note={note}
        onUse={() => setForm((f) => ({ ...f, change: f.change.trim() ? f.change : note.change }))}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Habit completion"
          value={metrics.habitPct == null ? '–' : `${metrics.habitPct}%`}
        />
        <Stat label="Focus minutes" value={metrics.focusMinutes} />
        <Stat label="Avg sleep" value={metrics.avgSleep ?? '–'} hint="hours" />
        <Stat label="Exercise days" value={metrics.exerciseDays} hint="≥ 20 min" />
        <Stat label="Avg stress" value={metrics.avgStress ?? '–'} />
        <Stat label="Avg clarity" value={metrics.avgClarity ?? '–'} />
        <Stat label="Attention sessions" value={metrics.attentionSessions} />
        <Stat label="Mocks" value={metrics.mocks} />
      </div>
      <Card title="Reflect">
        <div className="space-y-3">
          <Field label="What worked? One thing to keep.">
            <TextArea
              rows={2}
              value={form.worked}
              onChange={(e) => setForm({ ...form, worked: e.target.value })}
            />
          </Field>
          <Field label="What didn’t? The one specific change for next week.">
            <TextArea
              rows={2}
              value={form.change}
              onChange={(e) => setForm({ ...form, change: e.target.value })}
            />
          </Field>
          <Field label="Did a decision rule fire on Today? What will you do about it?">
            <TextArea
              rows={2}
              value={form.ruleActions}
              onChange={(e) => setForm({ ...form, ruleActions: e.target.value })}
            />
          </Field>
          <div>
            <span className="label">Lowest motivation source this week</span>
            <div className="flex flex-wrap gap-2">
              {LOW_SOURCES.map((s) => (
                <button
                  key={s}
                  className={form.lowestSource === s ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setForm({ ...form, lowestSource: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Field label="Next week: stretch challenge, service action, and the one if-then plan that matters most">
            <TextArea
              rows={3}
              value={form.nextWeek}
              onChange={(e) => setForm({ ...form, nextWeek: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={save}>
              {saved ? 'Saved ✓' : 'Save review'}
            </button>
            <button
              className="btn-secondary flex-1"
              onClick={() => navigator.clipboard?.writeText(summary)}
            >
              Copy summary for your partner
            </button>
          </div>
        </div>
      </Card>
      <Card title="Talk it through with Claude">
        <p className="muted mb-3">
          For a deeper review, copy this prompt into Claude Code (type <code>/rewire-coach</code>{' '}
          and paste), claude.ai or the Claude app. It contains this week’s numbers, the weeks before
          and your answers above — never your journal.
        </p>
        <CopyBox
          text={portableMentorPrompt({ ...promptBase, review: form, note })}
          label="Copy mentor-review prompt"
        />
      </Card>
    </>
  );
}

function Monthly() {
  const prog = useProgramme();
  const ratings = useLiveQuery(() => db.ratings.orderBy('date').toArray(), []);
  const [source, setSource] = useState<'self' | 'external'>('self');
  const [values, setValues] = useState<Partial<Record<DimensionId, number>>>({});
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<DimensionId | null>(null);
  const [saved, setSaved] = useState(false);
  if (!prog || !ratings) return null;
  const last = [...ratings].reverse().find((r) => r.source === source);
  const count = Object.keys(values).length;

  async function save() {
    await db.ratings.add({ date: prog!.today, source, ratings: values, note });
    setValues({});
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <Notice>
        Rate the level that has been <strong>consistently</strong> true for 4 weeks, not your best
        day. Levels 1–4 ≈ 1–2, 3–5, 6–8, 9–10.{' '}
        <HandbookLink path="00-foundations/target-profile.md">Level descriptors</HandbookLink>
      </Notice>
      <div className="flex gap-2">
        <button
          className={source === 'self' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSource('self')}
        >
          My rating
        </button>
        <button
          className={source === 'external' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSource('external')}
        >
          Someone else rates me
        </button>
      </div>
      {source === 'external' && (
        <p className="muted text-sm">
          Hand the phone to your partner or mentor. Their ratings are stored separately and compared
          with yours.
        </p>
      )}
      {CLUSTERS.map((cluster) => (
        <Card key={cluster} title={cluster}>
          <div className="space-y-4">
            {DIMENSIONS.filter((d) => d.cluster === cluster).map((d) => (
              <div key={d.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    className="text-left text-sm font-semibold"
                    onClick={() => setOpen(open === d.id ? null : d.id)}
                  >
                    {d.name}{' '}
                    <span className="muted text-xs">{open === d.id ? '▲' : '▼ levels'}</span>
                  </button>
                  {last?.ratings[d.id] != null && (
                    <span className="muted text-xs">last: {last.ratings[d.id]}</span>
                  )}
                </div>
                {open === d.id && (
                  <ol className="muted my-2 list-decimal space-y-1 pl-5 text-xs">
                    {d.levels.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ol>
                )}
                <div className="mt-1">
                  <Scale
                    value={values[d.id]}
                    onChange={(v) => setValues({ ...values, [d.id]: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Field label="Note">
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {saved && <Notice tone="success">Rating saved. See Progress for the radar.</Notice>}
      <button className="btn-primary w-full" disabled={count < DIMENSIONS.length} onClick={save}>
        Save {source === 'self' ? 'my' : 'external'} rating ({count}/{DIMENSIONS.length})
      </button>
    </>
  );
}
