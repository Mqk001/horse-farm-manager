import { DependencyCircuit } from './dependency-circuit';

const emailCircuit = new DependencyCircuit({ name: 'Email delivery', timeoutMs: 5000, maxConcurrent: 4, failureThreshold: 3, cooldownMs: 30000 });

async function deliverEmail(init: RequestInit) {
  return emailCircuit.run(async signal => {
    const response = await fetch('https://api.resend.com/emails', { ...init, signal });
    // Delivery only needs status; do not retain an unread provider body/socket.
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Email provider rejected delivery (${response.status})`);
    return response;
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export type ReminderEmailPayload = { from: string; to: string[]; subject: string; text: string; html: string };
export type ReminderEmailItem = { title: string; due: string; status: string; assignee: string; url: string };

export function careReminderEmail({ to, farmName, day, manager, items, more, workspaceUrl, unsubscribeUrl }: {
  to: string; farmName: string; day: string; manager: boolean; items: ReminderEmailItem[];
  more: boolean; workspaceUrl: string; unsubscribeUrl: string;
}): ReminderEmailPayload {
  const intro = manager ? 'Your farm’s overdue and upcoming work' : 'Your assigned overdue and upcoming work';
  const lines = items.map(item => `${item.status}: ${item.title} — due ${item.due} — ${item.assignee}\n${item.url}`);
  const list = items.map(item => `<li style="margin-bottom:16px"><strong>${escapeHtml(item.status)}</strong> · <a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a><br>Due ${escapeHtml(item.due)} · ${escapeHtml(item.assignee)}</li>`).join('');
  const note = 'Snapshot prepared for this digest. Completed or rescheduled work may have changed; open Reinwell for the latest schedule. Dates use UTC.';
  const extra = more ? 'Showing the first 50 items. Open Reinwell to see all work.' : '';
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('Reminder sender is not configured');
  return {
    from, to: [to], subject: `${farmName}: your daily care reminder`,
    text: `${intro} · ${farmName}\n${day} (UTC)\n\n${lines.join('\n\n')}\n\n${extra}\n${note}\nOpen your farm (select ${farmName} if prompted): ${workspaceUrl}\n\nYou enabled daily reminders for this farm. Turn them off: ${unsubscribeUrl}`,
    html: `<h1>Daily care reminder</h1><p>${escapeHtml(intro)} · <strong>${escapeHtml(farmName)}</strong><br>${escapeHtml(day)} (UTC)</p><ul>${list}</ul><p>${extra}</p><p>${escapeHtml(note)}</p><p><a href="${escapeHtml(workspaceUrl)}">Open your farm</a> (select ${escapeHtml(farmName)} if prompted).</p><hr><p>You enabled daily reminders for this farm. <a href="${escapeHtml(unsubscribeUrl)}">Turn off reminders</a>.</p>`,
  };
}

export async function sendCareReminder(payload: ReminderEmailPayload, idempotencyKey: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  await deliverEmail({ method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) });
}

export async function sendVerificationEmail({ to, name, verificationUrl }: { to: string; name: string; verificationUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const safeName = escapeHtml(name);
  const response = await deliverEmail({
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Reinwell <onboarding@resend.dev>',
      to: [to],
      subject: 'Verify your Reinwell email',
      text: `Hi ${name},\n\nVerify your email to finish creating your Reinwell account:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi ${safeName},</p><p>Verify your email to finish creating your Reinwell account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    }),
  });

  if (!response.ok) throw new Error(`Resend rejected the verification email (${response.status})`);
}

export async function sendFarmInvitationEmail({ to, farmName, role, invitationUrl }: { to: string; farmName: string; role: string; invitationUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await deliverEmail({ method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
    from: process.env.EMAIL_FROM ?? 'Reinwell <onboarding@resend.dev>', to: [to], subject: `You are invited to ${farmName} on Reinwell`,
    text: `You have been invited to join ${farmName} as ${role.toLowerCase()}.\n\nAccept invitation: ${invitationUrl}\n\nThis link expires in 7 days.`,
    html: `<p>You have been invited to join <strong>${escapeHtml(farmName)}</strong> as ${escapeHtml(role.toLowerCase())}.</p><p><a href="${escapeHtml(invitationUrl)}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
  }) });
  if (!response.ok) throw new Error(`Resend rejected the invitation email (${response.status})`);
}

export async function sendPasswordResetEmail({ to, name, resetUrl }: { to: string; name: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await deliverEmail({
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Reinwell <onboarding@resend.dev>', to: [to], subject: 'Reset your Reinwell password',
      text: `Hi ${name},\n\nReset your Reinwell password:\n${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.`,
      html: `<p>Hi ${escapeHtml(name)},</p><p><a href="${escapeHtml(resetUrl)}">Reset your Reinwell password</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) throw new Error('Password reset email delivery failed');
}
