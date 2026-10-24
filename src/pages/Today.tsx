import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DIMENSION_BY_ID } from '../content/dimensions';
import {
  dailyProtocol,
  MVD_ITEMS,
  SETUP_TASKS,
  SLOT_LABELS,
  weeklyProtocol,
  type ProtocolItem,
  type Slot,
} from '../content/protocol';
import { PHASES } from '../content/roadmap';
import { Card, Notice, Page, Scale } from '../components/ui';
import { db, type DailyLog } from '../lib/db';
import { addDays, formatKey, weekStart, type DateKey } from '../lib/dates';
import { patchDailyLog, plannedIds, toggleCheck, useDailyLog, useProgramme } from '../lib/hooks';
import { evaluateRules, type Alert } from '../lib/rules';
import { setSetting, useSetting } from '../lib/settings';
import { completionRatio, dayStatus, neverMissTwiceChain } from '../lib/streak';

export default function Today() {
  const prog = useProgramme();
  const charter = useSetting('charter');
  const setupDone = useSetting('setupDone');
  const weeklyDone = useSetting('weeklyDone');
  const lastBackupAt = useSetting('lastBackupAt');
  const log = useDailyLog(prog?.today ?? '');
  const recent = useLiveQuery(
    () => (prog ? db.dailyLogs.where('date').aboveOrEqual(addDays(prog.today, -60)).toArray() : []),
    [prog?.today],
  );
  const screenings = useLiveQuery(() => db.screenings.toArray(), []);
  const brainChecks = useLiveQuery(() => db.brainChecks.toArray(), []);
  const ratings = useLiveQuery(() => db.ratings.toArray(), []);

  const targets = useMemo(() => charter?.targets ?? [], [charter]);

  const derived = useMemo(() => {
    if (!prog || !recent) return null;
    const logs = new Map<DateKey, DailyLog>(recent.map((l) => [l.date, l]));
    const planned = (d: DateKey) => plannedIds(d, prog.dates, targets);
    const statusOf = (d: DateKey) => dayStatus(logs.get(d), planned(d));
    const chain = neverMissTwiceChain(prog.today, prog.dates.programmeStart, statusOf);
    return { logs, planned, chain };
  }, [prog, recent, targets]);

  const alerts: Alert[] = useMemo(() => {
    if (!prog || !derived || !screenings || !brainChecks || !ratings || lastBackupAt === undefined)
      return [];
    return evaluateRules({
      today: prog.today,
      programmeStart: prog.dates.programmeStart,
      logs: derived.logs,
      completionOf: (d) => completionRatio(derived.logs.get(d), derived.planned(d)),
      doubleMissNow: derived.chain.doubleMissNow,
      screenings,
      brainChecks,
      ratings,
      targets,
      lastBackupAt,
      deload: prog.state.deload,
      taper: prog.state.taper,
    });
  }, [prog, derived, screenings, brainChecks, ratings, targets, lastBackupAt]);

  if (!prog || !derived) return null;
  const { today, state } = prog;
  const checks = log?.checks ?? {};
  const mvd = log?.mvd ?? false;
  const items = mvd ? MVD_ITEMS : dailyProtocol(today, state);
  const plannedToday = derived.planned(today);
  const ratio = completionRatio(log, plannedToday);
  const week = weekStart(today);
  const weekChecks = weeklyDone?.[week] ?? {};
  const setupOpen = SETUP_TASKS.filter((t) => !setupDone?.[t.id]);

  return (
    <Page
      title={formatKey(today, { weekday: 'long', day: 'numeric', month: 'long' })}
      subtitle={
        <>
          {PHASES[state.phase].name} · week {state.week} · today’s programme ≈ {state.doseMinutes}{' '}
          min
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Countdown label="Prelims" days={state.daysToPrelims} />
        <Countdown label="Mains" days={state.daysToMains} />
        <div className="rounded-xl bg-brand-700 p-3 text-white">
          <div className="text-xs opacity-80">Chain</div>
          <div className="text-xl font-semibold tabular-nums">{derived.chain.length} d</div>
          <div className="text-[11px] opacity-80">never miss twice</div>
        </div>
      </div>

      {alerts.map((a) => (
        <Notice
          key={a.id}
          tone={a.level === 'crisis' ? 'crisis' : a.level === 'warning' ? 'warning' : 'info'}
        >
          <strong>{a.title}.</strong> {a.action}{' '}
          {a.route && (
            <Link className="underline" to={a.route}>
              More
            </Link>
          )}
        </Notice>
      ))}

      {!charter && (
        <Notice tone="success">
          <strong>Start here:</strong> write your Personal Charter — your purpose, Plan B and 2–3
          active targets.{' '}
          <Link className="underline" to="/charter">
            Open Charter
          </Link>
        </Notice>
      )}

      {setupOpen.length > 0 && state.week <= 6 && (
        <Card
          title="Setup tasks"
          aside={
            <span className="muted">
              {SETUP_TASKS.length - setupOpen.length}/{SETUP_TASKS.length}
            </span>
          }
        >
          <ul className="space-y-2">
            {SETUP_TASKS.map((t) => (
              <CheckRow
                key={t.id}
                checked={!!setupDone?.[t.id]}
                onChange={(v) => setSetting('setupDone', { ...setupDone, [t.id]: v })}
                title={t.title}
                detail={`${t.detail} · by week ${t.byWeek}`}
                route={t.route}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={mvd ? 'Minimum viable day' : 'Today’s protocol'}
        aside={<span className="chip tabular-nums">{Math.round(ratio * 100)}%</span>}
      >
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-700"
            checked={mvd}
            onChange={(e) => patchDailyLog(today, { mvd: e.target.checked })}
          />
          Bad day? Switch to the 5-minute minimum viable day. It still counts.
        </label>
        <Checklist items={items} checks={checks} onToggle={(id, v) => toggleCheck(today, id, v)} />
      </Card>

      {!mvd && targets.length > 0 && (
        <Card title="Your active targets">
          <ul className="space-y-2">
            {targets.map((t) => (
              <CheckRow
                key={t}
                checked={!!checks[`target-${t}`]}
                onChange={(v) => toggleCheck(today, `target-${t}`, v)}
                title={DIMENSION_BY_ID[t].name}
                detail={DIMENSION_BY_ID[t].practice}
                route={`/handbook/${DIMENSION_BY_ID[t].module}`}
              />
            ))}
          </ul>
        </Card>
      )}

      <QuickLog date={today} log={log} />

      <Card title="This week" aside={<span className="muted">from {formatKey(week)}</span>}>
        <ul className="space-y-2">
          {weeklyProtocol(state).map((w) => (
            <CheckRow
              key={w.id}
              checked={!!weekChecks[w.id]}
              onChange={(v) =>
                setSetting('weeklyDone', { ...weeklyDone, [week]: { ...weekChecks, [w.id]: v } })
              }
              title={w.title}
              detail={w.detail}
              route={w.route}
            />
          ))}
        </ul>
      </Card>
    </Page>
  );
}

function Countdown({ label, days }: { label: string; days: number }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="muted text-xs">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{days >= 0 ? `${days} d` : 'done'}</div>
      <div className="muted text-[11px]">{days >= 0 ? `${Math.floor(days / 7)} weeks` : ''}</div>
    </div>
  );
}

function Checklist({
  items,
  checks,
  onToggle,
}: {
  items: ProtocolItem[];
  checks: Record<string, boolean>;
  onToggle: (id: string, v: boolean) => void;
}) {
  const slots = (Object.keys(SLOT_LABELS) as Slot[]).filter((s) => items.some((i) => i.slot === s));
  return (
    <div className="space-y-4">
      {slots.map((slot) => (
        <div key={slot}>
          <h3 className="muted mb-1 text-xs font-semibold tracking-wide uppercase">
            {SLOT_LABELS[slot]}
          </h3>
          <ul className="space-y-2">
            {items
              .filter((i) => i.slot === slot)
              .map((i) => (
                <CheckRow
                  key={i.id}
                  checked={!!checks[i.id]}
                  onChange={(v) => onToggle(i.id, v)}
                  title={i.title}
                  detail={i.detail}
                  route={i.route}
                />
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  title,
  detail,
  route,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail?: string;
  route?: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <input
        type="checkbox"
        aria-label={title}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-medium ${checked ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
        >
          {title}
        </div>
        {detail && <div className="muted text-xs">{detail}</div>}
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
    <Card title="Quick log" aside={<span className="muted text-xs">auto-saves</span>}>
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
    </Card>
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
