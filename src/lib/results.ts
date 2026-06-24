import type { ResultRow } from './types';

export function filterAndSort(rows: ResultRow[], q: string, sortDir: 'asc' | 'desc'): ResultRow[] {
  let filtered = rows;
  if (q) {
    const needle = q.toLowerCase();
    filtered = rows.filter(
      (r) => r.imageUrl.toLowerCase().includes(needle) || r.pageUrl.toLowerCase().includes(needle)
    );
  }
  return [...filtered].sort((a, b) => (sortDir === 'desc' ? b.score - a.score : a.score - b.score));
}
