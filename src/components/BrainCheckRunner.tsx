import { useEffect, useRef, useState } from 'react';
import { checkSpan, digitSequence, SYMBOLS } from '../lib/brainCheck';
import type { BrainCheckEntry } from '../lib/db';
import { median } from '../lib/stats';
import { formatClock, useTimer } from '../lib/useTimer';

type Stage = 'intro' | 'rt' | 'symbol' | 'span-f' | 'span-b' | 'done';

const RT_TRIALS = 8;

export function BrainCheckRunner({
  onDone,
}: {
  onDone: (r: Omit<BrainCheckEntry, 'id' | 'date'>) => void;
}) {
  const [stage, setStage] = useState<Stage>('intro');
  const result = useRef<Partial<Omit<BrainCheckEntry, 'id' | 'date'>>>({});

  return (
    <div className="space-y-3">
      {stage === 'intro' && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Reaction time — tap as soon as the box turns green ({RT_TRIALS} trials).</li>
            <li>Symbol match — 60 seconds, tap the digit that matches each symbol.</li>
            <li>Digit span — remember digits forwards, then backwards.</li>
          </ol>
          <p className="muted text-xs">
            Same time of day each week, rested, no distractions. About 3 minutes.
          </p>
          <button className="btn-primary w-full" onClick={() => setStage('rt')}>
            Start Brain Check
          </button>
        </div>
      )}
      {stage === 'rt' && (
        <ReactionTime
          onDone={(ms) => {
            result.current.rtMedianMs = ms;
            setStage('symbol');
          }}
        />
      )}
      {stage === 'symbol' && (
        <SymbolMatch
          onDone={(correct, errors) => {
            result.current.symbolCorrect = correct;
            result.current.symbolErrors = errors;
            setStage('span-f');
          }}
        />
      )}
      {stage === 'span-f' && (
        <DigitSpan
          key="f"
          backward={false}
          onDone={(span) => {
            result.current.spanForward = span;
            setStage('span-b');
          }}
        />
      )}
      {stage === 'span-b' && (
        <DigitSpan
          key="b"
          backward
          onDone={(span) => {
            result.current.spanBackward = span;
            setStage('done');
            onDone(result.current as Omit<BrainCheckEntry, 'id' | 'date'>);
          }}
        />
      )}
      {stage === 'done' && <p className="text-center font-medium">Done — saved.</p>}
    </div>
  );
}

function ReactionTime({ onDone }: { onDone: (medianMs: number) => void }) {
  const [phase, setPhase] = useState<'wait' | 'go' | 'early'>('wait');
  const [times, setTimes] = useState<number[]>([]);
  const goAt = useRef(0);
  const timeout = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'wait') return;
    timeout.current = window.setTimeout(
      () => {
        goAt.current = performance.now();
        setPhase('go');
      },
      1500 + Math.random() * 2500,
    );
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [phase, times.length]);

  function tap() {
    if (phase === 'wait') {
      if (timeout.current) clearTimeout(timeout.current);
      setPhase('early');
      return;
    }
    if (phase === 'early') {
      setPhase('wait');
      return;
    }
    const next = [...times, performance.now() - goAt.current];
    setTimes(next);
    if (next.length >= RT_TRIALS) onDone(Math.round(median(next)!));
    else setPhase('wait');
  }

  return (
    <div>
      <p className="muted mb-2 text-center text-sm">
        Reaction time · trial {Math.min(times.length + 1, RT_TRIALS)} of {RT_TRIALS}
      </p>
      <button
        onPointerDown={tap}
        className={`flex h-56 w-full items-center justify-center rounded-2xl text-lg font-semibold text-white select-none ${
          phase === 'go' ? 'bg-emerald-500' : phase === 'early' ? 'bg-amber-500' : 'bg-slate-500'
        }`}
      >
        {phase === 'go'
          ? 'TAP!'
          : phase === 'early'
            ? 'Too soon — tap to retry'
            : 'Wait for green…'}
      </button>
    </div>
  );
}

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SymbolMatch({ onDone }: { onDone: (correct: number, errors: number) => void }) {
  const [key] = useState(() => shuffled(SYMBOLS));
  const [current, setCurrent] = useState(() => Math.floor(Math.random() * 9));
  const [correct, setCorrect] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const score = useRef({ correct: 0, errors: 0 });
  const timer = useTimer(60, () => onDone(score.current.correct, score.current.errors));

  useEffect(() => {
    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function answer(digit: number) {
    if (timer.remainingSec <= 0) return;
    const ok = digit === current + 1;
    if (ok) score.current.correct += 1;
    else score.current.errors += 1;
    setCorrect(score.current.correct);
    setErrors(score.current.errors);
    setFlash(ok ? 'ok' : 'bad');
    let next = Math.floor(Math.random() * 9);
    if (next === current) next = (next + 1) % 9;
    setCurrent(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="muted">Symbol match</span>
        <span className="tabular-nums">
          {formatClock(Math.max(0, timer.remainingSec))} · {correct} ✓{' '}
          {errors ? `· ${errors} ✗` : ''}
        </span>
      </div>
      <div className="grid grid-cols-9 gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-slate-800">
        {key.map((s, i) => (
          <div key={s}>
            <div className="text-xl">{s}</div>
            <div className="text-xs font-semibold">{i + 1}</div>
          </div>
        ))}
      </div>
      <div
        className={`flex h-24 items-center justify-center rounded-xl text-5xl transition ${
          flash === 'bad'
            ? 'bg-rose-100 dark:bg-rose-950'
            : flash === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950'
              : ''
        }`}
      >
        {key[current]}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onPointerDown={() => answer(i + 1)}
            className="btn-secondary py-4 text-lg select-none"
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function DigitSpan({ backward, onDone }: { backward: boolean; onDone: (span: number) => void }) {
  const [length, setLength] = useState(backward ? 2 : 3);
  const [seq, setSeq] = useState<number[]>(() => digitSequence(backward ? 2 : 3));
  const [shown, setShown] = useState(-1); // index being displayed; seq.length = input stage
  const [answer, setAnswer] = useState('');
  const [best, setBest] = useState(0);
  const [fails, setFails] = useState(0);

  useEffect(() => {
    if (shown >= seq.length) return;
    const id = window.setTimeout(() => setShown((s) => s + 1), shown < 0 ? 800 : 1000);
    return () => clearTimeout(id);
  }, [shown, seq.length]);

  function submit() {
    const ok = checkSpan(seq, answer, backward);
    let nextLen = length;
    if (ok) {
      setBest(length);
      setFails(0);
      nextLen = length + 1;
    } else if (fails + 1 >= 2) {
      onDone(best);
      return;
    } else {
      setFails(fails + 1);
    }
    if (nextLen > 12) {
      onDone(length);
      return;
    }
    setLength(nextLen);
    setSeq(digitSequence(nextLen));
    setAnswer('');
    setShown(-1);
  }

  const showing = shown >= 0 && shown < seq.length;
  return (
    <div className="space-y-3 text-center">
      <p className="muted text-sm">
        Digit span {backward ? 'backward — type them in reverse order' : 'forward'} · {length}{' '}
        digits
      </p>
      <div className="flex h-28 items-center justify-center text-6xl font-semibold tabular-nums">
        {showing ? seq[shown] : shown < 0 ? '…' : ''}
      </div>
      {shown >= seq.length && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            className="input text-center text-xl tracking-widest"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Digits"
          />
          <button className="btn-primary" type="submit">
            OK
          </button>
        </form>
      )}
    </div>
  );
}
