export function sanitizeDomain(input: string): { ok: true; domain: string } | { ok: false; error: string } {
  let value = input.trim();
  if (!value) return { ok: false, error: 'Domain is required.' };
  value = value.replace(/^https?:\/\//i, '');
  value = value.split('/')[0];
  try {
    const url = new URL(`https://${value}`);
    if (!url.hostname.includes('.')) {
      return { ok: false, error: 'Enter a valid domain, e.g. example.com.' };
    }
    return { ok: true, domain: url.hostname };
  } catch {
    return { ok: false, error: 'Enter a valid domain, e.g. example.com.' };
  }
}
