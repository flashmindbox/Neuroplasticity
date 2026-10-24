import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiPanel } from '../components/AiPanel';
import { MentorFeedback } from '../components/mentor';
import { Card, Empty, Field, HandbookLink, Notice, Page, Scale, TextArea } from '../components/ui';
import { pickForDay, TALK_RUBRIC, TALK_TOPICS } from '../content/drills';
import { db, type TalkEntry } from '../lib/db';
import { recordActivity, useProgramme } from '../lib/hooks';
import { talkFeedback } from '../lib/mentor';
import { countFillers, wordsPerMinute } from '../lib/talk';
import { formatClock, useTimer } from '../lib/useTimer';

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;
const SpeechRecognitionImpl: RecognitionCtor | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, RecognitionCtor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, RecognitionCtor | undefined>).webkitSpeechRecognition)
    : undefined;

export default function Speak() {
  const prog = useProgramme();
  if (!prog) return null;
  return (
    <Page
      title="Speak"
      subtitle={
        <>
          30 seconds to plan (Point–Reason–Example–Point), 2 minutes to speak, then listen back.{' '}
          <HandbookLink path="modules/L4-communication.md">Why</HandbookLink>
        </>
      }
    >
      <Recorder date={prog.today} />
      <TalkHistory />
    </Page>
  );
}

