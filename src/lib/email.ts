function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export async function sendVerificationEmail({ to, name, verificationUrl }: { to: string; name: string; verificationUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const safeName = escapeHtml(name);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Reinwell <onboarding@resend.dev>',
      to: [to],
      subject: 'Verify your Reinwell email',
      text: `Hi ${name},\n\nVerify your email to finish creating your Reinwell account:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi ${safeName},</p><p>Verify your email to finish creating your Reinwell account.</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    }),
  });

  if (!response.ok) throw new Error(`Resend rejected the verification email (${response.status})`);
}
