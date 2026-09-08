'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, onClose, children, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="reinwell-dialog" onCancel={event => {
      event.preventDefault(); if (!busy) onClose();
    }} onClick={event => {
      if (event.target === event.currentTarget && !busy) {
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }
    }}>
      <header className="flex items-center justify-between gap-4 border-b border-[#dedbd1] p-6">
        <div><p className="eyebrow">Reinwell</p><h2 id={titleId} className="mt-2 font-display text-3xl">{title}</h2></div>
        <button type="button" autoFocus disabled={busy} onClick={onClose} aria-label="Close dialog" className="button-secondary p-3"><X size={18} /></button>
      </header>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
