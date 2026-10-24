import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { NAV, NAV_GROUPS } from './nav';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export default function Layout() {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-200 p-3 lg:flex dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1">
          <img src="./icon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-semibold">Rewire</span>
        </div>
        <nav className="flex flex-col gap-4" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-0.5">
              <h2 className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                {group}
              </h2>
              {NAV.filter((n) => n.group === group).map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass}>
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <Suspense fallback={<p className="muted p-6">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
      >
        {[...NAV.filter((n) => n.primary), { to: '/more', label: 'More', icon: '☰' }].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive
                  ? 'text-brand-700 dark:text-brand-200'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <span aria-hidden className="text-lg leading-none">
              {n.icon}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
