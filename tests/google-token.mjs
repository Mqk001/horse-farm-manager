import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mock } from 'node:test';
import { OAuth2Client } from 'google-auth-library';
import { beginGoogleFlow, decodeGoogleFlow, verifyGoogleCode } from '../src/lib/google-oauth.ts';
assert.ok(process.env.AUTH_SECRET?.startsWith('reinwell-google-test-'),'Use test configuration');
const flowStart=await beginGoogleFlow(false);
const state=new URL(flowStart.url).searchParams.get('state');
const flow=decodeGoogleFlow(flowStart.cookie,state,process.env.GOOGLE_AUTH_ORIGIN);
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const {privateKey:attackerKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
const now=Math.floor(Date.now()/1000);
const claims={iss:'https://accounts.google.com',aud:process.env.GOOGLE_CLIENT_ID,sub:'fixture-google-id',email:'fixture@gmail.com',email_verified:true,nonce:flow.nonce,iat:now-10,exp:now+3600};
function jwt(payload,key=privateKey){const body=header+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');}
let token=jwt(claims);
// Replace only the provider transport. Google's actual JWT verifier still runs.
mock.method(OAuth2Client.prototype,'getFederatedSignonCertsAsync',async()=>({certs:{'test-key':publicKey.export({type:'spki',format:'pem'})},format:'PEM'}));
mock.method(OAuth2Client.prototype,'getToken',async options=>{assert.equal(options.codeVerifier,flow.verifier);return {tokens:{id_token:token}};});
assert.equal((await verifyGoogleCode('fixture-code',flow)).subject,claims.sub);
for(const override of [{aud:'attacker-client'},{iss:'https://attacker.example'},{exp:now-1000},{nonce:'wrong-nonce'},{email_verified:false},{email:undefined},{sub:undefined}]){
 token=jwt({...claims,...override});await assert.rejects(verifyGoogleCode('fixture-code',flow));
}
token=jwt(claims,attackerKey);await assert.rejects(verifyGoogleCode('fixture-code',flow));
mock.restoreAll();
console.log('PASS: actual Google-library signature/audience/issuer/expiry validation and application nonce/verified-email/subject checks with a simulated provider transport');
