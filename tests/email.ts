import assert from 'node:assert/strict';
import { sendVerificationEmail, sendFarmInvitationEmail, sendPasswordResetEmail } from '../src/lib/email';
async function main() {
 const savedFetch=globalThis.fetch;
 const savedKey=process.env.RESEND_API_KEY, savedFrom=process.env.EMAIL_FROM;
 try {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(sendVerificationEmail({to:'recipient@example.test',name:'Test',verificationUrl:'https://example.test/verify#token=dummy'}),/not configured/);
  process.env.RESEND_API_KEY='test-only-key'; delete process.env.EMAIL_FROM;
  const payloads:any[]=[];
  globalThis.fetch=async (_url,init)=>{payloads.push(JSON.parse(String(init?.body)));return new Response('{}',{status:403});};
  await assert.rejects(sendVerificationEmail({to:'recipient@example.test',name:'<Test>',verificationUrl:'https://example.test/verify#token=dummy'}),/403/);
  await assert.rejects(sendFarmInvitationEmail({to:'recipient@example.test',farmName:'<Farm>',role:'STAFF',invitationUrl:'https://example.test/invite#token=dummy'}),/403/);
  assert.match(payloads[0].html,/&lt;Test&gt;/);assert.match(payloads[1].html,/&lt;Farm&gt;/);
  assert.match(payloads[0].from,/onboarding@resend.dev/);
  process.env.EMAIL_FROM='Reinwell <accounts@example.test>';
  globalThis.fetch=async (_url,init)=>{payloads.push(JSON.parse(String(init?.body)));return new Response('{"id":"test-only"}',{status:200});};
  await sendVerificationEmail({to:'recipient@example.test',name:'Test',verificationUrl:'https://example.test/verify#token=dummy'});
  assert.equal(payloads.at(-1).from,process.env.EMAIL_FROM);
  const hostileText = '<img src=x onerror="alert(1)"> & \'quoted\'';
  const hostileUrl = 'https://example.test/link?a=1&b=" onclick="alert(1)';
  await sendVerificationEmail({to:'recipient@example.test',name:hostileText,verificationUrl:hostileUrl});
  await sendFarmInvitationEmail({to:'recipient@example.test',farmName:hostileText,role:hostileText,invitationUrl:hostileUrl});
  await sendPasswordResetEmail({to:'recipient@example.test',name:hostileText,resetUrl:hostileUrl});
  for (const payload of payloads.slice(-3)) {
   assert.ok(!payload.html.includes('<img'));
   assert.ok(!payload.html.includes('" onclick="'));
   assert.ok(payload.html.includes('&lt;img'));
   assert.ok(payload.html.includes('href="https://example.test/link?a=1&amp;b=&quot; onclick=&quot;alert(1)"'));
  }
  console.log('PASS: email configuration failure, Resend 403 handling for both mail types, escaping, configured sender; all provider requests mocked');
 } finally {
  globalThis.fetch=savedFetch;
  if(savedKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=savedKey;
  if(savedFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=savedFrom;
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
