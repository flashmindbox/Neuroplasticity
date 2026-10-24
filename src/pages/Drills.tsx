import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { AiPanel, AiResult } from '../components/AiPanel';
import { Card, Empty, Field, HandbookLink, Notice, Page, Scale, TextArea } from '../components/ui';
import {
  CALIBRATION_STATEMENTS,
  DRILL_BY_ID,
  DRILL_TYPES,
  drillTypeForDay,
  pickForDay,
  type DrillTypeId,
} from '../content/drills';
import { db, type DrillEntry } from '../lib/db';
import { dayOfWeek } from '../lib/dates';
import { useProgramme } from '../lib/hooks';
import { formatClock, useTimer } from '../lib/useTimer';

export default function Drills() {
  const prog = useProgramme();
  const [type, setType] = useState<DrillTypeId | null>(null);
  if (!prog) return null;
  const active = type ?? drillTypeForDay(dayOfWeek(prog.today));

  return (
    <Page
      title="Thinking drills"
      subtitle={
        <>
          One prompt, one thinking move, timed. Score yourself first.{' '}
          <HandbookLink path="modules/L3-thinking.md">The thinking moves</HandbookLink>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {DRILL_TYPES.map((d) => (
          <button
            key={d.id}
            className={d.id === active ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setType(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>
      {active === 'calibration' ? (
        <CalibrationQuiz key={prog.today} date={prog.today} />
      ) : (
        <DrillRunner key={active} type={active} date={prog.today} />
      )}
      <History />
    </Page>
  );
}

function DrillRunner({ type, date }: { type: Exclude<DrillTypeId, 'calibration'>; date: string }) {
  const def = DRILL_BY_ID[type];
  const [salt, setSalt] = useState(0);
  const [custom, setCustom] = useState('');
  const prompt = custom.trim() || pickForDay(def.bank, date, salt) || '';
  const [response, setResponse] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [savedId, setSavedId] = useState<number | null>(null);
  const timer = useTimer(def.seconds);
  const saved = useLiveQuery(() => (savedId ? db.drills.get(savedId) : undefined), [savedId]);
  const allScored = def.rubric.every((c) => scores[c]);

  async function save() {
    timer.pause();
    const id = await db.drills.add({
      date,
      type,
      prompt,
      response,
      durationSec: timer.elapsedSec,
      selfScores: scores,
    });
    setSavedId(id as number);
  }

  function reset() {
    setResponse('');
    setScores({});
    setSavedId(null);
    setSalt((s) => s + 1);
    setCustom('');
    timer.reset();
  }

  return (
    <Card title={def.name} aside={<span className="chip">{formatClock(def.seconds)} target</span>}>
      <p className="muted mb-3">{def.instructions}</p>
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-[15px] font-medium dark:bg-slate-800">
        {prompt || 'No prompts in this bank.'}
      </div>
      {!savedId && !timer.running && timer.elapsedSec === 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => setSalt((s) => s + 1)}>
            ↻ Another prompt
          </button>
          <input
            className="input max-w-sm flex-1"
            placeholder="…or paste a topic from your study programme"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
      )}

      {!savedId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span
              className={`text-2xl font-semibold tabular-nums ${timer.remainingSec < 0 ? 'text-amber-600' : ''}`}
            >
              {formatClock(timer.remainingSec)}
            </span>
            <button className="btn-secondary" onClick={timer.running ? timer.pause : timer.start}>
              {timer.running ? 'Pause' : timer.elapsedSec ? 'Resume' : 'Start timer'}
            </button>
          </div>
          <Field label="Your response">
            <TextArea
              rows={8}
              value={response}
              onChange={(e) => {
                if (!timer.running && timer.elapsedSec === 0) timer.start();
                setResponse(e.target.value);
              }}
              placeholder={type === 'lenses' ? 'Social: …\nEconomic: …\nPolitical: …' : ''}
            />
          </Field>
          <div className="space-y-3">
            <h3 className="font-semibold">Score yourself first (1–5)</h3>
            {def.rubric.map((c) => (
              <Scale
                key={c}
                label={c}
                min={1}
                max={5}
                value={scores[c]}
                onChange={(v) => setScores((s) => ({ ...s, [c]: v }))}
              />
            ))}
            <p className="muted text-xs">
              1 absent · 2 weak/generic · 3 adequate · 4 strong & specific · 5 topper-grade
            </p>
          </div>
          <button
            className="btn-primary w-full"
            disabled={!response.trim() || !allScored}
            onClick={save}
          >
            Save drill
          </button>
        </div>
      ) : (
        saved && (
          <div className="space-y-3">
            <Notice tone="success">
              Saved · {formatClock(saved.durationSec)} · your average {avg(saved.selfScores)}/5
            </Notice>
            <AiPanel
              existing={saved.ai}
              selfScores={saved.selfScores}
              build={() => ({
                kind: 'drill',
                title: def.name,
                instructions: def.instructions,
                prompt: saved.prompt,
                response: saved.response,
                rubric: def.rubric,
              })}
              onResult={async (ai) => {
                await db.drills.update(saved.id!, { ai });
              }}
            />
            <button className="btn-secondary w-full" onClick={reset}>
              New drill
            </button>
          </div>
        )
      )}
    </Card>
  );
}

const avg = (s: Record<string, number>) => {
  const v = Object.values(s);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
};

const CONFIDENCES = [50, 60, 70, 80, 90, 100];

function CalibrationQuiz({ date }: { date: string }) {
  const [round, setRound] = useState(0);
  const items = useMemo(() => {
    const pool = [...CALIBRATION_STATEMENTS];
    const out = [];
    for (let i = 0; i < 10 && pool.length; i++) {
      const s = pickForDay(pool, date, round * 97 + i)!;
      out.push(s);
      pool.splice(pool.indexOf(s), 1);
    }
    return out;
  }, [date, round]);
  const [answers, setAnswers] = useState<Record<number, { truth?: boolean; conf?: number }>>({});
  const [done, setDone] = useState(false);
  const complete = items.every((_, i) => answers[i]?.truth !== undefined && answers[i]?.conf);

  const results = items.map((s, i) => ({
    correct: answers[i]?.truth === s.truth,
    confidence: (answers[i]?.conf ?? 50) / 100,
  }));
  const byConf = CONFIDENCES.map((c) => {
    const r = results.filter((x) => Math.round(x.confidence * 100) === c);
    return {
      c,
      n: r.length,
      acc: r.length ? Math.round((r.filter((x) => x.correct).length / r.length) * 100) : null,
    };
  }).filter((x) => x.n);
  const meanConf = Math.round(
    (results.reduce((s, r) => s + r.confidence, 0) / results.length) * 100,
  );
  const accuracy = Math.round((results.filter((r) => r.correct).length / results.length) * 100);

  async function submit() {
    setDone(true);
    await db.drills.add({
      date,
      type: 'calibration',
      prompt: `${items.length} statements`,
      response: '',
      durationSec: 0,
      selfScores: {},
      calibration: results,
    });
  }

  return (
    <Card title="Calibration quiz">
      <p className="muted mb-3">
        For each statement: true or false, and how sure you are. Calibrated means your 70%s are
        right 70% of the time.
      </p>
      <ol className="space-y-4">
        {items.map((s, i) => (
          <li key={i} className="space-y-2">
            <p className="text-sm font-medium">
              {i + 1}. {s.text}
            </p>
            <div className="flex flex-wrap gap-1">
              {[true, false].map((t) => (
                <button
                  key={String(t)}
                  disabled={done}
                  className={
                    answers[i]?.truth === t ? 'btn-primary px-3 py-1' : 'btn-secondary px-3 py-1'
                  }
                  onClick={() => setAnswers((a) => ({ ...a, [i]: { ...a[i], truth: t } }))}
                >
                  {t ? 'True' : 'False'}
                </button>
              ))}
              <span className="mx-1 self-center text-slate-300">|</span>
              {CONFIDENCES.map((c) => (
                <button
                  key={c}
                  disabled={done}
                  className={
                    answers[i]?.conf === c ? 'btn-primary px-2 py-1' : 'btn-secondary px-2 py-1'
                  }
                  onClick={() => setAnswers((a) => ({ ...a, [i]: { ...a[i], conf: c } }))}
                >
                  {c}%
                </button>
              ))}
            </div>
            {done && (
              <p
                className={`text-xs font-medium ${results[i].correct ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {results[i].correct ? 'Correct' : 'Incorrect'} — the statement is{' '}
                {s.truth ? 'true' : 'false'}.
              </p>
            )}
          </li>
        ))}
      </ol>
      {!done ? (
        <button className="btn-primary mt-4 w-full" disabled={!complete} onClick={submit}>
          Check calibration
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <Notice tone={Math.abs(meanConf - accuracy) <= 10 ? 'success' : 'warning'}>
            Average confidence {meanConf}% vs accuracy {accuracy}% —{' '}
            {meanConf - accuracy > 10
              ? 'overconfident'
              : accuracy - meanConf > 10
                ? 'underconfident'
                : 'well calibrated'}{' '}
            on this set.
          </Notice>
          <ul className="text-sm">
            {byConf.map((b) => (
              <li key={b.c}>
                Said {b.c}% → right {b.acc}% ({b.n})
              </li>
            ))}
          </ul>
          <button
            className="btn-secondary w-full"
            onClick={() => (setAnswers({}), setDone(false), setRound((r) => r + 1))}
          >
            New set
          </button>
        </div>
      )}
    </Card>
  );
}

function History() {
  const drills = useLiveQuery(() => db.drills.orderBy('id').reverse().limit(15).toArray(), []);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card title="Recent drills">
      {!drills?.length ? (
        <Empty>No drills yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {drills.map((d: DrillEntry) => (
            <li key={d.id} className="py-2">
              <button
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={() => setOpen(open === d.id ? null : d.id!)}
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium">
                    {DRILL_BY_ID[d.type as DrillTypeId]?.name ?? d.type}
                  </span>
                  <span className="muted block truncate text-xs">
                    {d.date} · {d.prompt}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums">
                  {d.calibration
                    ? `${Math.round((d.calibration.filter((c) => c.correct).length / d.calibration.length) * 100)}% right`
                    : `you ${avg(d.selfScores)}${d.ai ? ` · AI ${avg(d.ai.scores)}` : ''}`}
                </span>
              </button>
              {open === d.id && !d.calibration && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{d.response}</p>
                  {d.ai && <AiResult ai={d.ai} selfScores={d.selfScores} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
