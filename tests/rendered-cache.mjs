import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shared = ['/', '/terms', '/privacy', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/invite', '/onboarding', '/auth/google/complete'];
const privateRoutes = ['/dashboard', '/horses', '/horses/[id]', '/horses/[id]/edit', '/horses/new', '/care', '/team', '/api/me', '/api/team/revision'];
const manifest = JSON.parse(await readFile(new URL('../.next/prerender-manifest.json', import.meta.url), 'utf8'));
for (const path of shared) {
  assert.ok(manifest.routes[path], `${path} must have a prerendered shell`);
  assert.equal(manifest.routes[path].initialRevalidateSeconds, false, `${path} regenerates on a new build`);
}
for (const path of privateRoutes) assert.ok(!manifest.routes[path], `${path} must not have shared prerendered data`);
console.log('PASS: shared shells prerendered; private farm pages and APIs excluded from full-route prerender cache');

if (process.argv[2]) {
  const base = new URL(process.argv[2]);
  for (const path of ['/', '/terms', '/privacy', '/login']) {
    let baseline;
    const samples = [];
    for (const headers of [{}, { 'Accept-Language': 'en-US' }, { 'Accept-Language': 'fr-FR', Cookie: 'reinwell_farm=cache-audit-invalid-farm' }]) {
      const start = performance.now();
      const response = await fetch(new URL(path, base), { headers, redirect: 'manual' });
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.ok(!response.headers.has('set-cookie'));
      assert.ok(!html.includes('cache-audit-invalid-farm'));
      assert.match(html, /<html[^>]*lang="en"/); // Currently English-only.
      if (baseline !== undefined) assert.equal(html, baseline, 'Public output must not vary by selected farm or language header');
      baseline = html;
      samples.push({ cache: response.headers.get('x-vercel-cache'), elapsedMs: Math.round(performance.now() - start) });
    }
    assert.ok(samples.some(sample => sample.cache === 'HIT'), `${path} must demonstrate a CDN hit`);
    console.log(JSON.stringify({ path, samples }));
  }
  const dashboard = await fetch(new URL('/dashboard', base), { redirect: 'manual' });
  assert.equal(dashboard.status, 307);
  assert.equal(new URL(dashboard.headers.get('location'), base).pathname, '/login');
  const me = await fetch(new URL('/api/me', base));
  assert.equal(me.status, 401);
  assert.ok(!['HIT', 'STALE', 'PRERENDER'].includes(me.headers.get('x-vercel-cache')));
  console.log('PASS: private routes still require sign-in; unauthenticated account API not shared-cache served');
}
