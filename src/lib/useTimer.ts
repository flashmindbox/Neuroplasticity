import { useCallback, useEffect, useRef, useState } from 'react';

/** Wall-clock based stopwatch/countdown that survives slow ticks and background tabs. */
export function useTimer(totalSec: number, onFinish?: () => void, { autoStop = false } = {}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);
  const banked = useRef(0);
  const finished = useRef(false);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const ms = banked.current + (Date.now() - (startedAt.current ?? Date.now()));
      setElapsedMs(ms);
      if (!finished.current && ms >= totalSec * 1000) {
        finished.current = true;
        if (autoStop) {
          banked.current = ms;
          startedAt.current = null;
          setRunning(false);
        }
        finishRef.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, totalSec, autoStop]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setRunning(true);
  }, []);
  const pause = useCallback(() => {
    if (startedAt.current != null) banked.current += Date.now() - startedAt.current;
    startedAt.current = null;
    setRunning(false);
  }, []);
  const reset = useCallback(() => {
    banked.current = 0;
    startedAt.current = null;
    finished.current = false;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  return { elapsedSec, remainingSec: totalSec - elapsedSec, running, start, pause, reset };
}

export function formatClock(sec: number): string {
  const sign = sec < 0 ? '+' : '';
  const s = Math.abs(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${sign}${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}
