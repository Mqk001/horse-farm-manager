'use client';
import Link from 'next/link';
export type BreadcrumbItem = { label: string; href?: string };
export function Breadcrumbs({ items, onNavigate }: { items: BreadcrumbItem[]; onNavigate?: (href: string, preventDefault: () => void) => void }) {
  return <nav aria-label="Breadcrumb" className="mb-6 min-w-0">
    <ol className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-[#667169]">
      {items.map((item, index) => <li key={item.href ?? `current-${index}`} className={`flex items-center gap-2 ${index === 0 ? 'shrink-0' : 'min-w-0 max-w-[12rem] sm:max-w-sm'}`}>
        {index > 0 && <span aria-hidden="true" className="shrink-0 text-[#9aa29a]">/</span>}
        {index < items.length - 1 && item.href ? <Link title={item.label} href={item.href} onNavigate={event => onNavigate?.(item.href!, () => event.preventDefault())} className="truncate underline underline-offset-4 hover:text-[#183d2f]">{item.label}</Link> : <span title={item.label} aria-current="page" className="truncate font-semibold text-[#26332a]">{item.label}</span>}
      </li>)}
    </ol>
  </nav>;
}