function Recorder({ date }: { date: string }) {
  const [salt, setSalt] = useState(0);
  const [custom, setCustom] = useState('');
  const prompt = custom.trim() || pickForDay(TALK_TOPICS, date, salt) || '';
  const [transcribe, setTranscribe] = useState(Boolean(SpeechRecognitionImpl));
  const [state, setState] = useState<'idle' | 'planning' | 'recording' | 'review'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [audio, setAudio] = useState<Blob | undefined>();
  const [durationSec, setDurationSec] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const saved = useLiveQuery(() => (savedId ? db.talks.get(savedId) : undefined), [savedId]);
  const audioUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio]);
  useEffect(() => () => void (audioUrl && URL.revokeObjectURL(audioUrl)), [audioUrl]);

  const plan = useTimer(30, () => void startRecording());
  const talk = useTimer(120);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      recognition.current?.stop();
    },
    [],
  );

  async function startRecording() {
    plan.reset();
    setError(null);
    setTranscript('');
    setInterim('');
    chunks.current = [];
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream.current);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => setAudio(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }));
      rec.start();
      recorder.current = rec;
    } catch {
      setError(
        'Microphone unavailable or blocked. You can still speak, then type a summary transcript.',
      );
    }
    if (transcribe && SpeechRecognitionImpl) {
      const r = new SpeechRecognitionImpl();
      r.lang = 'en-IN';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let finalText = '';
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript + ' ';
          else interimText += res[0].transcript;
        }
        if (finalText) setTranscript((t) => (t + ' ' + finalText).trim());
        setInterim(interimText);
      };
      r.onend = () => {
        // Chrome stops recognition after silences; restart while still recording.
        if (recognition.current === r) {
          try {
            r.start();
          } catch {
            /* already started */
          }
        }
      };
      recognition.current = r;
      try {
        r.start();
      } catch {
        /* ignore */
      }
    }
    talk.start();
    setState('recording');
  }

  function stopRecording() {
    talk.pause();
    setDurationSec(talk.elapsedSec);
    const r = recognition.current;
    recognition.current = null;
    r?.stop();
    recorder.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    setInterim('');
    setState('review');
  }

  const wpm = wordsPerMinute(transcript, durationSec);
  const fillers = countFillers(transcript);
  const fillersPerMin =
    durationSec >= 10 ? Math.round((fillers / (durationSec / 60)) * 10) / 10 : null;
  const allScored = TALK_RUBRIC.every((c) => scores[c]);

  async function save() {
    const earlier = await db.talks.toArray();
    const entry: TalkEntry = {
      date,
      prompt,
      audio,
      durationSec,
      transcript,
      wpm,
      fillers,
      selfScores: scores,
    };
    const id = await db.talks.add(entry);
    await recordActivity(date, 'talk');
    setFeedback(talkFeedback(entry, earlier));
    setSavedId(id as number);
  }

  function reset() {
    talk.reset();
    setState('idle');
    setAudio(undefined);
    setTranscript('');
    setScores({});
    setSavedId(null);
    setSalt((s) => s + 1);
    setCustom('');
  }

  return (
    <Card title="Recorded talk">
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-[15px] font-medium dark:bg-slate-800">
        {prompt}
      </div>
      {state === 'idle' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => setSalt((s) => s + 1)}>
              ↻ Another topic
            </button>
            <input
              className="input max-w-sm flex-1"
              placeholder="…or your own topic"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
          {SpeechRecognitionImpl ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-700"
                checked={transcribe}
                onChange={(e) => setTranscribe(e.target.checked)}
              />
              <span>
                Live transcript using your browser’s speech service (in Chrome, audio is processed
                by Google). Untick to type the transcript yourself.
              </span>
            </label>
          ) : (
            <Notice>
              Live transcription isn’t available in this browser — you can type a transcript after
              recording.
            </Notice>
          )}
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={() => (plan.start(), setState('planning'))}
            >
              Plan 30 s, then record
            </button>
            <button className="btn-primary flex-1" onClick={startRecording}>
              Record now
            </button>
          </div>
        </div>
      )}
      {state === 'planning' && (
        <div className="space-y-3 text-center">
          <p className="muted">Plan: Point – Reason – Example – Point</p>
          <div className="text-5xl font-semibold tabular-nums">
            {formatClock(plan.remainingSec)}
          </div>
          <button className="btn-primary w-full" onClick={startRecording}>
            Start speaking now
          </button>
        </div>
      )}
      {state === 'recording' && (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 text-rose-600">
            <span className="h-3 w-3 animate-pulse rounded-full bg-rose-600" /> Recording
          </div>
          <div
            className={`text-5xl font-semibold tabular-nums ${talk.remainingSec < 0 ? 'text-amber-600' : ''}`}
          >
            {formatClock(talk.elapsedSec)}
          </div>
          {transcribe && (
            <p className="min-h-12 text-left text-sm">
              {transcript} <span className="text-slate-400">{interim}</span>
            </p>
          )}
          <button className="btn-primary w-full" onClick={stopRecording}>
            Stop
          </button>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {state === 'review' && !savedId && (
        <div className="space-y-4">
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          <Field label="Transcript (edit if the speech service misheard)">
            <TextArea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="card p-2">
              <div className="muted text-xs">Duration</div>
              {formatClock(durationSec)}
            </div>
            <div className="card p-2">
              <div className="muted text-xs">Words / min</div>
              {wpm ?? '–'}
            </div>
            <div className="card p-2">
              <div className="muted text-xs">Fillers / min</div>
              {fillersPerMin ?? '–'}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Score yourself after listening back (1–5)</h3>
            {TALK_RUBRIC.map((c) => (
              <Scale
                key={c}
                label={c}
                min={1}
                max={5}
                value={scores[c]}
                onChange={(v) => setScores((s) => ({ ...s, [c]: v }))}
              />
            ))}
          </div>
          <button className="btn-primary w-full" disabled={!allScored} onClick={save}>
            Save talk
          </button>
        </div>
      )}
      {saved && (
        <div className="space-y-3">
          <MentorFeedback lines={['Talk saved.', ...feedback]} />
          <AiPanel
            existing={saved.ai}
            selfScores={saved.selfScores}
            build={() => ({
              kind: 'talk',
              title: 'Recorded 2-minute talk',
              instructions:
                '30 seconds to plan (Point–Reason–Example–Point), then speak for about 2 minutes.',
              prompt: saved.prompt,
              response: saved.transcript,
              rubric: TALK_RUBRIC,
              metrics: { wpm: saved.wpm, fillersPerMin },
            })}
            onResult={async (ai) => {
              await db.talks.update(saved.id!, { ai });
            }}
          />
          <button className="btn-secondary w-full" onClick={reset}>
            New talk
          </button>
        </div>
      )}
    </Card>
  );
}

function TalkHistory() {
  const talks = useLiveQuery(() => db.talks.orderBy('id').reverse().limit(10).toArray(), []);
  return (
    <Card title="Recent talks">
      {!talks?.length ? (
        <Empty>No talks yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {talks.map((t) => (
            <TalkRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TalkRow({ t }: { t: TalkEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const avg = (s: Record<string, number>) => {
    const v = Object.values(s);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
  };
  return (
    <li className="space-y-1 py-2 text-sm">
      <div className="flex justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{t.prompt}</span>
        <span className="shrink-0 text-xs tabular-nums">
          {t.wpm ?? '–'} wpm · you {avg(t.selfScores)}
          {t.ai ? ` · AI ${avg(t.ai.scores)}` : ''}
        </span>
      </div>
      <div className="muted text-xs">{t.date}</div>
      {t.audio &&
        (url ? (
          <audio controls src={url} className="w-full" />
        ) : (
          <button
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setUrl(URL.createObjectURL(t.audio!))}
          >
            ▶ Load recording
          </button>
        ))}
    </li>
  );
}
