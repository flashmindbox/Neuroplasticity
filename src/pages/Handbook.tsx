import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from '../components/Markdown';
import { HANDBOOK_PATHS, loadHandbookPage } from '../content/handbook';

const SECTION_LABELS: Record<string, string> = {
  '': 'Overview',
  '00-foundations': 'Foundations',
  modules: 'Modules',
  assessments: 'Assessments',
  drills: 'Drill banks',
};

export default function Handbook() {
  const params = useParams();
  const path = params['*'] || 'README.md';

  const groups = HANDBOOK_PATHS.reduce<Record<string, string[]>>((acc, p) => {
    const dir = p.includes('/') ? p.split('/')[0] : '';
    (acc[dir] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 pt-4 pb-28 lg:pb-10">
      <nav
        className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] w-56 shrink-0 overflow-y-auto text-sm xl:block"
        aria-label="Handbook contents"
      >
        {Object.entries(groups).map(([dir, paths]) => (
          <div key={dir} className="mb-3">
            <div className="muted mb-1 text-xs font-semibold tracking-wide uppercase">
              {SECTION_LABELS[dir] ?? dir}
            </div>
            <ul className="space-y-0.5">
              {paths.map((p) => (
                <li key={p}>
                  <Link
                    to={`/handbook/${p}`}
                    className={`block truncate rounded px-2 py-0.5 ${p === path ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {p.split('/').pop()!.replace(/\.md$/, '').replace(/-/g, ' ')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <article className="min-w-0 flex-1">
        {path !== 'README.md' && (
          <Link to="/handbook" className="muted mb-2 inline-block text-sm hover:underline">
            ← Handbook contents
          </Link>
        )}
        {HANDBOOK_PATHS.includes(path) ? (
          <HandbookPage key={path} path={path} />
        ) : (
          <p className="muted">Page not found.</p>
        )}
      </article>
    </div>
  );
}

function HandbookPage({ path }: { path: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    window.scrollTo({ top: 0 });
    loadHandbookPage(path)?.then((s) => !cancelled && setSource(s));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return source ? <Markdown source={source} path={path} /> : <p className="muted">Loading…</p>;
}
