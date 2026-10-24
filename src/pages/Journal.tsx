import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DIMENSIONS, DIMENSION_BY_ID, type DimensionId } from '../content/dimensions';
import { EMOTION_GROUPS } from '../content/emotions';
import { MentorFeedback } from '../components/mentor';
import {
  Card,
  Empty,
  Field,
  HandbookLink,
  Notice,
  Page,
  Scale,
  Tabs,
  TextArea,
} from '../components/ui';
import { db } from '../lib/db';
import { addDays } from '../lib/dates';
import { recordActivity, useProgramme } from '../lib/hooks';
import { journalFeedback } from '../lib/mentor';

type Tab = 'tonight' | 'evidence' | 'woop' | 'stories' | 'dip';
const TABS: Tab[] = ['tonight', 'evidence', 'woop', 'stories', 'dip'];

export default function Journal() {
  const prog = useProgramme();
  // Deep links from the mentor, e.g. #/journal?tab=evidence.
  const [params] = useSearchParams();
  const asked = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(asked && TABS.includes(asked) ? asked : 'tonight');
  if (!prog) return null;
  return (
    <Page title="Journal" subtitle="Name it, learn from it, plan it. Ten minutes a night.">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tonight', label: 'Tonight' },
          { id: 'evidence', label: 'Evidence log' },
          { id: 'woop', label: 'WOOP' },
          { id: 'stories', label: 'Stories' },
          { id: 'dip', label: 'Motivation dip' },
        ]}
      />
      {tab === 'tonight' && <Tonight date={prog.today} />}
      {tab === 'evidence' && <Evidence date={prog.today} />}
      {tab === 'woop' && <WoopTab date={prog.today} />}
      {tab === 'stories' && <Stories date={prog.today} />}
      {tab === 'dip' && <DipCheck />}
    </Page>
  );
}

