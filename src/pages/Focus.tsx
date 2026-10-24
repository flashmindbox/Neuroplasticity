import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { attentionMinutes, focusBlockMinutes } from '../content/protocol';
import { Card, Empty, Field, HandbookLink, Page, Scale, Stat, Tabs } from '../components/ui';
import { db, type SessionKind } from '../lib/db';
import { useProgramme } from '../lib/hooks';
import { bell } from '../lib/sound';
import { formatClock, useTimer } from '../lib/useTimer';

type Tab = 'attention' | 'block' | 'breathe' | 'test';

export default function Focus() {
  const prog = useProgramme();
  const [tab, setTab] = useState<Tab>('block');
  const todays = useLiveQuery(
    () => (prog ? db.focusSessions.where('date').equals(prog.today).toArray() : []),
    [prog?.today],
  );
  if (!prog) return null;
  const focusMin = (todays ?? [])
    .filter((s) => s.kind === 'focus')
    .reduce((s, f) => s + f.actualMin, 0);
  const wanders = (todays ?? [])
    .filter((s) => s.kind === 'focus')
    .reduce((s, f) => s + (f.wanders ?? 0), 0);

  return (
    <Page
      title="Focus"
      subtitle={
        <>
          Attention is a trainable skill. Each noticed wander + return is one repetition.{' '}
          <HandbookLink path="modules/L1-focus-discipline.md">Why</HandbookLink>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Focused today" value={`${focusMin} min`} />
        <Stat label="Blocks" value={(todays ?? []).filter((s) => s.kind === 'focus').length} />
        <Stat label="Wanders noticed" value={wanders} />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'block', label: 'Focus block' },
          { id: 'attention', label: 'Attention training' },
          { id: 'breathe', label: 'Breathe' },
          { id: 'test', label: 'Focus test' },
        ]}
      />
      {tab === 'block' && (
        <FocusBlock date={prog.today} defaultMin={focusBlockMinutes(prog.state)} />
      )}
      {tab === 'attention' && (
        <AttentionTraining date={prog.today} defaultMin={attentionMinutes(prog.state)} />
      )}
      {tab === 'breathe' && <Breathe date={prog.today} />}
      {tab === 'test' && <FocusTest date={prog.today} />}
    </Page>
  );
}

async function saveSession(
  date: string,
  kind: SessionKind,
  data: Partial<Omit<Parameters<typeof db.focusSessions.add>[0], 'date' | 'kind'>> & {
    plannedMin: number;
    actualMin: number;
  },
) {
  await db.focusSessions.add({ date, kind, ...data });
}

function BigClock({ sec, running }: { sec: number; running: boolean }) {
  return (
    <div
      className={`my-4 text-center text-6xl font-semibold tabular-nums ${running ? '' : 'text-slate-400'} ${
        sec < 0 ? 'text-amber-600' : ''
      }`}
      aria-live="off"
    >
      {formatClock(sec)}
    </div>
  );
}

