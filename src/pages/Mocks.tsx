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
import { Card, Empty, Field, HandbookLink, Notice, Page, Scale, Stat } from '../components/ui';
import {
  BUCKETS,
  brierScore,
  bucketReports,
  emptyBuckets,
  sumBuckets,
  totalMarks,
  validateBuckets,
  type MockBuckets,
} from '../lib/calibration';
import { db, type MockKind } from '../lib/db';
import { recordActivity, useProgramme } from '../lib/hooks';
import { round } from '../lib/stats';

const ADVICE_TEXT = {
  attempt: 'Attempt',
  caution: 'Attempt only if you can eliminate an option',
  skip: 'Skip unless you can eliminate two',
  'more-data': 'Need 20+ attempts',
};

export default function Mocks() {
  const prog = useProgramme();
  const mocks = useLiveQuery(() => db.mocks.orderBy('date').toArray(), []);
  if (!prog) return null;
  const prelims = (mocks ?? []).filter((m) => m.kind === 'prelims-gs');
  const recent = prelims.slice(-10);
  const pooled = sumBuckets(recent.map((m) => m.buckets));
  const reports = bucketReports(pooled);
  const brier = brierScore(pooled);
  const chart = prelims.map((m) => ({
    date: m.date.slice(5),
    marks: round(totalMarks(m.buckets), 1),
    brier: round(brierScore(m.buckets) ?? 0, 3),
  }));

  return (
    <Page
      title="Mocks & calibration"
      subtitle={
        <>
          Tag confidence on every question; log the counts here.{' '}
          <HandbookLink path="modules/L3-judgement-calibration.md">How it works</HandbookLink>
        </>
      }
    >
      <MockForm date={prog.today} />

      <Card title="Your calibration (last 10 GS mocks)">
        {recent.length === 0 ? (
          <Empty>Log a Prelims GS mock with confidence tags to see your calibration.</Empty>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Mocks" value={recent.length} />
              <Stat
                label="Avg marks"
                value={round(
                  recent.reduce((s, m) => s + totalMarks(m.buckets), 0) / recent.length,
                  1,
                )}
              />
              <Stat
                label="Brier score"
                value={brier == null ? '–' : round(brier, 3)}
                hint="lower is better"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="muted text-left text-xs">
                    <th className="py-1">Bucket</th>
                    <th className="py-1 text-right">Attempted</th>
                    <th className="py-1 text-right">Accuracy</th>
                    <th className="py-1 text-right">Gap</th>
                    <th className="py-1 text-right">EV / attempt</th>
                    <th className="py-1 pl-3">Your rule</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-medium">
                        {r.label}{' '}
                        <span className="muted text-xs">({Math.round(r.confidence * 100)}%)</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{r.attempted}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.accuracy == null ? '–' : `${Math.round(r.accuracy * 100)}%`}
                      </td>
                      <td
                        className={`py-1.5 text-right tabular-nums ${r.gap != null && Math.abs(r.gap) > 0.1 ? 'text-amber-700 dark:text-amber-400' : ''}`}
                      >
                        {r.gap == null ? '–' : `${r.gap > 0 ? '+' : ''}${Math.round(r.gap * 100)}`}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.ev == null ? '–' : r.ev.toFixed(2)}
                      </td>
                      <td className="py-1.5 pl-3 text-xs">{ADVICE_TEXT[r.advice]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-xs">
              Gap = stated confidence − actual accuracy (positive = overconfident). EV uses +2 /
              −0.66; attempting pays when accuracy is above 25%. Rules need at least 20 attempts per
              bucket and ~5 mocks before you trust them.
            </p>
            {chart.length > 1 && (
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="marks" stroke="#0f766e" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </Card>

      <MainsSims mocks={(mocks ?? []).filter((m) => m.kind === 'mains-sim')} />
    </Page>
  );
}

function MockForm({ date }: { date: string }) {
  const [kind, setKind] = useState<MockKind>('prelims-gs');
  const [name, setName] = useState('');
  const [d, setD] = useState(date);
  const [buckets, setBuckets] = useState<MockBuckets>(emptyBuckets());
  const [skipped, setSkipped] = useState(0);
  const [preStress, setPreStress] = useState<number>();
  const [composure, setComposure] = useState<number>();
  const [firstHalf, setFirstHalf] = useState<number>();
  const [lastHalf, setLastHalf] = useState<number>();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const isMains = kind === 'mains-sim';

  const setCount = (id: keyof MockBuckets, field: 'attempted' | 'correct', v: string) =>
    setBuckets((b) => ({ ...b, [id]: { ...b[id], [field]: v === '' ? 0 : Number(v) } }));

  async function save() {
    const problem = isMains ? null : validateBuckets(buckets);
    if (problem) return setError(problem);
    setError(null);
    await db.mocks.add({
      date: d,
      name:
        name.trim() || (isMains ? 'Mains simulation' : kind === 'csat' ? 'CSAT mock' : 'GS mock'),
      kind,
      buckets: isMains ? emptyBuckets() : buckets,
      skipped,
      preStress,
      composure,
      firstHalfQuality: firstHalf,
      lastHalfQuality: lastHalf,
      notes,
    });
    await recordActivity(d, 'mock');
    setBuckets(emptyBuckets());
    setSkipped(0);
    setName('');
    setNotes('');
    setPreStress(undefined);
    setComposure(undefined);
    setFirstHalf(undefined);
    setLastHalf(undefined);
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  }

  const attempted = BUCKETS.reduce((s, b) => s + buckets[b.id].attempted, 0);

  return (
    <Card title="Log a mock">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['prelims-gs', 'Prelims GS'],
              ['csat', 'CSAT'],
              ['mains-sim', 'Mains simulation'],
            ] as [MockKind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={k === kind ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test series #4"
            />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={d} onChange={(e) => setD(e.target.value)} />
          </Field>
        </div>
        {!isMains && (
          <div>
            <span className="label">Per confidence bucket</span>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
              <span className="muted text-xs">Bucket</span>
              <span className="muted w-24 text-xs">Attempted</span>
              <span className="muted w-24 text-xs">Correct</span>
              {BUCKETS.map((b) => (
                <FragmentRow key={b.id} label={`${b.label} (~${Math.round(b.confidence * 100)}%)`}>
                  <input
                    aria-label={`${b.label} attempted`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="input w-24"
                    value={buckets[b.id].attempted || ''}
                    onChange={(e) => setCount(b.id, 'attempted', e.target.value)}
                  />
                  <input
                    aria-label={`${b.label} correct`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="input w-24"
                    value={buckets[b.id].correct || ''}
                    onChange={(e) => setCount(b.id, 'correct', e.target.value)}
                  />
                </FragmentRow>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Skipped">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={skipped || ''}
                  onChange={(e) => setSkipped(Number(e.target.value || 0))}
                />
              </Field>
              <div className="self-end text-sm">
                Attempted {attempted} · marks <strong>{round(totalMarks(buckets), 2)}</strong>
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Scale label="Stress before" min={1} max={10} value={preStress} onChange={setPreStress} />
          <Scale
            label="Composure during"
            min={1}
            max={10}
            value={composure}
            onChange={setComposure}
          />
          {isMains && (
            <>
              <Scale
                label="Quality — first 30 min"
                min={1}
                max={5}
                value={firstHalf}
                onChange={setFirstHalf}
              />
              <Scale
                label="Quality — last 30 min"
                min={1}
                max={5}
                value={lastHalf}
                onChange={setLastHalf}
              />
            </>
          )}
        </div>
        <Field label="Notes — what to change next time (failure protocol, not a verdict)">
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {error && <Notice tone="warning">{error}</Notice>}
        {ok && <Notice tone="success">Mock saved.</Notice>}
        <button className="btn-primary w-full" onClick={save}>
          Save mock
        </button>
      </div>
    </Card>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span>{label}</span>
      {children}
    </>
  );
}

function MainsSims({
  mocks,
}: {
  mocks: {
    id?: number;
    date: string;
    name: string;
    firstHalfQuality?: number;
    lastHalfQuality?: number;
    composure?: number;
  }[];
}) {
  if (!mocks.length) return null;
  return (
    <Card title="Mains simulations — stamina">
      <ul className="space-y-1 text-sm">
        {mocks
          .slice(-10)
          .reverse()
          .map((m) => (
            <li key={m.id} className="flex justify-between gap-2">
              <span>
                {m.date} · {m.name}
              </span>
              <span className="tabular-nums">
                first {m.firstHalfQuality ?? '–'} → last {m.lastHalfQuality ?? '–'}
                {m.firstHalfQuality && m.lastHalfQuality
                  ? ` (${m.lastHalfQuality - m.firstHalfQuality >= 0 ? '+' : ''}${m.lastHalfQuality - m.firstHalfQuality})`
                  : ''}
              </span>
            </li>
          ))}
      </ul>
      <p className="muted mt-2 text-xs">
        Goal (Deep focus L4): no drop in quality in the final 30 minutes.
      </p>
    </Card>
  );
}
