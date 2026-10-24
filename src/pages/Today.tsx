import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DIMENSION_BY_ID, type DimensionId } from '../content/dimensions';
import { SETUP_TASKS, weeklyProtocol, type ProtocolItem } from '../content/protocol';
import { PHASES, type PhaseState } from '../content/roadmap';
import {
  ChoiceRow,
  HighlightRow,
  LockedRow,
  MentorAvatar,
  MilestoneRow,
} from '../components/mentor';
import { Card, Field, HandbookLink, Notice, Page, Scale } from '../components/ui';
import { Welcome } from '../components/Welcome';
import { db, type DailyLog } from '../lib/db';
import { addDays, dayOfWeek, daysBetween, formatKey, weekStart, type DateKey } from '../lib/dates';
import {
  patchDailyLog,
  plannedIds,
  recordActivity,
  skipStep,
  toggleCheck,
  useHour,
  useOptimistic,
  useProgramme,
  useProgressData,
  type ProgressData,
} from '../lib/hooks';
import {
  CLARITY_CHOICES,
  CLOSE_STEP,
  dayItems,
  ENERGY_CHOICES,
  EXERCISE_CHOICES,
  EXERCISE_DONE_MIN,
  expectation,
  formatMinutes,
  greeting,
  HABIT_IDS,
  MODE_INFO,
  modeOf,
  modePatch,
  MOOD_CHOICES,
  mentorNote,
  milestones,
  nearestChoice,
  nextMilestone,
  nextStep,
  planExplanation,
  progressHighlights,
  SLEEP_CHOICES,
  STRESS_CHOICES,
  suggestPlan,
  TARGET_ROUTE,
  topHighlights,
  type DayMode,
  type Step,
} from '../lib/mentor';
import { evaluateRules, type Alert } from '../lib/rules';
import { setSetting, useSetting, type SettingsMap } from '../lib/settings';
import { completionRatio, neverMissTwiceChain } from '../lib/streak';

