import assert from 'node:assert/strict';
import { DependencyCircuit, DependencyUnavailableError } from '../src/lib/dependency-circuit';
async function main() {
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const config = { name: 'fixture', timeoutMs: 25, maxConcurrent: 2, failureThreshold: 2, cooldownMs: 100 };
let now = 0;
const breaker = new DependencyCircuit({ ...config, now: () => now });
let calls = 0;
const fail = async () => { calls++; throw new Error('provider failed'); };
await assert.rejects(breaker.run(fail));
await assert.rejects(breaker.run(fail));
await assert.rejects(breaker.run(fail), (e: unknown) => e instanceof DependencyUnavailableError && e.reason === 'open');
assert.equal(calls, 2);
now = 100;
let finish!: (value: string) => void;
const probe = breaker.run(() => new Promise<string>(resolve => { finish = resolve; }));
await Promise.resolve();
await assert.rejects(breaker.run(fail), (e: unknown) => e instanceof DependencyUnavailableError && e.reason === 'open');
finish('recovered');
assert.equal(await probe, 'recovered');
assert.equal(await breaker.run(async () => 'healthy'), 'healthy');

// Timeout rejects promptly, aborts transport, and trips the breaker.
const slow = new DependencyCircuit({ ...config, failureThreshold: 1 });
let aborted = false;
await assert.rejects(slow.run(signal => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }))), (e: unknown) => e instanceof DependencyUnavailableError && e.reason === 'timeout');
assert.ok(aborted);
await assert.rejects(slow.run(async () => 'must not start'));
// Other dependency remains available while this provider is down.
assert.equal(await breaker.run(async () => 'unrelated'), 'unrelated');

// Ignoring cancellation must not free slots and allow unbounded actual work.
const bounded = new DependencyCircuit({ ...config, maxConcurrent: 1, failureThreshold: 10 });
let release!: () => void;
const pending = bounded.run(() => new Promise<void>(resolve => { release = resolve; }));
await assert.rejects(pending);
await assert.rejects(bounded.run(async () => undefined), (e: unknown) => e instanceof DependencyUnavailableError && e.reason === 'busy');
release(); await pause(0);
assert.equal(await bounded.run(async () => 'free'), 'free');

// A late concurrent success cannot close a newly opened circuit.
const race = new DependencyCircuit({ ...config, failureThreshold: 1 });
let late!: () => void;
const old = race.run(() => new Promise<void>(resolve => { late = resolve; }));
await assert.rejects(race.run(fail));
late(); await old;
await assert.rejects(race.run(async () => 'must not start'));

// Expected client errors do not trip; a failed half-open probe reopens.
let clock = 0;
const classified = new DependencyCircuit({ ...config, failureThreshold: 1, now: () => clock, isFailure: error => error instanceof TypeError });
for (let i = 0; i < 4; i++) await assert.rejects(classified.run(async () => { throw new Error('invalid user input'); }));
assert.equal(await classified.run(async () => 'available'), 'available');
await assert.rejects(classified.run(async () => { throw new TypeError('network'); }));
clock = 100;
await assert.rejects(classified.run(async () => { throw new TypeError('still down'); }));
await assert.rejects(classified.run(async () => 'must not start'));
clock = 200;
assert.equal(await classified.run(async () => 'recovered'), 'recovered');
console.log('PASS: timeout/cancellation, bounded actual concurrency, opening/fast failure, single recovery probe, failed probe, clean recovery, stale completion isolation, expected errors, and independent dependencies');

}
main().catch(error => { console.error(error); process.exitCode = 1; });