function FocusBlock({ date, defaultMin }: { date: string; defaultMin: number }) {
  const [minutes, setMinutes] = useState(defaultMin);
  const [intention, setIntention] = useState('');
  const [wanders, setWanders] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'running' | 'review'>('setup');
  const [quality, setQuality] = useState<number>();
  const [review, setReview] = useState('');
  const timer = useTimer(minutes * 60, () => bell(2));

  function finish() {
    timer.pause();
    setPhase('review');
  }
  async function save() {
    await saveSession(date, 'focus', {
      plannedMin: minutes,
      actualMin: Math.max(1, Math.round(timer.elapsedSec / 60)),
      intention,
      wanders,
      quality,
      review,
    });
    timer.reset();
    setWanders(0);
    setIntention('');
    setReview('');
    setQuality(undefined);
    setPhase('setup');
  }

  return (
    <Card title="Focus block">
      {phase === 'setup' && (
        <div className="space-y-4">
          <Field label="Intention — what does “done” look like for this block?">
            <input
              className="input"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g. Finish chapter 4 notes + 10 MCQs"
            />
          </Field>
          <div>
            <span className="label">Length</span>
            <div className="flex flex-wrap gap-2">
              {[25, 50, 90, 180].map((m) => (
                <button
                  key={m}
                  className={m === minutes ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <ul className="muted list-disc space-y-1 pl-5">
            <li>Phone in another room — not face-down on the desk.</li>
            <li>Each time you notice your mind has wandered, tap the button and return.</li>
          </ul>
          <button
            className="btn-primary w-full"
            disabled={!intention.trim()}
            onClick={() => (timer.start(), setPhase('running'))}
          >
            Start {minutes}-minute block
          </button>
        </div>
      )}
      {phase === 'running' && (
        <div>
          <p className="text-center text-sm font-medium">{intention}</p>
          <BigClock sec={timer.remainingSec} running={timer.running} />
          <button
            className="btn w-full bg-amber-500 py-4 text-base text-white hover:bg-amber-600"
            onClick={() => setWanders((w) => w + 1)}
          >
            I noticed a wander ({wanders})
          </button>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={timer.running ? timer.pause : timer.start}
            >
              {timer.running ? 'Pause' : 'Resume'}
            </button>
            <button className="btn-primary flex-1" onClick={finish}>
              {timer.remainingSec <= 0 ? 'Finish' : 'End early'}
            </button>
          </div>
        </div>
      )}
      {phase === 'review' && (
        <div className="space-y-4">
          <p className="text-sm">
            {Math.round(timer.elapsedSec / 60)} minutes · {wanders} wanders noticed.
          </p>
          <Scale
            label="Quality of the block"
            min={1}
            max={5}
            value={quality}
            onChange={setQuality}
            lowLabel="scattered"
            highLabel="deep"
          />
          <Field label="One-line review — done? what pulled you away?">
            <input className="input" value={review} onChange={(e) => setReview(e.target.value)} />
          </Field>
          <button className="btn-primary w-full" onClick={save}>
            Save block
          </button>
        </div>
      )}
    </Card>
  );
}

function AttentionTraining({ date, defaultMin }: { date: string; defaultMin: number }) {
  const [minutes, setMinutes] = useState(defaultMin);
  const [wanders, setWanders] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useTimer(
    minutes * 60,
    () => {
      bell(3);
      setDone(true);
    },
    { autoStop: true },
  );

  async function save() {
    await saveSession(date, 'attention', {
      plannedMin: minutes,
      actualMin: Math.max(1, Math.round(timer.elapsedSec / 60)),
      wanders,
    });
    timer.reset();
    setWanders(0);
    setDone(false);
  }

  return (
    <Card title="Attention training">
      <p className="muted mb-3">
        Sit upright. Attend to the sensation of breathing. When you notice you have wandered, tap
        once and return. The return is the training.
      </p>
      {!timer.running && timer.elapsedSec === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {[5, 10, 15, 20].map((m) => (
            <button
              key={m}
              className={m === minutes ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setMinutes(m)}
            >
              {m} min
            </button>
          ))}
        </div>
      )}
      <BigClock sec={timer.remainingSec} running={timer.running} />
      {done ? (
        <button className="btn-primary w-full" onClick={save}>
          Save session ({wanders} returns)
        </button>
      ) : timer.running ? (
        <div className="space-y-2">
          <button
            className="btn w-full bg-amber-500 py-6 text-base text-white hover:bg-amber-600"
            onClick={() => setWanders((w) => w + 1)}
          >
            Wandered — returning ({wanders})
          </button>
          <button className="btn-secondary w-full" onClick={() => (timer.pause(), setDone(true))}>
            Stop early
          </button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={timer.start}>
          Begin {minutes} minutes
        </button>
      )}
    </Card>
  );
}

const BREATH_PHASES = [
  { label: 'Inhale', sec: 2, scale: 1 },
  { label: 'Top-up inhale', sec: 1, scale: 1.15 },
  { label: 'Long exhale', sec: 6, scale: 0.6 },
];

function Breathe({ date }: { date: string }) {
  const [minutes, setMinutes] = useState(3);
  const [step, setStep] = useState(0);
  const timer = useTimer(minutes * 60, () => {
    bell(1);
    void stop(true);
  });
  const stepTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!timer.running) return;
    stepTimeout.current = window.setTimeout(
      () => setStep((s) => (s + 1) % BREATH_PHASES.length),
      BREATH_PHASES[step].sec * 1000,
    );
    return () => {
      if (stepTimeout.current) clearTimeout(stepTimeout.current);
    };
  }, [timer.running, step]);

  async function stop(completed: boolean) {
    timer.pause();
    const actual = Math.max(1, Math.round(timer.elapsedSec / 60));
    if (completed || timer.elapsedSec >= 30)
      await saveSession(date, 'breath', { plannedMin: minutes, actualMin: actual });
    timer.reset();
    setStep(0);
  }

  const p = BREATH_PHASES[step];
  return (
    <Card title="Cyclic sighing">
      <p className="muted mb-3">
        Two inhales through the nose (the second a short top-up), then a long, slow exhale through
        the mouth.
      </p>
      <div className="flex h-56 items-center justify-center">
        <div
          className="flex h-40 w-40 items-center justify-center rounded-full bg-brand-500/80 text-center text-sm font-semibold text-white"
          style={{
            transform: `scale(${timer.running ? p.scale : 0.8})`,
            transition: `transform ${timer.running ? p.sec : 0.3}s ease-in-out`,
          }}
        >
          {timer.running ? p.label : 'Ready'}
        </div>
      </div>
      {timer.running ? (
        <div className="space-y-2">
          <p className="muted text-center tabular-nums">{formatClock(timer.remainingSec)}</p>
          <button className="btn-secondary w-full" onClick={() => stop(false)}>
            Stop
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[1, 3, 5].map((m) => (
              <button
                key={m}
                className={m === minutes ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={timer.start}>
            Start
          </button>
        </div>
      )}
    </Card>
  );
}

const PROBE_MIN_SEC = 45;
const PROBE_MAX_SEC = 120;

function FocusTest({ date }: { date: string }) {
  const [minutes, setMinutes] = useState(10);
  const [probe, setProbe] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const answersRef = useRef<boolean[]>([]);
  const [result, setResult] = useState<number | null>(null);
  const timer = useTimer(minutes * 60, () => void finish());
  const nextProbe = useRef<number | null>(null);

  useEffect(() => {
    if (!timer.running || probe) return;
    const delay = (PROBE_MIN_SEC + Math.random() * (PROBE_MAX_SEC - PROBE_MIN_SEC)) * 1000;
    nextProbe.current = window.setTimeout(() => {
      bell(1);
      setProbe(true);
    }, delay);
    return () => {
      if (nextProbe.current) clearTimeout(nextProbe.current);
    };
  }, [timer.running, probe]);

  function answer(onTask: boolean) {
    answersRef.current = [...answersRef.current, onTask];
    setAnswers(answersRef.current);
    setProbe(false);
  }

  async function finish() {
    timer.pause();
    setProbe(false);
    const a = answersRef.current;
    const pct = a.length ? Math.round((a.filter(Boolean).length / a.length) * 100) : null;
    setResult(pct ?? -1);
    if (pct !== null)
      await saveSession(date, 'focustest', {
        plannedMin: minutes,
        actualMin: minutes,
        onTaskPct: pct,
      });
  }

  function restart() {
    answersRef.current = [];
    setAnswers([]);
    setResult(null);
    timer.reset();
  }

  return (
    <Card title="Focus test (monthly)">
      <p className="muted mb-3">
        Read demanding study material. At random moments a bell asks whether you were on task just
        before it rang. Answer honestly — the score is the share of “on task”.
      </p>
      {result !== null ? (
        <div className="space-y-3 text-center">
          {result >= 0 ? (
            <>
              <div className="text-4xl font-semibold">{result}% on task</div>
              <p className="muted">
                {answers.length} probes. Compare month to month, same time of day.
              </p>
            </>
          ) : (
            <p className="muted">
              No probes were answered, so nothing was saved. Try the full 10 minutes.
            </p>
          )}
          <button className="btn-secondary" onClick={restart}>
            Done
          </button>
        </div>
      ) : timer.running || timer.elapsedSec > 0 ? (
        <div className="space-y-3">
          <BigClock sec={timer.remainingSec} running={timer.running} />
          {probe ? (
            <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-center dark:bg-amber-950">
              <p className="font-semibold">Just before the bell — were you on task?</p>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => answer(true)}>
                  On task
                </button>
                <button className="btn-secondary flex-1" onClick={() => answer(false)}>
                  Mind wandering
                </button>
              </div>
            </div>
          ) : (
            <p className="muted text-center">Keep reading. {answers.length} probes answered.</p>
          )}
          <button className="btn-ghost w-full" onClick={finish}>
            End test now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[10, 20].map((m) => (
              <button
                key={m}
                className={m === minutes ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={timer.start}>
            Start focus test
          </button>
          <RecentTests />
        </div>
      )}
    </Card>
  );
}

function RecentTests() {
  const tests = useLiveQuery(
    () => db.focusSessions.where('kind').equals('focustest').reverse().limit(6).toArray(),
    [],
  );
  if (!tests?.length) return <Empty>No focus tests yet.</Empty>;
  return (
    <ul className="mt-4 space-y-1 text-sm">
      {tests.map((t) => (
        <li key={t.id} className="flex justify-between">
          <span>{t.date}</span>
          <span className="font-medium tabular-nums">{t.onTaskPct}% on task</span>
        </li>
      ))}
    </ul>
  );
}