export default function Today() {
  const prog = useProgramme();
  const hour = useHour();
  const charter = useSetting('charter');
  const onboarded = useSetting('onboarded');
  const setupDone = useSetting('setupDone');
  const weeklyDone = useSetting('weeklyDone');
  const lastBackupAt = useSetting('lastBackupAt');
  // null = nothing logged yet today; undefined = still loading.
  const log = useLiveQuery(
    async () => (prog ? ((await db.dailyLogs.get(prog.today)) ?? null) : undefined),
    [prog?.today],
  );
  const screenings = useLiveQuery(() => db.screenings.toArray(), []);
  const ratings = useLiveQuery(() => db.ratings.toArray(), []);
  const lastIfThen = useLiveQuery(async () => {
    if (!prog) return null;
    const rows = await db.journal.where('date').equals(addDays(prog.today, -1)).toArray();
    return (
      rows
        .reverse()
        .find((r) => r.ifThen.trim())
        ?.ifThen.trim() ?? null
    );
  }, [prog?.today]);

  const targets = useMemo(() => charter?.targets ?? [], [charter]);
  const data = useProgressData(prog, targets);

  const derived = useMemo(() => {
    if (!prog || !data) return null;
    const logs = new Map<DateKey, DailyLog>(data.logs.map((l) => [l.date, l]));
    const planned = (d: DateKey) => plannedIds(d, prog.dates, targets);
    const chain = neverMissTwiceChain(prog.today, prog.dates.programmeStart, data.statusOf);
    return { logs, planned, chain };
  }, [prog, data, targets]);

  const alerts: Alert[] = useMemo(() => {
    if (!prog || !derived || !data || !screenings || !ratings || lastBackupAt === undefined)
      return [];
    return evaluateRules({
      today: prog.today,
      programmeStart: prog.dates.programmeStart,
      logs: derived.logs,
      completionOf: (d) => completionRatio(derived.logs.get(d), derived.planned(d)),
      doubleMissNow: derived.chain.doubleMissNow,
      screenings,
      brainChecks: data.brainChecks,
      ratings,
      targets,
      lastBackupAt,
      deload: prog.state.deload,
      taper: prog.state.taper,
    });
  }, [prog, derived, data, screenings, ratings, targets, lastBackupAt]);

  if (
    !prog ||
    !derived ||
    !data ||
    log === undefined ||
    charter === undefined ||
    onboarded === undefined ||
    lastIfThen === undefined
  )
    return null;
  if (!onboarded && !charter) return <Welcome />;

  const { today, state } = prog;
  const todayLog = log ?? undefined;
  const mode = modeOf(todayLog);
  const items = dayItems(today, state, mode);
  const dayTargets = mode === 'minimum' ? [] : targets;
  const step = nextStep({ hour, items, targets: dayTargets, log: todayLog });
  const checks = todayLog?.checks ?? {};
  const planIds = [...items.map((i) => i.id), ...dayTargets.map((t) => `target-${t}`)];
  const doneCount = planIds.filter((id) => checks[id]).length;
  const dayNumber = daysBetween(prog.dates.programmeStart, today) + 1;
  const yesterday = addDays(today, -1);
  const note = mentorNote({
    today,
    dayNumber,
    chainLength: derived.chain.length,
    doubleMissNow: derived.chain.doubleMissNow,
    missedYesterday:
      yesterday >= prog.dates.programmeStart && data.statusOf(yesterday) === 'missed',
    reviewDue: dayOfWeek(today) === 0 && !weeklyDone?.[weekStart(today)]?.review,
    state,
    step,
  });
  const urgent = alerts.filter((a) => a.level !== 'info');
  // The mentor's note and the check-in already handle a double miss.
  const info = alerts.filter((a) => a.level === 'info' && a.id !== 'double-miss');

  return (
    <Page
      title={greeting(hour, charter?.profile.name)}
      subtitle={
        <>
          {formatKey(today, { weekday: 'short', day: 'numeric', month: 'short' })} · Day {dayNumber}{' '}
          · {PHASES[state.phase].name}
          {state.daysToPrelims >= 0 && <> · {state.daysToPrelims} days to Prelims</>}
        </>
      }
    >
      {urgent.map((a) => (
        <Notice key={a.id} tone={a.level === 'crisis' ? 'crisis' : 'warning'}>
          <strong>{a.title}.</strong> {a.action}{' '}
          {a.route && (
            <Link className="underline" to={a.route}>
              More
            </Link>
          )}
        </Notice>
      ))}

      <MentorCard
        note={note}
        plan={todayLog?.planReason}
        info={info}
        chain={derived.chain.length}
      />

      <NextStepCard
        key={step.kind + step.id}
        step={step}
        date={today}
        log={todayLog}
        items={items}
        done={doneCount}
        total={planIds.length}
        purpose={charter?.purpose ?? ''}
        lastIfThen={lastIfThen}
        doubleMiss={derived.chain.doubleMissNow}
        summary={daySummary(data, today)}
      />

      <PlanCard
        date={today}
        log={todayLog}
        mode={mode}
        items={items}
        targets={dayTargets}
        done={doneCount}
        total={planIds.length}
      />

      {state.week <= 6 && <MissionCard setupDone={setupDone ?? {}} charter={charter} />}

      <ProgressCard data={data} dayNumber={dayNumber} />

      <WeekCard today={today} state={state} weeklyDone={weeklyDone ?? {}} />

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">
          Detailed log <span className="muted font-normal">(optional, exact numbers)</span>
        </summary>
        <div className="mt-4">
          <QuickLog date={today} log={todayLog} />
        </div>
      </details>
    </Page>
  );
}

function daySummary(data: ProgressData, today: DateKey): string[] {
  const sessions = data.sessions.filter((s) => s.date === today);
  const blocks = sessions.filter((s) => s.kind === 'focus');
  const minutes = blocks.reduce((n, s) => n + s.actualMin, 0);
  const reps = sessions
    .filter((s) => s.kind !== 'breath')
    .reduce((n, s) => n + (s.wanders ?? 0), 0);
  const drills = data.drills.filter((d) => d.date === today).length;
  const talks = data.talks.filter((t) => t.date === today).length;
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  return [
    blocks.length ? `${formatMinutes(minutes)} of deep focus in ${n(blocks.length, 'block')}` : '',
    reps ? `${n(reps, 'attention rep')}` : '',
    drills ? n(drills, 'thinking drill') : '',
    talks ? n(talks, 'recorded talk') : '',
  ].filter(Boolean);
}

