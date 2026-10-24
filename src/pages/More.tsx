import { Link } from 'react-router-dom';
import { NAV, NAV_GROUPS } from '../components/nav';
import { Page } from '../components/ui';

export default function More() {
  return (
    <Page
      title="More"
      subtitle="Everything else in Rewire. Today will point you to the right tool."
    >
      {NAV_GROUPS.map((group) => (
        <section key={group} className="space-y-2">
          <h2 className="muted text-xs font-semibold tracking-wide uppercase">{group}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {NAV.filter((n) => n.group === group && !n.primary).map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="card flex items-center gap-3 p-3 hover:border-brand-500"
              >
                <span aria-hidden className="text-2xl">
                  {n.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{n.label}</span>
                  <span className="muted block text-xs">{n.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
