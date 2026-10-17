import assert from 'node:assert/strict';
import { databaseUrl, runtimeDatabaseUrl } from '../src/lib/database-url';

const host = 'aws-1-us-west-2.pooler.supabase.com';
const direct = 'postgresql://postgres:fake%40password@db.fixtureproject.supabase.co:5432/postgres';
const pooled = new URL(databaseUrl(direct, host)!);
assert.equal(pooled.hostname, host);
assert.equal(pooled.username, 'postgres.fixtureproject');
assert.equal(pooled.password, 'fake%40password');
assert.equal(pooled.port, '6543');
assert.equal(pooled.pathname, '/postgres');
assert.equal(pooled.searchParams.get('pgbouncer'), 'true');
assert.equal(pooled.searchParams.get('sslmode'), 'require');
assert.equal(pooled.searchParams.get('connection_limit'), '1');
assert.equal(new URL(databaseUrl(direct + '?connection_limit=3', host)!).searchParams.get('connection_limit'), '3');
assert.equal(databaseUrl('file:./dev.db', host), 'file:./dev.db');
assert.equal(databaseUrl(direct, undefined), direct);
assert.equal(databaseUrl(pooled.toString(), host), pooled.toString());
assert.equal(databaseUrl('postgresql://user:fake@localhost:5432/postgres', host), 'postgresql://user:fake@localhost:5432/postgres');
assert.throws(() => databaseUrl(direct, 'untrusted.example'));
console.log('PASS: pooler conversion preserves credentials/database, requires TLS, and leaves local and already-pooled URLs unchanged');

const runtime = new URL(runtimeDatabaseUrl(direct, undefined)!);
for (const [key, value] of Object.entries({ connection_limit: '4', connect_timeout: '5', pool_timeout: '5', socket_timeout: '10' })) assert.equal(runtime.searchParams.get(key), value);
assert.equal(new URL(runtimeDatabaseUrl(direct, host)!).searchParams.get('connection_limit'), '1');
assert.equal(new URL(runtimeDatabaseUrl(direct + '?socket_timeout=2&pool_timeout=0&connection_limit=100', undefined)!).searchParams.get('socket_timeout'), '2');
assert.equal(new URL(runtimeDatabaseUrl(direct + '?pool_timeout=0&connection_limit=100', undefined)!).searchParams.get('pool_timeout'), '5');
assert.equal(new URL(runtimeDatabaseUrl(direct + '?connection_limit=100', undefined)!).searchParams.get('connection_limit'), '4');
assert.equal(runtimeDatabaseUrl('file:./dev.db', undefined), 'file:./dev.db');
console.log('PASS: bounded runtime connection count, acquire/connect/query timeouts; stricter configuration and SQLite preserved');

const alreadyPooled = new URL(pooled);
alreadyPooled.searchParams.delete('pgbouncer'); alreadyPooled.searchParams.set('connection_limit', '100');
const safePooled = new URL(runtimeDatabaseUrl(alreadyPooled.toString(), undefined)!);
assert.equal(safePooled.searchParams.get('pgbouncer'), 'true');
assert.equal(safePooled.searchParams.get('connection_limit'), '1');
console.log('PASS: already-pooled Supabase transaction URLs also enforce PgBouncer compatibility and one connection per instance');