function Tonight({ date }: { date: string }) {
  const [win, setWin] = useState('');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [lesson, setLesson] = useState('');
  const [ifThen, setIfThen] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [feedback, setFeedback] = useState<string[]>([]);
  const entries = useLiveQuery(() => db.journal.orderBy('id').reverse().limit(10).toArray(), []);

  async function save() {
    await db.journal.add({ date, win, emotions, lesson, ifThen, gratitude });
    await recordActivity(date, 'journal');
    if (ifThen.trim()) await recordActivity(date, 'ifthen');
    const recent = await db.journal.where('date').aboveOrEqual(addDays(date, -6)).toArray();
    setFeedback(
      journalFeedback({
        count: await db.journal.count(),
        ifThen: !!ifThen.trim(),
        daysThisWeek: new Set(recent.map((e) => e.date)).size,
      }),
    );
    setWin('');
    setEmotions([]);
    setLesson('');
    setIfThen('');
    setGratitude('');
  }

  const toggle = (w: string) =>
    setEmotions((e) => (e.includes(w) ? e.filter((x) => x !== w) : [...e, w]));

  return (
    <>
      <Card title="Tonight’s reflection">
        <div className="space-y-4">
          <MentorFeedback lines={feedback} />
          <Field label="One win today (however small)">
            <input className="input" value={win} onChange={(e) => setWin(e.target.value)} />
          </Field>
          <div>
            <span className="label">Name what you felt — the most precise words</span>
            <div className="space-y-2">
              {EMOTION_GROUPS.map((g) => (
                <div key={g.group} className="flex flex-wrap items-center gap-1">
                  <span className="muted w-28 shrink-0 text-xs">{g.group}</span>
                  {g.words.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggle(w)}
                      className={`chip ${emotions.includes(w) ? 'border-brand-700 bg-brand-700 text-white' : ''}`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Field label="One lesson">
            <TextArea rows={2} value={lesson} onChange={(e) => setLesson(e.target.value)} />
          </Field>
          <Field label="Tomorrow’s if-then plan" hint="“If [obstacle], then I will [action].”">
            <input
              className="input"
              value={ifThen}
              onChange={(e) => setIfThen(e.target.value)}
              placeholder="If I want to check my phone during a block, then I will…"
            />
          </Field>
          <Field label="Gratitude (optional)">
            <input
              className="input"
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
            />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={!win.trim() && !lesson.trim() && !emotions.length}
            onClick={save}
          >
            Save reflection
          </button>
        </div>
      </Card>
      <Card title="Recent entries">
        {!entries?.length ? (
          <Empty>Your reflections will appear here.</Empty>
        ) : (
          <ul className="space-y-3 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-brand-500 pl-3">
                <div className="muted text-xs">
                  {e.date}
                  {e.emotions.length ? ` · ${e.emotions.join(', ')}` : ''}
                </div>
                {e.win && <div>✓ {e.win}</div>}
                {e.lesson && <div>💡 {e.lesson}</div>}
                {e.ifThen && <div>→ {e.ifThen}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Evidence({ date }: { date: string }) {
  const [dimension, setDimension] = useState<DimensionId>('discipline');
  const [text, setText] = useState('');
  const entries = useLiveQuery(() => db.evidence.orderBy('id').reverse().limit(30).toArray(), []);
  return (
    <>
      <Card title="Identity evidence">
        <p className="muted mb-3">
          “I am becoming someone who…” + the evidence. Read the last ten before a mock or an
          interview. <HandbookLink path="modules/L2-confidence-resilience.md">Why</HandbookLink>
        </p>
        <div className="space-y-3">
          <Field label="Dimension">
            <select
              className="input"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as DimensionId)}
            >
              {DIMENSIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evidence">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Kept my 6:00 wake time after a bad mock"
            />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={!text.trim()}
            onClick={async () => {
              await db.evidence.add({ date, dimension, text });
              await recordActivity(date, 'evidence');
              setText('');
            }}
          >
            Add evidence
          </button>
        </div>
      </Card>
      <Card title={`Your evidence (${entries?.length ?? 0})`}>
        {!entries?.length ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.id}>
                <span className="chip mr-2">{DIMENSION_BY_ID[e.dimension].name}</span>
                {e.text} <span className="muted text-xs">· {e.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function WoopTab({ date }: { date: string }) {
  const [w, setW] = useState({ wish: '', outcome: '', obstacle: '', plan: '' });
  const woops = useLiveQuery(() => db.woops.orderBy('id').reverse().toArray(), []);
  const complete = Object.values(w).every((v) => v.trim());
  return (
    <>
      <Card title="New WOOP">
        <p className="muted mb-3">
          Start every 2-week sprint with one. Imagine the outcome briefly — then face the inner
          obstacle honestly.{' '}
          <HandbookLink path="modules/L2-vision-identity.md">Why it works</HandbookLink>
        </p>
        <div className="space-y-3">
          <Field label="Wish — challenging but feasible, for this sprint">
            <input
              className="input"
              value={w.wish}
              onChange={(e) => setW({ ...w, wish: e.target.value })}
            />
          </Field>
          <Field label="Outcome — the best result; feel it briefly">
            <input
              className="input"
              value={w.outcome}
              onChange={(e) => setW({ ...w, outcome: e.target.value })}
            />
          </Field>
          <Field label="Obstacle — the main inner obstacle (habit, emotion, belief)">
            <input
              className="input"
              value={w.obstacle}
              onChange={(e) => setW({ ...w, obstacle: e.target.value })}
            />
          </Field>
          <Field label="Plan — If [obstacle], then I will [action]">
            <input
              className="input"
              value={w.plan}
              onChange={(e) => setW({ ...w, plan: e.target.value })}
            />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={!complete}
            onClick={async () => {
              await db.woops.add({ ...w, createdAt: date, active: true });
              setW({ wish: '', outcome: '', obstacle: '', plan: '' });
            }}
          >
            Save WOOP
          </button>
        </div>
      </Card>
      <Card title="Your WOOPs">
        {!woops?.length ? (
          <Empty>No WOOPs yet.</Empty>
        ) : (
          <ul className="space-y-3 text-sm">
            {woops.map((x) => (
              <li
                key={x.id}
                className={`rounded-xl border p-3 dark:border-slate-700 ${x.active ? '' : 'opacity-60'}`}
              >
                <div className="font-semibold">{x.wish}</div>
                <div className="muted text-xs">{x.createdAt}</div>
                <div className="mt-1">
                  <strong>If</strong> {x.obstacle} → {x.plan}
                </div>
                <button
                  className="btn-ghost mt-1 px-2 py-1 text-xs"
                  onClick={() => db.woops.update(x.id!, { active: !x.active })}
                >
                  {x.active ? 'Mark done' : 'Reactivate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stories({ date }: { date: string }) {
  const [s, setS] = useState({ situation: '', action: '', result: '', learned: '' });
  const stories = useLiveQuery(() => db.stories.orderBy('id').reverse().toArray(), []);
  return (
    <>
      <Card title="Leadership & field story">
        <p className="muted mb-3">
          True stories become your Essay examples, GS4 illustrations and interview answers.{' '}
          <HandbookLink path="modules/L4-leadership-integrity.md">More</HandbookLink>
        </p>
        <div className="space-y-3">
          {(
            [
              ['situation', 'Situation'],
              ['action', 'What you did'],
              ['result', 'Result'],
              ['learned', 'What you learned / would do differently'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <TextArea
                rows={2}
                value={s[k]}
                onChange={(e) => setS({ ...s, [k]: e.target.value })}
              />
            </Field>
          ))}
          <button
            className="btn-primary w-full"
            disabled={!s.situation.trim() || !s.action.trim()}
            onClick={async () => {
              await db.stories.add({ ...s, date });
              setS({ situation: '', action: '', result: '', learned: '' });
            }}
          >
            Save story
          </button>
        </div>
      </Card>
      <Card title={`Story bank (${stories?.length ?? 0})`}>
        {!stories?.length ? (
          <Empty>No stories yet — they come from service actions and leading your circle.</Empty>
        ) : (
          <ul className="space-y-3 text-sm">
            {stories.map((x) => (
              <li key={x.id} className="rounded-xl border p-3 dark:border-slate-700">
                <div className="muted text-xs">{x.date}</div>
                <p>
                  <strong>S:</strong> {x.situation}
                </p>
                <p>
                  <strong>A:</strong> {x.action}
                </p>
                {x.result && (
                  <p>
                    <strong>R:</strong> {x.result}
                  </p>
                )}
                {x.learned && (
                  <p>
                    <strong>L:</strong> {x.learned}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

const SOURCES = [
  {
    id: 'purpose',
    label: 'Purpose',
    question: 'How clear and alive is your “why” this week?',
    fix: 'Re-read and revise your purpose statement; spend 10 minutes on field reality (a district report, a news story about a problem you want to solve).',
  },
  {
    id: 'progress',
    label: 'Progress',
    question: 'How much do you feel you are getting better?',
    fix: 'Look at your 4-week trends in Progress; shrink the challenge so you succeed ~80% of days; log one small win every night.',
  },
  {
    id: 'connection',
    label: 'Connection',
    question: 'How connected do you feel to people who support you?',
    fix: 'Call your accountability partner today; join or run a study-circle session; have one honest conversation.',
  },
  {
    id: 'energy',
    label: 'Energy',
    question: 'How is your physical energy (sleep, food, exercise)?',
    fix: 'This is physiology, not character: protect sleep for 3 nights, exercise daily, eat properly, take a real rest half-day.',
  },
] as const;

function DipCheck() {
  const [r, setR] = useState<Record<string, number>>({});
  const done = SOURCES.every((s) => r[s.id]);
  const lowest = done ? [...SOURCES].sort((a, b) => r[a.id] - r[b.id])[0] : null;
  return (
    <Card title="Motivation dip diagnosis">
      <p className="muted mb-3">
        When motivation is low for 3+ days, find which source is lowest and fix that one.{' '}
        <HandbookLink path="modules/L2-motivation.md">Motivation engine</HandbookLink>
      </p>
      <div className="space-y-4">
        {SOURCES.map((s) => (
          <Scale
            key={s.id}
            label={`${s.label} — ${s.question}`}
            min={1}
            max={5}
            value={r[s.id]}
            onChange={(v) => setR({ ...r, [s.id]: v })}
            lowLabel="very low"
            highLabel="strong"
          />
        ))}
      </div>
      {lowest && (
        <div className="mt-4">
          <Notice tone="success">
            <strong>Lowest: {lowest.label}.</strong> {lowest.fix}
          </Notice>
        </div>
      )}
    </Card>
  );
}
