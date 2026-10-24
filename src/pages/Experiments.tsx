import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Card, Empty, Field, HandbookLink, Notice, Page, Stat } from '../components/ui';
import { db, type Experiment } from '../lib/db';
import { addDays } from '../lib/dates';
import { analyseExperiment, EXPERIMENT_METRICS, metricValue } from '../lib/experiments';
import { useProgramme } from '../lib/hooks';

export default function Experiments() {
  const prog = useProgramme();
  const experiments = useLiveQuery(() => db.experiments.orderBy('id').reverse().toArray(), []);
  if (!prog) return null;
  return (
    <Page
      title="Personal experiments"
      subtitle={
        <>
          Research gives averages; you are one person. Test techniques on yourself.{' '}
          <HandbookLink path="05-personal-experiments.md">The protocol</HandbookLink>
        </>
      }
    >
      <NewExperiment today={prog.today} />
      {!experiments?.length ? (
        <Empty>No experiments yet.</Empty>
      ) : (
        experiments.map((e) => <ExperimentCard key={e.id} exp={e} today={prog.today} />)
      )}
    </Page>
  );
}

function NewExperiment({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState(EXPERIMENT_METRICS[0].id);
  const [baselineStart, setBaselineStart] = useState(today);
  const [interventionStart, setInterventionStart] = useState(addDays(today, 10));
  const [end, setEnd] = useState(addDays(today, 27));
  const valid = title.trim() && baselineStart < interventionStart && interventionStart <= end;

  if (!open)
    return (
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>
        + New experiment
      </button>
    );
  return (
    <Card title="New experiment">
      <div className="space-y-3">
        <Field
          label="Question"
          hint="“Does [technique] improve [marker] for me?” — change only this one thing."
        >
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Caffeine cut-off at 2 pm → clarity"
          />
        </Field>
        <Field label="Marker (choose before you start)">
          <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {EXPERIMENT_METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Baseline starts">
            <input
              type="date"
              className="input"
              value={baselineStart}
              onChange={(e) => setBaselineStart(e.target.value)}
            />
          </Field>
          <Field label="Technique starts">
            <input
              type="date"
              className="input"
              value={interventionStart}
              onChange={(e) => setInterventionStart(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              type="date"
              className="input"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <button
          className="btn-primary w-full"
          disabled={!valid}
          onClick={async () => {
            await db.experiments.add({
              title,
              metric,
              baselineStart,
              interventionStart,
              end,
              status: 'running',
            });
            setOpen(false);
            setTitle('');
          }}
        >
          Start experiment
        </button>
      </div>
    </Card>
  );
}

function ExperimentCard({ exp, today }: { exp: Experiment; today: string }) {
  const logs = useLiveQuery(
    () => db.dailyLogs.where('date').between(exp.baselineStart, exp.end, true, true).toArray(),
    [exp.baselineStart, exp.end],
  );
  const sessions = useLiveQuery(
    () => db.focusSessions.where('date').between(exp.baselineStart, exp.end, true, true).toArray(),
    [exp.baselineStart, exp.end],
  );
  const [note, setNote] = useState(exp.note ?? '');

  const result = useMemo(() => {
    if (!logs || !sessions) return null;
    const byDate = new Map(logs.map((l) => [l.date, l]));
    return analyseExperiment(exp, (d) =>
      metricValue(
        exp.metric,
        byDate.get(d),
        sessions.filter((s) => s.date === d),
      ),
    );
  }, [logs, sessions, exp]);

  const metric = EXPERIMENT_METRICS.find((m) => m.id === exp.metric);
  const phase =
    today < exp.interventionStart ? 'Baseline' : today <= exp.end ? 'Technique' : 'Finished';

  return (
    <Card
      title={exp.title}
      aside={
        <span className="chip">{exp.status === 'done' ? `Decided: ${exp.decision}` : phase}</span>
      }
    >
      <p className="muted mb-3 text-xs">
        {metric?.label} · baseline {exp.baselineStart} → technique {exp.interventionStart} → end{' '}
        {exp.end}
      </p>
      {result && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={`Baseline (${result.baselineN} d)`} value={result.baselineMean ?? '–'} />
            <Stat
              label={`Technique (${result.interventionN} d)`}
              value={result.interventionMean ?? '–'}
            />
            <Stat
              label="Difference"
              value={
                result.difference == null
                  ? '–'
                  : `${result.difference > 0 ? '+' : ''}${result.difference}`
              }
              hint={result.effectSize != null ? `effect ${result.effectSize}` : undefined}
            />
          </div>
          <div className="mt-3">
            <Notice>{result.verdict}</Notice>
          </div>
        </>
      )}
      {exp.status === 'running' && phase === 'Finished' && (
        <div className="mt-3 space-y-2">
          <Field label="Why? (one sentence)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {(['keep', 'drop', 'retest'] as const).map((d) => (
              <button
                key={d}
                className="btn-secondary flex-1 capitalize"
                onClick={() =>
                  db.experiments.update(exp.id!, { status: 'done', decision: d, note })
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
      {exp.status === 'done' && exp.note && <p className="mt-2 text-sm">“{exp.note}”</p>}
      {exp.status === 'running' && phase !== 'Finished' && exp.note && (
        <p className="muted mt-2 text-xs">{exp.note}</p>
      )}
    </Card>
  );
}
