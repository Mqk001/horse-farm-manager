import { searchTerms, termMatches } from '@/lib/horse-search';
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const terms = searchTerms(query);
  return <>{text.split(/(\s+)/).map((word, index) => terms.some(term => termMatches(word, term)) ? <mark key={index} className="rounded bg-[#eee0b8] px-0.5 text-inherit">{word}</mark> : word)}</>;
}
