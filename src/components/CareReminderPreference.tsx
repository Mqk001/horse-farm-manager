'use client';
import { useRef, useState } from 'react';
import { setCareReminders } from '@/app/care/reminder-actions';

export function CareReminderPreference({ enabled, available, manager, farmName }: { enabled: boolean; available: boolean; manager: boolean; farmName: string }) {
  const [value, setValue] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function change() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(''); setMessage('');
    try {
      await setCareReminders(!value);
      setValue(!value);
      setMessage(value ? 'Daily reminders turned off.' : 'Daily reminders turned on. Your next digest arrives when there is work due.');
    } catch { setError('Could not confirm your preference. Refresh to check before trying again.'); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <section aria-label="Care email reminders" className="premium-card mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
    <div className="max-w-xl"><h2 className="text-sm font-bold">Daily email reminders <span className="ml-2 text-xs font-normal text-[#68736b]">{value ? 'On' : 'Off'}</span></h2>
      <p className="mt-1 text-xs leading-5 text-[#68736b]">{manager ? 'Overdue and upcoming work across' : 'Your assigned overdue and upcoming work at'} {farmName}. Includes today and the next 3 days. Only sends when work is due.</p>
      <p className="mt-1 text-xs text-[#68736b]">Daily around 13:00 UTC. Turn off anytime here or from an email.</p>
      {!available && <p className="mt-2 text-xs text-[#806537]">Email reminders are currently unavailable. You can still manage care here.</p>}
      {message && <p role="status" className="mt-2 text-xs text-[#315c47]">{message}</p>}
      {error && <p role="alert" className="mt-2 form-error text-xs">{error}</p>}
    </div>
    <button type="button" className="button-secondary" disabled={pending || (!available && !value)} onClick={change}>{pending ? 'Saving…' : value ? 'Turn off reminders' : 'Turn on reminders'}</button>
  </section>;
}
