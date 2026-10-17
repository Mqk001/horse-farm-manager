import assert from 'node:assert/strict';
import { readWorkspaceSnapshot, invalidateWorkspaceSnapshot, subscribeWorkspaceSnapshot } from '../src/lib/workspace-client-cache';
async function main() {
  const savedFetch = globalThis.fetch, savedNow = Date.now;
  let now = 1000, calls = 0;
  const snapshot = (name: string) => ({ user: { name, email: 'fixture@example.test' }, farm: { id: name, name, role: 'STAFF' }, farms: [] });
  try {
    Date.now = () => now;
    globalThis.fetch = async (url, init) => { assert.equal(url, '/api/me'); assert.equal(init?.cache, 'no-store'); calls++; return Response.json(snapshot('first')); };
    await Promise.all(Array.from({ length: 20 }, () => readWorkspaceSnapshot()));
    assert.equal(calls, 1);
    await readWorkspaceSnapshot(); assert.equal(calls, 1);
    now += 10001; await readWorkspaceSnapshot(); assert.equal(calls, 2);
    let notifications = 0;
    const unsubscribe = subscribeWorkspaceSnapshot(() => { notifications++; });
    invalidateWorkspaceSnapshot(); assert.equal(notifications, 1);
    await readWorkspaceSnapshot(); assert.equal(calls, 3);
    unsubscribe();
    invalidateWorkspaceSnapshot();
    globalThis.fetch = async () => { calls++; return Response.json({}, { status: 401 }); };
    await assert.rejects(readWorkspaceSnapshot());
    globalThis.fetch = async () => { calls++; return Response.json(snapshot('recovered')); };
    assert.equal((await readWorkspaceSnapshot()).farm?.name, 'recovered');
    invalidateWorkspaceSnapshot();
    let finish!: (value: Response) => void;
    globalThis.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
    const old = readWorkspaceSnapshot(); await Promise.resolve();
    invalidateWorkspaceSnapshot();
    globalThis.fetch = async () => Response.json(snapshot('new-account'));
    finish(Response.json(snapshot('old-account')));
    assert.equal((await old).farm?.name, 'new-account', 'An in-flight response from a previous scope cannot return old account data');
    console.log('PASS: 20 concurrent consumers use one request; revisits reuse cache; TTL and mutation invalidation refetch; 401 is not cached; invalidated in-flight account data is discarded');
  } finally { globalThis.fetch = savedFetch; Date.now = savedNow; invalidateWorkspaceSnapshot(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
