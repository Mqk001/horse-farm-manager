import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { gunzipSync, brotliDecompressSync, gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const compression = require('next/dist/compiled/compression');

function request(url, accept = 'identity') {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, { headers: { 'Accept-Encoding': accept } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try {
          const wire = Buffer.concat(chunks);
          const encoding = response.headers['content-encoding'] ?? 'identity';
          assert.ok(['identity', 'gzip', 'br'].includes(encoding), `Unexpected/nested encoding: ${encoding}`);
          const body = encoding === 'gzip' ? gunzipSync(wire) : encoding === 'br' ? brotliDecompressSync(wire) : wire;
          resolve({ status: response.statusCode, headers: response.headers, encoding, wire, body });
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

if (process.argv[2]) {
  // Read-only live checks; use public routes only, without account credentials.
  const base = new URL(process.argv[2]);
  for (const path of ['/', '/api/me']) {
    const identity = await request(new URL(path, base));
    for (const accept of ['gzip', 'br', 'gzip, br', 'gzip;q=0, br;q=0, identity;q=1']) {
      const result = await request(new URL(path, base), accept);
      assert.equal(result.status, identity.status);
      assert.deepEqual(result.body, identity.body);
      if (path.startsWith('/api/')) JSON.parse(result.body.toString('utf8'));
      else {
        if (!accept.includes('q=0')) {
          assert.notEqual(result.encoding, 'identity');
          assert.ok(result.wire.length < identity.wire.length * 0.8);
        }
      }
      if (accept.includes('q=0')) assert.equal(result.encoding, 'identity');
      console.log(JSON.stringify({ path, accept, encoding: result.encoding, identityBytes: identity.wire.length, wireBytes: result.wire.length, savingsPercent: +(100 * (1 - result.wire.length / identity.wire.length)).toFixed(1) }));
    }
  }
} else {
  // Exercise the installed Next.js compression implementation with controlled
  // fixtures. These routes are test-only; they are never added to the app.
  const json = Buffer.from(JSON.stringify({ tasks: Array.from({ length: 100 }, (_, i) => ({ id: i, title: 'Groom the horse and refill water', completed: false })) }));
  const zipped = gzipSync(json);
  const fixtures = {
    '/json': { type: 'application/json', body: json },
    '/text': { type: 'text/plain', body: Buffer.from('Farm care task\n'.repeat(1000)) },
    '/small': { type: 'application/json', body: Buffer.from('{"ok":true}') },
    '/png': { type: 'image/png', body: Buffer.alloc(4096, 42) },
    '/encoded': { type: 'application/json', body: zipped, encoding: 'gzip' },
  };
  const compress = compression(); // Next default: 1,024-byte threshold.
  const server = http.createServer((req, res) => compress(req, res, () => {
    const fixture = fixtures[req.url];
    if (!fixture) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', fixture.type);
    res.setHeader('Content-Length', fixture.body.length);
    if (fixture.encoding) res.setHeader('Content-Encoding', fixture.encoding);
    res.end(fixture.body);
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = new URL(`http://127.0.0.1:${server.address().port}`);
    for (const path of ['/json', '/text']) {
      const identity = await request(new URL(path, base));
      const gzip = await request(new URL(path, base), 'gzip');
      assert.equal(gzip.encoding, 'gzip');
      assert.deepEqual(gzip.body, identity.body);
      assert.ok(gzip.wire.length < identity.wire.length * 0.5);
      assert.match(gzip.headers.vary, /Accept-Encoding/i);
      if (path === '/json') assert.deepEqual(JSON.parse(gzip.body), JSON.parse(identity.body));
      console.log(`PASS ${path}: ${identity.wire.length} → ${gzip.wire.length} bytes; decoded content identical`);
    }
    for (const path of ['/small', '/png']) {
      const result = await request(new URL(path, base), 'gzip');
      assert.equal(result.encoding, 'identity');
      assert.deepEqual(result.body, fixtures[path].body);
    }
    const encoded = await request(new URL('/encoded', base), 'gzip');
    assert.deepEqual(encoded.wire, zipped); // Never compressed a second time.
    assert.deepEqual(encoded.body, json);
    const excluded = await request(new URL('/json', base), 'gzip;q=0, identity;q=1');
    assert.equal(excluded.encoding, 'identity');
    console.log('PASS small responses, binary MIME type, existing encoding, and Accept-Encoding exclusions');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
