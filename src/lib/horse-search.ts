export function normalizeSearch(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US'); }
export function searchTerms(query: string) { return normalizeSearch(query.slice(0, 100)).trim().split(/\s+/).filter(Boolean).slice(0, 5); }
// Bounded edit distance, including adjacent transpositions (e.g. Thudner).
function distance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit || a.length > 32 || b.length > 32) return limit + 1;
  const rows = [Array.from({ length: b.length + 1 }, (_, i) => i)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
    }
    rows.push(row);
  }
  return rows[a.length][b.length];
}
export function termMatches(word: string, term: string) {
  const normalized = normalizeSearch(word);
  return normalized.includes(term) || (term.length >= 4 && distance(normalized, term, term.length >= 7 ? 2 : 1) <= (term.length >= 7 ? 2 : 1));
}
export function horseSearchScore(horse: { name: string; breed: string | null }, query: string) {
  const terms = searchTerms(query);
  if (!terms.length) return 0;
  const name = normalizeSearch(horse.name), breed = normalizeSearch(horse.breed ?? '');
  const full = normalizeSearch(query.slice(0, 100)).trim();
  if (name === full) return 0;
  if (name.startsWith(full)) return 1;
  if (name.includes(full)) return 2;
  if (breed.includes(full)) return 3;
  const words = `${name} ${breed}`.split(/[\s-]+/).filter(Boolean).slice(0, 20);
  return terms.every(term => words.some(word => termMatches(word, term))) ? 4 : null;
}
