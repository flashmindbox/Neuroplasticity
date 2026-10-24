import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DIMENSIONS } from '../content/dimensions';
import { Card, Empty, Page, Stat } from '../components/ui';
import { db, type DailyLog } from '../lib/db';
import { addDays, formatKey, weekStart, type DateKey } from '../lib/dates';
import { plannedIds, useProgramme } from '../lib/hooks';
import { aiDerivedRatings, weekMetrics } from '../lib/metrics';
import { useSetting } from '../lib/settings';

const WEEKS = 12;

export default function Progress() {
  const prog = useProgramme();
  const charter = useSetting('charter');
  const since = prog ? addDays(weekStart(prog.today), -7 * (WEEKS - 1)) : '';
  const logs = useLiveQuery(
    () => (since ? db.dailyLogs.where('date').aboveOrEqual(since).toArray() : []),
    [since],
  );
  const sessions = useLiveQuery(
    () => (since ? db.focusSessions.where('date').aboveOrEqual(since).toArray() : []),
    [since],
  );
  const mocks = useLiveQuery(() => db.mocks.toArray(), []);
  const ratings = useLiveQuery(() => db.ratings.orderBy('date').toArray(), []);
  const drills = useLiveQuery(() => db.drills.toArray(), []);
  const talks = useLiveQuery(() => db.talks.toArray(), []);
  const usage = useLiveQuery(() => db.aiUsage.toArray(), []);
  const interviews = useLiveQuery(() => db.interviews.count(), []);

  const weekly = useMemo(() => {
    if (!prog || !logs || !sessions || !mocks) return [];
    const map = new Map<DateKey, DailyLog>(logs.map((l) => [l.date, l]));
    return Array.from({ length: WEEKS }, (_, i) => {
      const ws = addDays(weekStart(prog.today), -7 * (WEEKS - 1 - i));
      if (ws < weekStart(prog.dates.programmeStart)) return null;
      const m = weekMetrics(
        ws,
        map,
        sessions,
        mocks,
        (d) => plannedIds(d, prog.dates, charter?.targets ?? []),
        prog.today,
      );
      return { week: formatKey(ws), ...m };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [prog, logs, sessions, mocks, charter]);

  if (!prog || !ratings || !drills || !talks || !usage) return null;

  const self = [...ratings].reverse().find((r) => r.source === 'self');
  const external = [...ratings].reverse().find((r) => r.source === 'external');
  const ai = aiDerivedRatings(drills, talks, addDays(prog.today, -30));
  const radar = DIMENSIONS.map((d) => ({
    dim: d.name.split(' ')[0],
    full: d.name,
    you: self?.ratings[d.id] ?? 0,
    external: external?.ratings[d.id] ?? ai[d.id] ?? null,
  }));
  const gaps = DIMENSIONS.map((d) => {
    const ext = external?.ratings[d.id] ?? ai[d.id];
    const mine = self?.ratings[d.id];
    return ext != null && mine != null
      ? { name: d.name, gap: Math.round((mine - ext) * 10) / 10 }
      : null;
  }).filter((x): x is { name: string; gap: number } => x !== null);
  const month = prog.today.slice(0, 7);
  const monthCost = usage
    .filter((u) => u.date.startsWith(month))
    .reduce((s, u) => s + u.costUsd, 0);

  return (
    <Page title="Progress" subtitle="Judge 4-week trends, not single days.">
      <Card
        title="Topper profile"
        aside={self ? <span className="muted text-xs">self: {self.date}</span> : null}
      >
        {!self ? (
          <Empty>Do your first monthly rating in Review to see the radar.</Empty>
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer>
                <RadarChart data={radar} outerRadius="70%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dim" fontSize={11} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    name="You"
                    dataKey="you"
                    stroke="#0f766e"
                    fill="#14b8a6"
                    fillOpacity={0.35}
                  />
                  <Radar
                    name={external ? 'External' : 'AI (last 30 d)'}
                    dataKey="external"
                    stroke="#7c3aed"
                    fill="#7c3aed"
                    fillOpacity={0.15}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {gaps.length > 0 && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold">Self vs external gap</h3>
                <p className="muted mb-1 text-xs">
                  Positive = you rate yourself higher. Large gaps are self-awareness work.
                </p>
                <ul className="space-y-0.5 text-sm">
                  {gaps.map((g) => (
                    <li key={g.name} className="flex justify-between">
                      <span>{g.name}</span>
                      <span
                        className={`tabular-nums ${Math.abs(g.gap) >= 2 ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`}
                      >
                        {g.gap > 0 ? '+' : ''}
                        {g.gap}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Weekly trends">
        {weekly.length === 0 ? (
          <Empty>Trends appear after your first week.</Empty>
        ) : (
          <div className="space-y-6">
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar
                    dataKey="focusMinutes"
                    name="Focus minutes"
                    fill="#0f766e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip />
                  <Line dataKey="habitPct" name="Habit %" stroke="#0f766e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis domain={[0, 10]} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="avgStress" name="Stress" stroke="#e11d48" />
                  <Line dataKey="avgClarity" name="Clarity" stroke="#0f766e" />
                  <Line dataKey="avgSleep" name="Sleep h" stroke="#6366f1" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Drills done" value={drills.length} />
        <Stat label="Talks recorded" value={talks.length} />
        <Stat
          label="AI ratings"
          value={drills.filter((d) => d.ai).length + talks.filter((t) => t.ai).length}
        />
        {usage.length > 0 ? (
          <Stat label="API cost this month" value={`$${monthCost.toFixed(2)}`} />
        ) : (
          <Stat label="Mock boards" value={interviews ?? 0} />
        )}
      </div>
    </Page>
  );
}
