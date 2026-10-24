import { Link } from 'react-router-dom';
import { NAV } from '../components/nav';
import { Page } from '../components/ui';

export default function More() {
  return (
    <Page title="More">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NAV.filter((n) => !n.primary).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="card flex items-center gap-3 p-4 font-medium hover:border-brand-500"
          >
            <span aria-hidden className="text-2xl">
              {n.icon}
            </span>
            {n.label}
          </Link>
        ))}
      </div>
    </Page>
  );
}
