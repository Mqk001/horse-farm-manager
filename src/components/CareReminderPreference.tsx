'use client';
import { useRef, useState, type FormEvent } from 'react';
import { setCareReminders, saveCareReminderPreferences } from '@/app/care/reminder-actions';
import { REMINDER_LEAD_DAYS, REMINDER_HOURS } from '@/lib/reminder-preferences';

export function CareReminderPreference({ enabled, available, manager, farmName, leadDays = 3, hourUTC = 13 }: { enabled: boolean; available: boolean; manager: boolean; farmName: string; leadDays?: number; hourUTC?: number }) {
  const [value, setValue] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const [savedLead, setSavedLead] = useState(leadDays), [savedHour, setSavedHour] = useState(hourUTC);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true; setPending(true); setError(''); setMessage('');
    try {
      await saveCareReminderPreferences(data);
      setSavedLead(Number(data.get('leadDays'))); setSavedHour(Number(data.get('hourUTC')));
      setMessage('Reminder preferences saved. Changes apply to your next digest.');
    } catch { setError('Could not save preferences. Refresh and try again.'); }
    finally { inFlight.current = false; setPending(false); }
  }
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
      <p className="mt-1 text-xs leading-5 text-[#68736b]">{manager ? 'Overdue and upcoming work across' : 'Your assigned overdue and upcoming work at'} {farmName}. Includes overdue work, today{savedLead ? ` and the next ${savedLead} ${savedLead === 1 ? 'day' : 'days'}` : ''}. Only sends when work is due.</p>
      <p className="mt-1 text-xs text-[#68736b]">Daily around {String(savedHour).padStart(2, '0')}:00 UTC. Delivery may be delayed. Turn off anytime here or from an email.</p>
      {!available && <p className="mt-2 text-xs text-[#806537]">Email reminders are currently unavailable. You can still manage care here.</p>}
      {message && <p role="status" className="mt-2 text-xs text-[#315c47]">{message}</p>}
      {error && <p role="alert" className="mt-2 form-error text-xs">{error}</p>}
    </div>
    <button type="button" className="button-secondary" disabled={pending || (!available && !value)} onClick={change}>{pending ? 'Saving…' : value ? 'Turn off reminders' : 'Turn on reminders'}</button>
    <form onSubmit={save} className="reinwell-form w-full border-t border-[#dedbd1] pt-4"><fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
      <label>Advance notice<select aria-label="Reminder advance notice" name="leadDays" defaultValue={leadDays}>{REMINDER_LEAD_DAYS.map(days => <option key={days} value={days}>{days ? `${days} ${days === 1 ? 'day' : 'days'} ahead` : 'Due today and overdue only'}</option>)}</select></label>
      <label>Daily delivery window<select aria-label="Reminder delivery window" name="hourUTC" defaultValue={hourUTC}>{REMINDER_HOURS.map(hour => <option key={hour} value={hour}>Around {String(hour).padStart(2, '0')}:00 UTC</option>)}</select></label>
      <button className="button-secondary">Save reminder preferences</button>
    </fieldset><p className="mt-3 text-xs text-[#68736b]">These settings apply only to your emails for this farm. At most one digest per UTC day.</p></form>
  </section>;
}
