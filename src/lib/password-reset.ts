import { createHash, randomBytes } from 'crypto';
import { hashPassword } from '@/lib/passwords';
import { z } from 'zod';
import { prisma } from './prisma';

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});
export function resetTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export async function issuePasswordReset(userId: string) {
  const token = randomBytes(32).toString('hex');
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.create({ data: { userId, sessionVersion: user.sessionVersion, tokenHash: resetTokenHash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  });
  return token;
}
export async function resetPassword(token: string, password: string) {
  const parsed = resetPasswordSchema.safeParse({ token, password });
  if (!parsed.success) return false;
  const tokenHash = resetTokenHash(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt <= new Date()) return false;
  const hashedPassword = await hashPassword(password);
  return prisma.$transaction(async tx => {
    const consumed = await tx.passwordResetToken.deleteMany({ where: { id: record.id, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) return false;
    const changed = await tx.user.updateMany({ where: { id: record.userId, sessionVersion: record.sessionVersion }, data: { password: hashedPassword, sessionVersion: { increment: 1 } } });
    if (changed.count !== 1) return false;
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    return true;
  });
}

export function passwordResetOrigin(request: Request): string | null {
  try {
    const origin = new URL(request.headers.get('origin') ?? '');
    const url = new URL(request.url);
    return origin.origin === request.headers.get('origin') && origin.host === (request.headers.get('host') ?? url.host) && origin.protocol === url.protocol ? origin.origin : null;
  } catch { return null; }
}
