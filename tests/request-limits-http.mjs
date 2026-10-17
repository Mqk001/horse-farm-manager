import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3187';
const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{origin:base,'Content-Type':'application/json',...headers},body});
async function error(response,status,match){assert.equal(response.status,status);assert.match((await response.json()).error,match);}
await error(await post('/api/auth/login',JSON.stringify({unused:'x'.repeat(65536)})),413,/64 KiB/);
await error(await post('/api/auth/login',JSON.stringify({unused:'x'.repeat(10001)})),413,/10000/);
await error(await post('/api/auth/login',JSON.stringify({unused:Array(101).fill(0)})),413,/100 items/);
await error(await post('/api/auth/login','{"nested":'+'['.repeat(11)+'0'+']'.repeat(11)+'}'),413,/10 levels/);
await error(await post('/api/auth/login','{"email":'),400,/valid JSON/);
await error(await post('/api/auth/login','{}',{'content-encoding':'gzip'}),415,/Compressed/);
const stream=new ReadableStream({start(c){for(let i=0;i<17;i++)c.enqueue(new Uint8Array(4096).fill(32));c.close();}});
await error(await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:stream,duplex:'half'}),413,/64 KiB/);
const form=new FormData();form.set('photo',new File(['file'],'horse.jpg'));
await error(await fetch(base+'/team',{method:'POST',headers:{origin:base},body:form}),413,/File uploads/);
const oversized=new FormData();oversized.set('notes','x'.repeat(65537));
await error(await fetch(base+'/care',{method:'POST',headers:{origin:base},body:oversized}),413,/64 KiB/);
await error(await post('/api/auth/login','{}'),400,/Invalid email/);
console.log('PASS: real HTTP 413/400/415 errors for bytes, streamed overflow, fields, arrays, depth, malformed JSON, compression and form uploads; normal JSON reaches handler.');
