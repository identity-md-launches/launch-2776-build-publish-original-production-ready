import test from 'node:test';
import assert from 'node:assert/strict';
import { currentRules, isFresh, LivePoller, parseStatus, POLL_MS, retryDelay, STATUS_URL } from '../src/live.ts';
import { newGame } from '../src/engine.ts';
import { LEVELS } from '../src/levels.ts';
const now = Date.now();
const payload = (extra = {}) => ({ measurement: { coreStatus: 'SPINNING', rpmMilli: 12340, observedAt: new Date(now).toISOString(), freshness: 'online', staleAfterSeconds: 120, ...extra } });
test('reads only present measurement fields; zero rpm is valid, never infers a status', () => {
  assert.equal(parseStatus(payload(), now).rpmMilli, 12340);
  assert.equal(parseStatus(payload({ rpmMilli: 0, coreStatus: 'IDLE' }), now).rpmMilli, 0);
  for (const rpmMilli of [undefined, null, '12000', NaN, -1]) assert.equal(parseStatus(payload({ rpmMilli }), now).rpmMilli, undefined);
  assert.throws(() => parseStatus(payload({ coreStatus: undefined }), now), /invalid/);
  assert.throws(() => parseStatus({ coreStatus: 'SPINNING', rpmMilli: 50000 }, now), /invalid/);
});
test('stale, future, missing and malformed data fail closed into practice', () => {
  for (const raw of [null, {}, [], { measurement: null }, payload({ observedAt: 'yesterday' }), payload({ coreStatus: 'RUNNING' })]) assert.throws(() => parseStatus(raw, now));
  for (const raw of [payload({ freshness: 'offline' }), payload({ observedAt: new Date(now - 121000).toISOString() }), payload({ observedAt: new Date(now + 11000).toISOString() })]) assert.throws(() => parseStatus(raw, now), /stale/);
  assert.equal(currentRules({ problem: 'network', failures: 1 }).route, 'practice');
  assert.equal(currentRules({ measurement: parseStatus(payload(), now), failures: 0 }, now + 121000).route, 'practice');
});
test('rules are frozen separately from subsequent live updates', () => {
  let live = { measurement: parseStatus(payload(), now), failures: 0 };
  const game = newGame(LEVELS[0], currentRules(live, now));
  live = { measurement: parseStatus(payload({ coreStatus: 'IDLE' }), now), failures: 0 };
  assert.equal(currentRules(live, now).route, 'nap');
  assert.equal(game.rules.route, 'spinning'); assert.equal(game.rules.extraMoves, 2);
  assert.equal(isFresh(live, now), true);
});
test('poll interval and capped exponential backoff are deterministic', () => {
  assert.equal(POLL_MS, 15000);
  assert.deepEqual([0, 1, 2, 3, 20].map(retryDelay), [15000, 30000, 60000, 120000, 120000]);
});
async function onePoll(fetcher, timeout = 100) {
  let poller;
  const state = await new Promise(resolve => { poller = new LivePoller(next => { poller.stop(); resolve(next); }, fetcher, timeout); poller.start(); });
  return state;
}
test('HTTP errors and invalid JSON trigger backoff without fake telemetry', async () => {
  const state = await onePoll(async () => new Response('down', { status: 503 }));
  assert.equal(state.problem, 'network'); assert.equal(state.failures, 1); assert.equal(state.measurement, undefined);
  const json = await onePoll(async () => new Response('<html>bad gateway</html>'));
  assert.equal(json.problem, 'network');
});
test('request timeout aborts the request and emits a recoverable practice state', async () => {
  const state = await onePoll((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))), 15);
  assert.equal(state.problem, 'timeout'); assert.equal(currentRules(state).route, 'practice');
});
test('successful request uses official source, no credentials, and present data', async () => {
  const state = await onePoll(async (url, options) => {
    assert.equal(url, STATUS_URL); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    return Response.json(payload({ observedAt: new Date().toISOString() }));
  });
  assert.equal(state.problem, undefined); assert.equal(state.failures, 0); assert.equal(state.measurement.coreStatus, 'SPINNING');
});
test('default fetch preserves the native browser receiver', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    assert.equal(this, globalThis);
    return Response.json(payload({ observedAt: new Date().toISOString() }));
  };
  try {
    const state = await onePoll(undefined);
    assert.equal(state.problem, undefined);
    assert.equal(state.measurement.coreStatus, 'SPINNING');
  } finally { globalThis.fetch = original; }
});
test('manual recovery resets backoff; stop prevents callbacks and overlap', async () => {
  let count = 0, poller;
  const values = [];
  await new Promise(resolve => {
    poller = new LivePoller(next => {
      values.push(next);
      if (values.length === 1) queueMicrotask(() => poller.retry());
      else { poller.stop(); resolve(); }
    }, async () => ++count === 1 ? new Response('', { status: 503 }) : Response.json(payload({ observedAt: new Date().toISOString() })));
    poller.start(); poller.retry();
  });
  assert.equal(count, 2); assert.equal(values[0].failures, 1); assert.equal(values[1].failures, 0);
});
