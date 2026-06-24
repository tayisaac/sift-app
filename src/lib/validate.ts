export function parseStartUrl(input: string):
  | { ok: true; hostname: string; rootUrl: string; pathPrefix: string; displayUrl: string }
  | { ok: false; error: string } {
  let value = input.trim();
  if (!value) return { ok: false, error: 'URL is required.' };
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (!u.hostname.includes('.')) {
      return { ok: false, error: 'Enter a valid URL, e.g. example.com or example.com/en/.' };
    }
    const pathname = u.pathname || '/';
    const rootUrl = `${u.protocol}//${u.host}${pathname}`;
    // pathPrefix is the path without trailing slash; empty string means no restriction.
    const pathPrefix = pathname === '/' ? '' : pathname.replace(/\/$/, '');
    const displayUrl = `${u.host}${pathname === '/' ? '' : pathname}`;
    return { ok: true, hostname: u.hostname, rootUrl, pathPrefix, displayUrl };
  } catch {
    return { ok: false, error: 'Enter a valid URL, e.g. example.com or example.com/en/.' };
  }
}
