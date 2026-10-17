import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/passwords';
import { prisma } from '@/lib/prisma';

export class GoogleAccountError extends Error {
  constructor(readonly code: 'verify_first' | 'use_password' | 'terms_required' | 'account_conflict') { super(code); }
}
export type GoogleIdentity = { subject: string; email: string; name: string | null; authoritativeEmail: boolean };
export async function resolveGoogleAccount(identity: GoogleIdentity, termsAccepted: boolean) {
  const linked = await prisma.user.findUnique({ where: { googleSubject: identity.subject } });
  if (linked) {
    if (!linked.emailVerifiedAt) throw new GoogleAccountError('verify_first');
    return linked;
  }
  // Google only guarantees current mailbox ownership for Gmail and Workspace.
  if (!identity.authoritativeEmail) throw new GoogleAccountError('use_password');
  const existing = await prisma.user.findUnique({ where: { email: identity.email } });
  if (existing) {
    // Do not activate a pre-registered password through social sign-in.
    if (!existing.emailVerifiedAt) throw new GoogleAccountError('verify_first');
    if (existing.googleSubject) throw new GoogleAccountError('account_conflict');
    const claimed = await prisma.user.updateMany({ where: { id: existing.id, googleSubject: null, emailVerifiedAt: { not: null } }, data: { googleSubject: identity.subject } });
    if (!claimed.count) throw new GoogleAccountError('account_conflict');
    return existing;
  }
  if (!termsAccepted) throw new GoogleAccountError('terms_required');
  // No usable password is created; email/password login cannot guess this value.
  const password = await hashPassword(randomBytes(48).toString('base64url'));
  return prisma.user.create({ data: { email: identity.email, name: identity.name, googleSubject: identity.subject, password, role: 'STAFF', emailVerifiedAt: new Date(), termsAcceptedAt: new Date() } });
}
