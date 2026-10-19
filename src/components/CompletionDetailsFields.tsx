'use client';
import { useState } from 'react';
import { CURRENCIES } from '@/lib/completion-details';

export function CompletionDetailsFields() {
  const [visited, setVisited] = useState(false);
  return <details className="mt-3 min-w-0 basis-full" onToggle={event => { if (event.currentTarget.open) setVisited(true); }}><summary className="cursor-pointer text-xs font-semibold text-[#315c47]">Completion details (optional)</summary>
    {visited && <div className="reinwell-form mt-3 grid min-w-0 gap-3">
      <label>Completion notes<textarea name="completionNotes" rows={3} maxLength={2000} placeholder="What was done, observations, or follow-up." /></label>
      <label>Product used<input name="productUsed" maxLength={200} placeholder="Product or medication name" /></label>
      <label>Cost<input name="cost" type="number" min="0" max="9999999.99" step="0.01" placeholder="Optional" /></label>
      <label>Currency<select name="costCurrency" defaultValue="USD">{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></label>
    </div>}
  </details>;
}
