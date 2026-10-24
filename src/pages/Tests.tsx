import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrainCheckRunner } from '../components/BrainCheckRunner';
import { Card, Empty, Field, HandbookLink, Notice, Page, Tabs } from '../components/ui';
import {
  CRISIS_CONTACTS,
  SCREENINGS,
  SCREENING_OPTIONS,
  SCREENING_STEM,
  type ScreeningKind,
} from '../content/screening';
import { brainCheckStatus, baselineOf, compositeChange, sortedSessions } from '../lib/brainCheck';
import { db } from '../lib/db';
import { addDays } from '../lib/dates';
import { recordActivity, useProgramme } from '../lib/hooks';
import { clarityOf, fogAudit } from '../lib/metrics';
import { ACTION_MESSAGES, scoreScreening, type ScreeningResult } from '../lib/screening';
import { setSetting, useSetting } from '../lib/settings';

type Tab = 'brain' | 'checkin' | 'fog' | 'writing';

export default function Tests() {
  const [tab, setTab] = useState<Tab>('brain');
  return (
    <Page
      title="Tests"
      subtitle={
        <>
          Measure, don’t guess.{' '}
          <HandbookLink path="assessments/baseline-and-monthly.md">
            Schedule & how to read results
          </HandbookLink>
        </>
      }
    >
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'brain', label: 'Brain Check' },
          { id: 'checkin', label: 'Wellbeing check-in' },
          { id: 'fog', label: 'Fog audit' },
          { id: 'writing', label: 'Writing speed' },
        ]}
      />
      {tab === 'brain' && <BrainCheck />}
      {tab === 'checkin' && <CheckIn />}
      {tab === 'fog' && <FogAudit />}
      {tab === 'writing' && <WritingSpeed />}
    </Page>
  );
}

