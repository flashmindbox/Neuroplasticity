import { useState } from 'react';
import { DIMENSIONS, MAX_ACTIVE_TARGETS, type DimensionId } from '../content/dimensions';
import { todayKey } from '../lib/dates';
import { EMPTY_CHARTER, EMPTY_PROFILE, setSetting } from '../lib/settings';
import { MentorAvatar } from './mentor';
import { Field, TextArea } from './ui';

// Self-regulation first: it makes every other target easier (handbook/01-roadmap.md, Phase 1).
const RECOMMENDED: DimensionId[] = ['focus', 'discipline'];
const POPULAR: DimensionId[] = ['stress', 'thinking', 'communication'];
const STEPS = 4;

export function Welcome() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [targets, setTargets] = useState<DimensionId[]>(RECOMMENDED);
  const [showAll, setShowAll] = useState(false);

  const toggle = (id: DimensionId) =>
    setTargets((t) =>
      t.includes(id) ? t.filter((x) => x !== id) : t.length < MAX_ACTIVE_TARGETS ? [...t, id] : t,
    );

  async function finish() {
    await setSetting('charter', {
      ...EMPTY_CHARTER,
      purpose: purpose.trim(),
      targets,
      profile: { ...EMPTY_PROFILE, name: name.trim() },
      updatedAt: todayKey(),
    });
    await setSetting('onboarded', true);
  }

  const shown = showAll
    ? DIMENSIONS.map((d) => d.id)
    : [
        ...RECOMMENDED,
        ...POPULAR,
        ...targets.filter((t) => !RECOMMENDED.concat(POPULAR).includes(t)),
      ];

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pt-6 pb-28 lg:pb-10">
      <div className="flex items-center justify-between">
        <span className="muted text-xs font-medium">
          Step {step + 1} of {STEPS}
        </span>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'}`}
            />
          ))}
        </div>
      </div>

      <section className="card space-y-4">
        {step === 0 && (
          <>
            <div className="flex items-center gap-3">
              <MentorAvatar className="h-12 w-12" />
              <h1 className="h1">Hi — I’m your Rewire mentor.</h1>
            </div>
            <p>
              Rewire trains the person behind the preparation: focus that holds for a 3-hour paper,
              calm under pressure, clear thinking and confident speaking.
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>You don’t need to read anything first.</strong> Each day I’ll show you one
                next step at a time.
              </li>
              <li>
                <strong>I size the day to how you are.</strong> A 10-second check-in each morning
                decides between a full, light or 5-minute day.
              </li>
              <li>
                <strong>You’ll see results as you go:</strong> minutes of deep focus, attention
                reps, drill scores, fewer filler words — compared with where you started.
              </li>
            </ul>
            <Field label="What should I call you? (optional)">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary flex-1" onClick={() => setStep(1)}>
                Let’s set up — 2 minutes
              </button>
              <button className="btn-ghost" onClick={() => setSetting('onboarded', true)}>
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="h1">Why are you doing this?</h1>
            <p className="muted">
              In a line or two: who do you want to serve, and what kind of officer do you want
              people to meet? On hard days I’ll show you this. You can refine it later in your
              Charter.
            </p>
            <Field label="Your purpose">
              <TextArea
                rows={4}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="I want to make public services in my district fast and fair, and be an officer people can reach."
              />
            </Field>
            <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} next="Next" />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="h1">What should we train first?</h1>
            <p className="muted">
              Pick up to {MAX_ACTIVE_TARGETS}. Fewer is better — failing at too many changes at once
              backfires. I’ve pre-selected the two that make everything else easier.
            </p>
            <div className="grid gap-2">
              {shown.map((id) => {
                const d = DIMENSIONS.find((x) => x.id === id)!;
                const on = targets.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      on
                        ? 'border-brand-700 bg-brand-50 dark:bg-brand-900/30'
                        : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{d.name}</span>
                      {RECOMMENDED.includes(id) && (
                        <span className="chip border-brand-600 text-brand-700 dark:text-brand-200">
                          recommended
                        </span>
                      )}
                    </div>
                    <div className="muted text-xs">{d.why}</div>
                  </button>
                );
              })}
            </div>
            {!showAll && (
              <button className="btn-ghost w-full" onClick={() => setShowAll(true)}>
                Show all {DIMENSIONS.length} areas
              </button>
            )}
            <p className="muted text-xs">
              {targets.length}/{MAX_ACTIVE_TARGETS} chosen
            </p>
            <Nav
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              next="Next"
              disabled={!targets.length}
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="h1">How a day works</h1>
            <ol className="space-y-3">
              {[
                [
                  'Check in',
                  'Four taps on sleep, energy, stress and mood. I’ll size the day: full, light or minimum.',
                ],
                [
                  'Follow the next step',
                  'One thing at a time, with a timer or a prompt. Your plan ticks itself when you finish.',
                ],
                [
                  'Close the day',
                  'One minute in the evening. On Sundays I’ll write you a short note on your week.',
                ],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="muted">{text}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <strong>Bad day?</strong> A 5-minute minimum day still counts. The only rule is: never
              miss two days in a row.
            </p>
            <Nav onBack={() => setStep(2)} onNext={finish} next="Start day 1" />
          </>
        )}
      </section>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  next,
  disabled,
}: {
  onBack: () => void;
  onNext: () => void;
  next: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button className="btn-secondary" onClick={onBack}>
        Back
      </button>
      <button className="btn-primary flex-1" onClick={onNext} disabled={disabled}>
        {next}
      </button>
    </div>
  );
}