function MentorCard({
  note,
  plan,
  info,
  chain,
}: {
  note: string;
  plan?: string;
  info: Alert[];
  chain: number;
}) {
  return (
    <section
      aria-label="Your mentor"
      className="flex gap-3 rounded-2xl bg-brand-700 p-4 text-white shadow-sm"
    >
      <MentorAvatar className="h-10 w-10" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] leading-snug">{note}</p>
        {plan && <p className="text-sm leading-snug font-medium text-brand-50">{plan}</p>}
        {info.length > 0 && (
          <ul className="space-y-1 text-sm text-brand-50">
            {info.map((a) => (
              <li key={a.id}>
                <strong>{a.title}.</strong> {a.action}{' '}
                {a.route && (
                  <Link className="underline" to={a.route}>
                    More
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {chain > 1 && (
          <p className="text-xs text-brand-100">
            Showing up: {chain} days in a row. A single missed day doesn’t break it — two do.
          </p>
        )}
      </div>
    </section>
  );
}

function NextStepCard({
  step,
  date,
  log,
  items,
  done,
  total,
  purpose,
  lastIfThen,
  doubleMiss,
  summary,
}: {
  step: Step;
  date: DateKey;
  log: DailyLog | undefined;
  items: ProtocolItem[];
  done: number;
  total: number;
  purpose: string;
  lastIfThen: string | null;
  doubleMiss: boolean;
  summary: string[];
}) {
  const [closing, setClosing] = useState(false);
  const view = closing ? CLOSE_STEP : step;
  const target = view.id.startsWith('target-')
    ? DIMENSION_BY_ID[view.id.slice('target-'.length) as DimensionId]
    : null;
  return (
    <section
      aria-labelledby="next-step-title"
      className="rounded-2xl border-2 border-brand-600 bg-white p-4 shadow-sm dark:border-brand-500 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-200">
          {view.kind === 'done' ? 'Today' : 'Next step'}
        </span>
        <span className="muted text-xs tabular-nums">
          {done} of {total} done today
        </span>
      </div>
      <h2 id="next-step-title" className="mt-1 text-xl font-semibold">
        {view.title}
      </h2>
      <p className="muted mt-1">
        {view.minutes && !view.title.includes(`${view.minutes} min`) ? (
          <span className="chip mr-2 align-middle">≈ {view.minutes} min</span>
        ) : null}
        {view.why}
      </p>
      {target && (
        <p className="mt-1 text-xs">
          <HandbookLink path={target.module}>Why this matters</HandbookLink>
        </p>
      )}

      {view.kind === 'checkin' && <CheckInForm date={date} log={log} doubleMiss={doubleMiss} />}
      {view.kind === 'briefing' && (
        <Briefing date={date} log={log} purpose={purpose} lastIfThen={lastIfThen} />
      )}
      {view.kind === 'task' && (
        <div className="mt-4 space-y-2">
          {view.route && (
            <Link to={view.route} className="btn-primary w-full py-3 text-base">
              {view.cta ?? 'Open'} →
            </Link>
          )}
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={() => toggleCheck(date, view.id, true)}
            >
              {view.route ? 'Already done' : 'Mark done'}
            </button>
            <button className="btn-ghost flex-1" onClick={() => skipStep(date, view.id)}>
              Not today
            </button>
          </div>
        </div>
      )}
      {view.kind === 'study' && (
        <div className="mt-4 space-y-2">
          <Link to="/focus" className="btn-primary w-full py-3 text-base">
            Start a focus block →
          </Link>
          <button className="btn-secondary w-full" onClick={() => setClosing(true)}>
            Close the day now
          </button>
        </div>
      )}
      {view.kind === 'close' && <CloseDay date={date} log={log} items={items} />}
      {view.kind === 'done' && (
        <div className="mt-3 space-y-3">
          {summary.length ? (
            <ul className="space-y-1 text-sm">
              {summary.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">You showed up today — that is the habit that matters most.</p>
          )}
          <Link to="/progress" className="btn-secondary w-full">
            See your progress →
          </Link>
        </div>
      )}
    </section>
  );
}

/** Only fields the person actually changed are saved, so exact numbers from the detailed log survive. */
function changed<T>(initial: T, current: T) {
  return initial !== current;
}

function CheckInForm({
  date,
  log,
  doubleMiss,
}: {
  date: DateKey;
  log: DailyLog | undefined;
  doubleMiss: boolean;
}) {
  const initial = {
    sleep: nearestChoice(SLEEP_CHOICES, log?.sleepHours),
    energy: nearestChoice(ENERGY_CHOICES, log?.energy),
    stress: nearestChoice(STRESS_CHOICES, log?.stress),
    mood: nearestChoice(MOOD_CHOICES, log?.mood),
  };
  const [v, setV] = useState(initial);
  const complete = v.sleep != null && v.energy != null && v.stress != null && v.mood != null;

  async function save() {
    if (!complete) return;
    const patch: Partial<DailyLog> = { checkedIn: true };
    if (changed(initial.sleep, v.sleep)) patch.sleepHours = v.sleep;
    if (changed(initial.energy, v.energy)) patch.energy = v.energy;
    if (changed(initial.stress, v.stress)) patch.stress = v.stress;
    if (changed(initial.mood, v.mood)) patch.mood = v.mood;
    const s = suggestPlan(
      {
        sleepHours: patch.sleepHours ?? log?.sleepHours ?? v.sleep!,
        energy: patch.energy ?? log?.energy ?? v.energy!,
        stress: patch.stress ?? log?.stress ?? v.stress!,
        mood: patch.mood ?? log?.mood ?? v.mood!,
      },
      { doubleMiss },
    );
    // A lighter day you already chose stands; otherwise the mentor sizes the day.
    if (!log?.mvd && !log?.light)
      Object.assign(patch, modePatch(s.mode), { planReason: planExplanation(s) });
    await patchDailyLog(date, patch);
  }

  return (
    <div className="mt-4 space-y-4">
      <ChoiceRow
        label="Sleep last night"
        choices={SLEEP_CHOICES}
        value={v.sleep}
        onChange={(sleep) => setV({ ...v, sleep })}
      />
      <ChoiceRow
        label="Energy"
        choices={ENERGY_CHOICES}
        value={v.energy}
        onChange={(energy) => setV({ ...v, energy })}
      />
      <ChoiceRow
        label="Stress"
        choices={STRESS_CHOICES}
        value={v.stress}
        onChange={(stress) => setV({ ...v, stress })}
      />
      <ChoiceRow
        label="Mood"
        choices={MOOD_CHOICES}
        value={v.mood}
        onChange={(mood) => setV({ ...v, mood })}
      />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1 py-3 text-base" disabled={!complete} onClick={save}>
          Plan my day
        </button>
        <button className="btn-ghost" onClick={() => patchDailyLog(date, { checkedIn: true })}>
          Skip
        </button>
      </div>
    </div>
  );
}

function Briefing({
  date,
  log,
  purpose,
  lastIfThen,
}: {
  date: DateKey;
  log: DailyLog | undefined;
  purpose: string;
  lastIfThen: string | null;
}) {
  const [ifThen, setIfThen] = useState(log?.ifThen ?? lastIfThen ?? '');

  async function done() {
    await patchDailyLog(date, { ifThen: ifThen.trim() || undefined });
    await recordActivity(date, 'vision');
    if (ifThen.trim()) await recordActivity(date, 'ifthen');
    await skipStep(date, 'briefing');
  }

  return (
    <div className="mt-4 space-y-4">
      {purpose.trim() ? (
        <figure>
          <figcaption className="muted mb-1 text-xs font-semibold uppercase">Your why</figcaption>
          <blockquote className="rounded-r-xl border-l-4 border-brand-500 bg-brand-50 px-3 py-2 text-[15px] whitespace-pre-wrap dark:bg-brand-900/30">
            {purpose}
          </blockquote>
        </figure>
      ) : (
        <p className="text-sm">
          You haven’t written your purpose yet.{' '}
          <Link className="font-medium text-brand-700 underline dark:text-brand-200" to="/charter">
            Add one or two lines in your Charter
          </Link>
          .
        </p>
      )}
      <p className="text-sm">
        <strong>Rehearse for one minute:</strong> picture today’s hardest task, the moment you’ll
        want to stop, and what you will do then.
      </p>
      <Field
        label="Today’s if-then plan"
        hint={
          lastIfThen
            ? `From last night’s journal: “${lastIfThen}”`
            : '“If [obstacle], then I will [action].”'
        }
      >
        <input
          className="input"
          value={ifThen}
          onChange={(e) => setIfThen(e.target.value)}
          placeholder="If I reach for my phone in a block, then I’ll put it in the other room."
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1 py-3 text-base" onClick={done}>
          Done — what’s next?
        </button>
        <button className="btn-ghost" onClick={() => skipStep(date, 'briefing')}>
          Not today
        </button>
      </div>
    </div>
  );
}

function CloseDay({
  date,
  log,
  items,
}: {
  date: DateKey;
  log: DailyLog | undefined;
  items: ProtocolItem[];
}) {
  const initial = {
    exercise: nearestChoice(EXERCISE_CHOICES, log?.exerciseMin),
    am: nearestChoice(CLARITY_CHOICES, log?.clarityAM),
    pm: nearestChoice(CLARITY_CHOICES, log?.clarityPM),
  };
  const [v, setV] = useState(initial);
  const habits = items.filter((i) => HABIT_IDS.includes(i.id) && i.id !== 'exercise');

  async function save() {
    const patch: Partial<DailyLog> = { closed: true };
    if (changed(initial.exercise, v.exercise)) patch.exerciseMin = v.exercise;
    if (changed(initial.am, v.am)) patch.clarityAM = v.am;
    if (changed(initial.pm, v.pm)) patch.clarityPM = v.pm;
    await patchDailyLog(date, patch);
    const exercise = patch.exerciseMin ?? log?.exerciseMin;
    if (exercise != null && exercise >= EXERCISE_DONE_MIN)
      await toggleCheck(date, 'exercise', true);
    await recordActivity(date, 'close');
  }

  return (
    <div className="mt-4 space-y-4">
      <ChoiceRow
        label="Exercise today"
        choices={EXERCISE_CHOICES}
        value={v.exercise}
        onChange={(exercise) => setV({ ...v, exercise })}
      />
      <ChoiceRow
        label="How clear was your head this morning?"
        choices={CLARITY_CHOICES}
        value={v.am}
        onChange={(am) => setV({ ...v, am })}
      />
      <ChoiceRow
        label="…and this afternoon?"
        choices={CLARITY_CHOICES}
        value={v.pm}
        onChange={(pm) => setV({ ...v, pm })}
      />
      {habits.length > 0 && (
        <div>
          <span className="label">Habits today</span>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => (
              <HabitChip
                key={h.id}
                date={date}
                id={h.id}
                title={h.title}
                checked={!!log?.checks[h.id]}
              />
            ))}
          </div>
        </div>
      )}
      <button className="btn-primary w-full py-3 text-base" onClick={save}>
        Close the day
      </button>
    </div>
  );
}

function PlanCard({
  date,
  log,
  mode,
  items,
  targets,
  done,
  total,
}: {
  date: DateKey;
  log: DailyLog | undefined;
  mode: DayMode;
  items: ProtocolItem[];
  targets: DimensionId[];
  done: number;
  total: number;
}) {
  const checks = log?.checks ?? {};
  const skipped = log?.skipped ?? {};
  const practice = items.filter((i) => !HABIT_IDS.includes(i.id));
  const habits = items.filter((i) => HABIT_IDS.includes(i.id));
  const setMode = (m: DayMode) => patchDailyLog(date, { ...modePatch(m), planReason: undefined });

  return (
    <Card
      title="Today’s plan"
      aside={
        <span className="chip tabular-nums">
          {done}/{total} done
        </span>
      }
    >
      <div
        role="radiogroup"
        aria-label="Type of day"
        className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {(Object.keys(MODE_INFO) as DayMode[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-2 py-1.5 text-sm font-medium transition ${
              mode === m
                ? 'bg-white text-brand-800 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {MODE_INFO[m].label}
          </button>
        ))}
      </div>
      <p className="muted mt-2 text-xs">{MODE_INFO[mode].summary}</p>

      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {practice.map((i) => (
          <PlanRow
            key={i.id}
            date={date}
            id={i.id}
            title={i.title}
            route={i.route}
            checked={!!checks[i.id]}
            skipped={
              !!skipped[i.id] || (!!skipped.briefing && (i.id === 'vision' || i.id === 'ifthen'))
            }
          />
        ))}
        {targets.map((t) => (
          <PlanRow
            key={t}
            date={date}
            id={`target-${t}`}
            title={DIMENSION_BY_ID[t].name}
            tag="your target"
            route={TARGET_ROUTE[t]}
            checked={!!checks[`target-${t}`]}
            skipped={!!skipped[`target-${t}`]}
          />
        ))}
      </ul>

      {habits.length > 0 && (
        <div className="mt-3">
          <h3 className="muted mb-2 text-xs font-semibold tracking-wide uppercase">Habits</h3>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => (
              <HabitChip
                key={h.id}
                date={date}
                id={h.id}
                title={h.title}
                checked={!!checks[h.id]}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function PlanRow({
  date,
  id,
  title,
  tag,
  route,
  checked,
  skipped,
}: {
  date: DateKey;
  id: string;
  title: string;
  tag?: string;
  route?: string;
  checked: boolean;
  skipped: boolean;
}) {
  const [shown, setPending] = useOptimistic(checked);
  return (
    <li className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        aria-label={title}
        className="h-5 w-5 shrink-0 accent-brand-700"
        checked={shown}
        onChange={async (e) => {
          const v = e.target.checked;
          setPending(v);
          try {
            await toggleCheck(date, id, v);
          } catch {
            setPending(null);
          }
        }}
      />
      <div className="min-w-0 flex-1">
        <span
          className={`text-sm font-medium ${shown ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
        >
          {title}
        </span>
        {tag && <span className="chip ml-2 px-2 py-0.5 text-[11px]">{tag}</span>}
        {skipped && !shown && <div className="muted text-xs">left for today</div>}
      </div>
      {route && (
        <Link
          to={route}
          className="btn-ghost shrink-0 px-2 py-1 text-xs"
          aria-label={`Open ${title}`}
        >
          Open →
        </Link>
      )}
    </li>
  );
}

function HabitChip({
  date,
  id,
  title,
  checked,
}: {
  date: DateKey;
  id: string;
  title: string;
  checked: boolean;
}) {
  const [shown, setPending] = useOptimistic(checked);
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
        shown
          ? 'border-brand-700 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      <input
        type="checkbox"
        aria-label={title}
        className="h-4 w-4 accent-brand-700"
        checked={shown}
        onChange={async (e) => {
          const v = e.target.checked;
          setPending(v);
          try {
            await toggleCheck(date, id, v);
          } catch {
            setPending(null);
          }
        }}
      />
      {title}
    </label>
  );
}

function MissionCard({
  setupDone,
  charter,
}: {
  setupDone: SettingsMap['setupDone'];
  charter: SettingsMap['charter'];
}) {
  const open = SETUP_TASKS.filter((t) => !setupDone[t.id]).sort((a, b) => a.byWeek - b.byWeek);
  if (!open.length) return null;
  const m = open[0];
  const started = m.id === 'charter' && !!charter?.purpose.trim() && charter.targets.length > 0;
  const set = (id: string, v: boolean) => setSetting('setupDone', { ...setupDone, [id]: v });
  return (
    <Card
      title="This week’s setup mission"
      aside={
        <span className="muted text-xs">
          {SETUP_TASKS.length - open.length + 1} of {SETUP_TASKS.length}
        </span>
      }
    >
      <p className="font-medium">{started ? 'Finish your Personal Charter' : m.title}</p>
      <p className="muted text-xs">
        {started
          ? 'Your purpose and targets are set. Add your values, a Plan B and support contacts — about 5 minutes.'
          : m.detail}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {m.route && (
          <Link to={m.route} className="btn-secondary">
            Open →
          </Link>
        )}
        <button className="btn-primary" onClick={() => set(m.id, true)}>
          Done ✓
        </button>
      </div>
      <details className="mt-3">
        <summary className="muted cursor-pointer text-xs">All setup tasks</summary>
        <ul className="mt-2 space-y-2">
          {SETUP_TASKS.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={t.title}
                className="mt-0.5 h-4 w-4 accent-brand-700"
                checked={!!setupDone[t.id]}
                onChange={(e) => set(t.id, e.target.checked)}
              />
              <span>
                {t.title} <span className="muted text-xs">· by week {t.byWeek}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function ProgressCard({ data, dayNumber }: { data: ProgressData; dayNumber: number }) {
  const { ready, locked } = useMemo(() => progressHighlights(data), [data]);
  const next = useMemo(() => nextMilestone(milestones(data)), [data]);
  const top = topHighlights(ready);
  const teasers = locked.slice(0, top.length >= 3 ? 1 : 2);
  return (
    <Card
      title="Your progress"
      aside={
        <Link to="/progress" className="text-sm font-semibold text-brand-700 dark:text-brand-200">
          See all →
        </Link>
      }
    >
      {top.length > 0 && (
        <ul className="space-y-3">
          {top.map((h) => (
            <HighlightRow key={h.id} h={h} />
          ))}
        </ul>
      )}
      {teasers.length > 0 && (
        <ul className={`space-y-2 ${top.length ? 'mt-3' : ''}`}>
          {teasers.map((l) => (
            <LockedRow key={l.id} l={l} />
          ))}
        </ul>
      )}
      {next && (
        <div className="mt-4">
          <MilestoneRow m={next} label="Next milestone" />
        </div>
      )}
      <p className="muted mt-3 text-xs">{expectation(dayNumber)}</p>
    </Card>
  );
}

function WeekCard({
  today,
  state,
  weeklyDone,
}: {
  today: DateKey;
  state: PhaseState;
  weeklyDone: SettingsMap['weeklyDone'];
}) {
  const week = weekStart(today);
  const weekChecks = weeklyDone[week] ?? {};
  const items = weeklyProtocol(state);
  const done = items.filter((w) => weekChecks[w.id]).length;
  return (
    <Card
      title="This week"
      aside={
        <span className="chip tabular-nums">
          {done}/{items.length}
        </span>
      }
    >
      {dayOfWeek(today) === 0 && !weekChecks.review && (
        <div className="mb-3">
          <Notice tone="success">
            It’s Sunday — ten minutes to look back. Your mentor’s note on the week is ready.{' '}
            <Link className="underline" to="/review">
              Open the Sunday review
            </Link>
          </Notice>
        </div>
      )}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((w) => (
          <WeeklyRow
            key={w.id}
            title={w.title}
            detail={w.detail}
            route={w.route}
            checked={!!weekChecks[w.id]}
            onChange={(v) =>
              setSetting('weeklyDone', { ...weeklyDone, [week]: { ...weekChecks, [w.id]: v } })
            }
          />
        ))}
      </ul>
    </Card>
  );
}

function WeeklyRow({
  title,
  detail,
  route,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  route?: string;
  checked: boolean;
  onChange: (v: boolean) => Promise<unknown>;
}) {
  const [shown, setPending] = useOptimistic(checked);
  return (
    <li className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        aria-label={title}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700"
        checked={shown}
        onChange={async (e) => {
          const v = e.target.checked;
          setPending(v);
          try {
            await onChange(v);
          } catch {
            setPending(null);
          }
        }}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-medium ${shown ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
        >
          {title}
        </div>
        <div className="muted text-xs">{detail}</div>
      </div>
      {route && (
        <Link
          to={route}
          className="btn-ghost shrink-0 px-2 py-1 text-xs"
          aria-label={`Open ${title}`}
        >
          Open →
        </Link>
      )}
    </li>
  );
}

function QuickLog({ date, log }: { date: DateKey; log: DailyLog | undefined }) {
  const set = (patch: Partial<DailyLog>) => patchDailyLog(date, patch);
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div>
      <p className="muted mb-3 text-xs">
        Auto-saves. The check-in and close-out fill most of this for you; use it for exact numbers
        and your fog audit.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          label="Sleep (h)"
          value={log?.sleepHours}
          step={0.5}
          onChange={(v) => set({ sleepHours: num(v) })}
        />
        <NumberField
          label="Exercise (min)"
          value={log?.exerciseMin}
          step={5}
          onChange={(v) => set({ exerciseMin: num(v) })}
        />
        <NumberField
          label="Caffeine → bed (h)"
          value={log?.caffeineGapHours}
          step={1}
          onChange={(v) => set({ caffeineGapHours: num(v) })}
        />
        <NumberField
          label="Leisure screens (h)"
          value={log?.screenHours}
          step={0.5}
          onChange={(v) => set({ screenHours: num(v) })}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Scale
          label="Clarity — late morning"
          value={log?.clarityAM}
          onChange={(v) => set({ clarityAM: v })}
          lowLabel="foggy"
          highLabel="sharp"
        />
        <Scale
          label="Clarity — mid-afternoon"
          value={log?.clarityPM}
          onChange={(v) => set({ clarityPM: v })}
          lowLabel="foggy"
          highLabel="sharp"
        />
        <Scale
          label="Stress"
          value={log?.stress}
          onChange={(v) => set({ stress: v })}
          lowLabel="calm"
          highLabel="overwhelmed"
        />
        <Scale
          label="Mood"
          value={log?.mood}
          onChange={(v) => set({ mood: v })}
          lowLabel="low"
          highLabel="great"
        />
        <Scale
          label="Energy"
          value={log?.energy}
          onChange={(v) => set({ energy: v })}
          lowLabel="drained"
          highLabel="energised"
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: string) => void;
  step: number;
}) {
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
