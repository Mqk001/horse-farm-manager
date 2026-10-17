'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MemberControls({ memberId, name, role }: { memberId: string; name: string; role: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState(role);
  const [confirm, setConfirm] = useState<'role' | 'remove' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save() {
    if (!confirm || pending) return;
    setPending(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: confirm === 'remove' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        ...(confirm === 'role' ? { body: JSON.stringify({ role: selected }) } : {}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error ?? 'Could not update farm access. Refresh and try again.'); return; }
      setMessage(confirm === 'remove' ? 'Farm access removed.' : 'Role updated.');
      setConfirm(null); router.refresh();
    } catch { setError('Could not connect. Please try again.'); }
    finally { setPending(false); }
  }
  return <div className="reinwell-form w-full sm:max-w-md">
    <fieldset disabled={pending} className="grid grid-cols-2 items-end gap-2 min-[1500px]:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="col-span-2 min-w-0 min-[1500px]:col-span-1">Role for {name}<select value={selected} onChange={event => { setSelected(event.target.value); setConfirm(null); setError(''); setMessage(''); }}><option value="STAFF">Staff</option><option value="MANAGER">Manager</option></select></label>
      <button type="button" className="button-secondary" disabled={selected === role} onClick={() => { setConfirm('role'); setError(''); }}>Save role</button>
      <button type="button" className="button-secondary text-[#883923]" onClick={() => { setConfirm('remove'); setError(''); }}>Remove</button>
    </fieldset>
    {confirm && <div role="group" aria-label={`Confirm access change for ${name}`} className="mt-3 rounded-xl border border-[#dedbd1] p-3 text-sm">
      <p>{confirm === 'remove' ? `Remove ${name} from this farm? They will lose access immediately and their care assignments will be cleared. Their recorded history will remain.` : selected === 'MANAGER' ? `Make ${name} a manager? They will be able to edit horses, schedule care, invite people, and change other members’ access.` : `Make ${name} staff? They will lose management controls but can still record activity and complete care.`}</p>
      <div className="mt-3 flex gap-2"><button type="button" className="button-primary" disabled={pending} onClick={save}>{pending ? 'Saving…' : confirm === 'remove' ? 'Confirm removal' : 'Confirm role change'}</button><button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirm(null)}>Cancel</button></div>
    </div>}
    {error && <p role="alert" className="form-error mt-3">{error}</p>}
    {message && <p role="status" className="form-success mt-3">{message}</p>}
  </div>;
}
