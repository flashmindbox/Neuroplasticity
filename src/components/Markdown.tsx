import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { resolveHandbookLink } from '../content/handbook';

/** Renders handbook Markdown; relative links stay inside the in-app handbook. */
export default function Markdown({ source, path }: { source: string; path: string }) {
  return (
    <div className="prose-rewire">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href = '', children }) {
            if (/^(https?:|mailto:)/.test(href))
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            if (href.startsWith('#')) return <a href={href}>{children}</a>;
            return (
              <Link to={`/handbook/${resolveHandbookLink(path, href).split('#')[0]}`}>
                {children}
              </Link>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
