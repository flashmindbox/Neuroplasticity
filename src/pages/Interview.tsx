import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, HandbookLink, Notice, Page } from '../components/ui';
import { AiError, createClient } from '../lib/ai/client';
import {
  boardDebrief,
  boardSystemPrompt,
  boardTurn,
  INTERVIEW_ENDED,
  OPENING_MESSAGE,
} from '../lib/ai/interview';
import { db, type InterviewMessage, type InterviewSession } from '../lib/db';
import { useProgramme } from '../lib/hooks';
import { EMPTY_PROFILE, setSetting, useSetting } from '../lib/settings';

export default function Interview() {
  const prog = useProgramme();
  const apiKey = useSetting('apiKey');
  const acknowledged = useSetting('aiAcknowledged');
  const charter = useSetting('charter');
  const sessions = useLiveQuery(() => db.interviews.orderBy('id').reverse().toArray(), []);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = sessions?.find((s) => s.id === activeId) ?? null;

  if (!prog || apiKey === undefined || !sessions) return null;

  async function start() {
    const profile = charter?.profile ?? EMPTY_PROFILE;
    const id = await db.interviews.add({
      date: prog!.today,
      system: boardSystemPrompt(profile),
      messages: [{ role: 'user', content: OPENING_MESSAGE }],
    });
    setActiveId(id as number);
  }

  return (
    <Page
      title="Mock board"
      subtitle={
        <>
          A practice Personality Test from your profile, then a candid debrief.{' '}
          <HandbookLink path="modules/L4-communication.md">Communication & presence</HandbookLink>
        </>
      }
    >
      {!apiKey ? (
        <Notice>
          The mock board needs your Anthropic API key —{' '}
          <Link className="underline" to="/settings">
            add it in Settings
          </Link>
          .
        </Notice>
      ) : !acknowledged ? (
        <Notice>
          Your answers in the mock board are sent to Anthropic’s API using your key. A full
          interview with debrief typically costs well under a US dollar.{' '}
          <button className="underline" onClick={() => setSetting('aiAcknowledged', true)}>
            I understand
          </button>
        </Notice>
      ) : active ? (
        <Board session={active} apiKey={apiKey} onClose={() => setActiveId(null)} />
      ) : (
        <Card title="New interview">
          {!charter?.profile?.homeState && (
            <div className="mb-3">
              <Notice>
                Fill your profile in the{' '}
                <Link className="underline" to="/charter">
                  Charter
                </Link>{' '}
                so the board can ask about your home state, education and hobbies.
              </Notice>
            </div>
          )}
          <p className="muted mb-3">
            About 15 questions. Answer as you would in the room — then ask for the debrief.
          </p>
          <button className="btn-primary w-full" onClick={start}>
            Enter the board room
          </button>
        </Card>
      )}

      {!active && (
        <Card title="Past interviews">
          {sessions.length === 0 ? (
            <Empty>No interviews yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {s.date} · {s.messages.filter((m) => m.role === 'assistant').length} questions
                    {s.debrief ? ` · avg ${avgScore(s.debrief.scores)}/5` : ''}
                  </span>
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => setActiveId(s.id!)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Page>
  );
}

const avgScore = (s: Record<string, number>) => {
  const v = Object.values(s);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
};

function Board({
  session,
  apiKey,
  onClose,
}: {
  session: InterviewSession;
  apiKey: string;
  onClose: () => void;
}) {
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const last = session.messages[session.messages.length - 1];
  const ended = session.messages.some(
    (m) => m.role === 'assistant' && INTERVIEW_ENDED.test(m.content),
  );

  async function ask(messages: InterviewMessage[]) {
    setBusy(true);
    setError(null);
    setStreaming('');
    try {
      const turn = await boardTurn(createClient(apiKey), session.system, messages, (d) =>
        setStreaming((s) => s + d),
      );
      await db.interviews.update(session.id!, {
        messages: [...messages, { role: 'assistant', content: turn.text, raw: turn.raw }],
      });
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setStreaming('');
      setBusy(false);
    }
  }

  // A new session (or one interrupted before the board replied) needs the board's next turn.
  useEffect(() => {
    if (!started.current && last.role === 'user' && !session.debrief) {
      started.current = true;
      void ask(session.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not return one.
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages.length, streaming]);

  async function send() {
    const text = answer.trim();
    if (!text) return;
    const messages: InterviewMessage[] = [...session.messages, { role: 'user', content: text }];
    await db.interviews.update(session.id!, { messages });
    setAnswer('');
    await ask(messages);
  }

  async function debrief() {
    setBusy(true);
    setError(null);
    try {
      const d = await boardDebrief(createClient(apiKey), session.messages);
      await db.interviews.update(session.id!, { debrief: d });
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onClose}>
          ← All interviews
        </button>
        {!session.debrief && (
          <button className="btn-secondary" disabled={busy} onClick={debrief}>
            End & get debrief
          </button>
        )}
      </div>
      <Card>
        <div className="space-y-3">
          {session.messages.slice(1).map((m, i) => (
            <div key={i} className={m.role === 'assistant' ? 'pr-8' : 'pl-8 text-right'}>
              <div
                className={`inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap ${
                  m.role === 'assistant'
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'bg-brand-700 text-white'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="pr-8">
              <div className="inline-block rounded-2xl bg-slate-100 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-slate-800">
                {streaming}
              </div>
            </div>
          )}
          {busy && !streaming && <p className="muted text-sm">The board is considering…</p>}
          <div ref={bottom} />
        </div>
      </Card>
      {error && (
        <Notice tone="warning">
          {error}{' '}
          {last.role === 'user' && (
            <button className="underline" onClick={() => ask(session.messages)}>
              Retry
            </button>
          )}
        </Notice>
      )}
      {!session.debrief && !ended && last.role === 'assistant' && (
        <div className="flex gap-2">
          <textarea
            className="input flex-1"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
            disabled={busy}
          />
          <button className="btn-primary self-end" disabled={busy || !answer.trim()} onClick={send}>
            Answer
          </button>
        </div>
      )}
      {ended && !session.debrief && (
        <Notice tone="success">The board has finished. Ask for your debrief.</Notice>
      )}
      {session.debrief && (
        <Card
          title="Debrief"
          aside={<span className="chip">avg {avgScore(session.debrief.scores)}/5</span>}
        >
          <table className="mb-3 w-full text-sm">
            <tbody>
              {Object.entries(session.debrief.scores).map(([c, s]) => (
                <tr key={c} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1">{c}</td>
                  <td className="py-1 text-right font-semibold tabular-nums">{s}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-2 text-sm">{session.debrief.summary}</p>
          <h3 className="text-sm font-semibold">Strengths</h3>
          <ul className="mb-2 list-disc pl-5 text-sm">
            {session.debrief.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h3 className="text-sm font-semibold">Improve next time</h3>
          <ul className="list-disc pl-5 text-sm">
            {session.debrief.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="muted mt-3 text-xs">
            A practice signal from an AI, not a prediction of your real board. Use it to choose what
            to rehearse.
          </p>
        </Card>
      )}
    </>
  );
}
