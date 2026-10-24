import { useState } from 'react';
import { CLUSTERS, DIMENSIONS, MAX_ACTIVE_TARGETS, type DimensionId } from '../content/dimensions';
import { Card, Field, HandbookLink, Notice, Page, SavedFlash, TextArea } from '../components/ui';
import { todayKey } from '../lib/dates';
import {
  EMPTY_CHARTER,
  setSetting,
  useSetting,
  type Charter as CharterT,
  type InterviewProfile,
} from '../lib/settings';

export default function Charter() {
  const saved = useSetting('charter');
  return saved === undefined ? null : <CharterForm saved={saved} />;
}

function CharterForm({ saved }: { saved: CharterT | null }) {
  const [c, setC] = useState<CharterT>(() => saved ?? EMPTY_CHARTER);
  const [flash, setFlash] = useState(false);

  const update = (patch: Partial<CharterT>) => setC({ ...c, ...patch });
  const updateProfile = (patch: Partial<InterviewProfile>) =>
    update({ profile: { ...c.profile, ...patch } });
  const toggleTarget = (id: DimensionId) =>
    update({
      targets: c.targets.includes(id)
        ? c.targets.filter((t) => t !== id)
        : c.targets.length < MAX_ACTIVE_TARGETS
          ? [...c.targets, id]
          : c.targets,
    });

  async function save() {
    await setSetting('charter', { ...c, updatedAt: todayKey() });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  }

  return (
    <Page
      title="Personal Charter"
      subtitle={
        saved?.updatedAt
          ? `Last updated ${saved.updatedAt}`
          : 'Your why, your values, your safety net, your targets.'
      }
      actions={
        <div className="flex items-center gap-2">
          <SavedFlash show={flash} />
          <button className="btn-primary" onClick={save}>
            Save charter
          </button>
        </div>
      }
    >
      <Card title="Purpose">
        <Field
          label="Who do you want to serve, what problem do you want to work on, and what kind of officer do you want people to meet? (under 150 words)"
          hint={
            <>
              Read it every morning. See{' '}
              <HandbookLink path="modules/L2-vision-identity.md">Vision & identity</HandbookLink>.
            </>
          }
        >
          <TextArea
            rows={5}
            value={c.purpose}
            onChange={(e) => update({ purpose: e.target.value })}
          />
        </Field>
      </Card>

      <Card title="Values & Plan B">
        <div className="space-y-3">
          <Field label="3–5 values you will live by whatever the result">
            <TextArea value={c.values} onChange={(e) => update({ values: e.target.value })} />
          </Field>
          <Field
            label="Plan B — a good, meaningful life if CSE doesn’t work out this year"
            hint="Not pessimism: lowering the threat frees the working memory fear would occupy."
          >
            <TextArea value={c.planB} onChange={(e) => update({ planB: e.target.value })} />
          </Field>
          <Field label="Support contacts (trusted person, accountability partner, counsellor option)">
            <TextArea
              value={c.supportContacts}
              onChange={(e) => update({ supportContacts: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Active targets"
        aside={
          <span className="chip">
            {c.targets.length}/{MAX_ACTIVE_TARGETS}
          </span>
        }
      >
        <p className="muted mb-3">
          Pick at most {MAX_ACTIVE_TARGETS}. Failing too many self-change challenges can push you
          the wrong way — add a new target only when an old one is automatic.
        </p>
        {c.targets.length >= MAX_ACTIVE_TARGETS && (
          <div className="mb-3">
            <Notice>Three targets chosen. Remove one to pick another.</Notice>
          </div>
        )}
        <div className="space-y-4">
          {CLUSTERS.map((cluster) => (
            <div key={cluster}>
              <h3 className="muted mb-2 text-xs font-semibold tracking-wide uppercase">
                {cluster}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {DIMENSIONS.filter((d) => d.cluster === cluster).map((d) => {
                  const on = c.targets.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTarget(d.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        on
                          ? 'border-brand-700 bg-brand-50 dark:bg-brand-900/30'
                          : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className="muted text-xs">{d.why}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Profile for the mock board">
        <p className="muted mb-3">
          Used only when you start an AI mock interview. Like a short Detailed Application Form.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['name', 'Name (optional)'],
              ['homeState', 'Home state / district'],
              ['education', 'Education'],
              ['work', 'Work experience'],
              ['hobbies', 'Hobbies & interests'],
              ['servicePreference', 'Service preferences'],
              ['optional', 'Optional subject'],
            ] as [keyof InterviewProfile, string][]
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className="input"
                value={c.profile[key]}
                onChange={(e) => updateProfile({ [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={save}>
          Save charter
        </button>
      </div>
    </Page>
  );
}
