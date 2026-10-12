'use client';

const KEY = 'reinwell_pending_invitation';
export function rememberInvitation(token: string) {
  if (/^[a-f0-9]{64}$/.test(token)) sessionStorage.setItem(KEY, token);
}
export function clearInvitation() { sessionStorage.removeItem(KEY); }
export function afterSignInPath() {
  const token = sessionStorage.getItem(KEY);
  return token && /^[a-f0-9]{64}$/.test(token) ? `/invite#token=${token}` : '/dashboard';
}
