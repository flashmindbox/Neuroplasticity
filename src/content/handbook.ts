// The handbook is bundled from /handbook and rendered in-app. Pages load lazily.
const pages = import.meta.glob('../../handbook/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const PREFIX = '../../handbook/';

/** Paths relative to handbook/, e.g. "modules/L0-body.md". */
export const HANDBOOK_PATHS: string[] = Object.keys(pages)
  .map((p) => p.slice(PREFIX.length))
  .sort();

export function loadHandbookPage(path: string): Promise<string> | null {
  const loader = pages[PREFIX + path];
  return loader ? loader() : null;
}

/** Resolve a relative link inside a handbook page to another handbook path. */
export function resolveHandbookLink(fromPath: string, href: string): string {
  const [target, hash] = href.split('#');
  const parts = fromPath.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/') + (hash ? `#${hash}` : '');
}