function BrainCheck() {
  const prog = useProgramme();
  const entries = useLiveQuery(() => db.brainChecks.toArray(), []);
  const [running, setRunning] = useState(false);
  if (!prog || !entries) return null;
  const status = brainCheckStatus(entries);
  const base = baselineOf(entries);
  const sessions = sortedSessions(entries);
  const chart = sessions.map((e, i) => ({
    n: i + 1,
    date: e.date.slice(5),
    rt: e.rtMedianMs,
    symbols: e.symbolCorrect,
    change: base ? Math.round(compositeChange(e, base) * 100) : null,
  }));
  const doneThisWeek = sessions.some((e) => e.date > addDays(prog.today, -6));

  return (
    <>
      <Card
        title="Weekly Brain Check"
        aside={doneThisWeek ? <span className="chip">done this week</span> : null}
      >
        {status.kind === 'practice' && (
          <Notice>
            Practice period: {status.remaining} more session(s). Scores rise at first just from
            familiarity — that is expected.
          </Notice>
        )}
        {status.kind === 'baseline' && (
          <Notice>Building your baseline: {status.remaining} more session(s).</Notice>
        )}
        {status.kind === 'tracking' && (
          <Notice tone={status.decline ? 'warning' : 'success'}>
            Latest vs your baseline: {status.latestChange >= 0 ? '+' : ''}
            {Math.round(status.latestChange * 100)}%.{' '}
            {status.decline
              ? 'Two sessions a week apart are below baseline. Rule out sleep, illness or a stressful week; if none explains it, see a doctor.'
              : 'Within your normal range.'}
          </Notice>
        )}
        <div className="mt-3">
          {running ? (
            <BrainCheckRunner
              onDone={async (r) => {
                await db.brainChecks.add({ ...r, date: prog.today });
                await recordActivity(prog.today, 'brain');
                setRunning(false);
              }}
            />
          ) : (
            <button className="btn-primary w-full" onClick={() => setRunning(true)}>
              Start Brain Check (~3 min)
            </button>
          )}
        </div>
      </Card>
      <Card title="History">
        {sessions.length === 0 ? (
          <Empty>No sessions yet.</Empty>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis yAxisId="rt" fontSize={11} />
                  <YAxis yAxisId="sym" orientation="right" fontSize={11} />
                  <Tooltip />
                  <Line
                    yAxisId="rt"
                    dataKey="rt"
                    name="Reaction ms (lower better)"
                    stroke="#f59e0b"
                    dot
                  />
                  <Line
                    yAxisId="sym"
                    dataKey="symbols"
                    name="Symbols / 60 s"
                    stroke="#0f766e"
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {[...sessions]
                .reverse()
                .slice(0, 8)
                .map((e, i) => (
                  <li key={e.id} className="flex justify-between">
                    <span>
                      {e.date}
                      {sessions.length - i <= 4 ? ' · practice' : ''}
                    </span>
                    <span className="tabular-nums">
                      {e.rtMedianMs} ms · {e.symbolCorrect} sym · span {e.spanForward}/
                      {e.spanBackward}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function CheckIn() {
  const prog = useProgramme();
  const [kind, setKind] = useState<ScreeningKind>('phq9');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const history = useLiveQuery(() => db.screenings.orderBy('id').reverse().limit(12).toArray(), []);
  if (!prog) return null;
  const items = SCREENINGS[kind].items;
  const complete = items.every((_, i) => answers[i] !== undefined);

  async function submit() {
    const arr = items.map((_, i) => answers[i]);
    const r = scoreScreening(kind, arr);
    await db.screenings.add({ date: prog!.today, kind, answers: arr, total: r.total });
    setResult(r);
  }

  return (
    <>
      <Notice>
        Screening questionnaires, not diagnoses. Results are interpreted with fixed rules — no AI
        involved. <HandbookLink path="04-safety-and-wellbeing.md">Safety & wellbeing</HandbookLink>
      </Notice>
      <Card title={SCREENINGS[kind].name}>
        <div className="mb-3 flex gap-2">
          {(['phq9', 'gad7'] as ScreeningKind[]).map((k) => (
            <button
              key={k}
              className={k === kind ? 'btn-primary' : 'btn-secondary'}
              onClick={() => (setKind(k), setAnswers({}), setResult(null))}
            >
              {SCREENINGS[k].name}
            </button>
          ))}
        </div>
        {result ? (
          <div className="space-y-3">
            <div className="text-lg font-semibold">
              Score {result.total} · {result.severity}
            </div>
            <Notice
              tone={
                result.action === 'crisis'
                  ? 'crisis'
                  : result.action === 'ok'
                    ? 'success'
                    : 'warning'
              }
            >
              {ACTION_MESSAGES[result.action]}
            </Notice>
            {result.action !== 'ok' && (
              <ul className="space-y-1 text-sm">
                {CRISIS_CONTACTS.map((c) => (
                  <li key={c.phone}>
                    {c.name}:{' '}
                    <a
                      className="font-semibold underline"
                      href={`tel:${c.phone.replace(/-/g, '')}`}
                    >
                      {c.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-secondary" onClick={() => (setAnswers({}), setResult(null))}>
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="muted">{SCREENING_STEM}</p>
            {items.map((q, i) => (
              <fieldset key={i}>
                <legend className="mb-1 text-sm font-medium">
                  {i + 1}. {q}
                </legend>
                <div className="flex flex-wrap gap-1">
                  {SCREENING_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={
                        answers[i] === o.value
                          ? 'btn-primary px-2 py-1 text-xs'
                          : 'btn-secondary px-2 py-1 text-xs'
                      }
                      onClick={() => setAnswers((a) => ({ ...a, [i]: o.value }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <button className="btn-primary w-full" disabled={!complete} onClick={submit}>
              See result
            </button>
          </div>
        )}
      </Card>
      <Card title="History">
        {!history?.length ? (
          <Empty>No check-ins yet. Take both once a month.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between">
                <span>
                  {h.date} · {SCREENINGS[h.kind].name}
                </span>
                <span className="tabular-nums">{h.total}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function FogAudit() {
  const prog = useProgramme();
  const logs = useLiveQuery(
    () => (prog ? db.dailyLogs.where('date').aboveOrEqual(addDays(prog.today, -27)).toArray() : []),
    [prog?.today],
  );
  if (!prog || !logs) return null;
  const factors = fogAudit(logs);
  const chart = logs
    .filter((l) => clarityOf(l) != null)
    .map((l) => ({ date: l.date.slice(5), clarity: clarityOf(l), sleep: l.sleepHours ?? null }));

  return (
    <>
      <Card title="Fog audit (last 28 days)">
        <p className="muted mb-3">
          How your daily clarity moves with each factor. Correlation shows association, not cause —
          use it to choose your next experiment.{' '}
          <HandbookLink path="modules/L0-brain-clarity.md">Brain clarity</HandbookLink>
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="muted text-left text-xs">
              <th className="py-1">Factor</th>
              <th className="py-1 text-right">Days</th>
              <th className="py-1 text-right">Correlation with clarity</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5">{f.label}</td>
                <td className="py-1.5 text-right tabular-nums">{f.n}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {f.r == null ? (f.n < 7 ? 'need 7+ days' : '–') : f.r.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted mt-2 text-xs">
          Rough guide: |r| ≥ 0.3 is worth testing; ≥ 0.5 is a strong lead. Negative r means more of
          the factor, less clarity.
        </p>
      </Card>
      <Card title="Clarity over time">
        {chart.length < 2 ? (
          <Empty>Log clarity in the Today quick log for a few days.</Empty>
        ) : (
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} fontSize={11} />
                <Tooltip />
                <Line dataKey="clarity" name="Clarity" stroke="#0f766e" strokeWidth={2} dot />
                <Line dataKey="sleep" name="Sleep h" stroke="#6366f1" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}

function WritingSpeed() {
  const prog = useProgramme();
  const log = useSetting('writingSpeed');
  const [words, setWords] = useState('');
  const [minutes, setMinutes] = useState('10');
  if (!prog || !log) return null;
  const wpm =
    Number(words) > 0 && Number(minutes) > 0 ? Math.round(Number(words) / Number(minutes)) : null;
  return (
    <Card title="Hand-writing speed (monthly)">
      <p className="muted mb-3">
        Write by hand for 10 minutes at legible, exam quality on any prompt. Count the words.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Words written">
          <input
            type="number"
            min={0}
            className="input"
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            min={1}
            className="input"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
      </div>
      <button
        className="btn-primary mt-3 w-full"
        disabled={!wpm}
        onClick={async () => {
          await setSetting('writingSpeed', [...log, { date: prog.today, wpm: wpm! }]);
          setWords('');
        }}
      >
        Save {wpm ? `${wpm} words/min` : ''}
      </button>
      {log.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {[...log].reverse().map((l, i) => (
            <li key={i} className="flex justify-between">
              <span>{l.date}</span>
              <span className="tabular-nums">{l.wpm} wpm</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
