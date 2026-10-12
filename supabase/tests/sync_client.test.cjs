// node supabase/tests/sync_client.test.cjs — isolated transport/storage regression tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../SupabaseSync/supabase_sync.js'), 'utf8');
const META = 'dup_supabase_sync_meta_v2';
const OUTBOX = 'dup_supabase_outbox_v1';
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function harness(data = {}, fetchImpl) {
  let calls = 0, sockets = 0;
  const context = {
    console, crypto, AbortController, navigator: { userAgent: 'test' },
    setTimeout: () => 1, clearTimeout() {},
    WebSocket: function () { sockets++; },
    fetch: async (...args) => { calls++; return fetchImpl(...args); },
    chrome: { runtime: { onMessage: { addListener() {} }, sendMessage: async () => {}, getURL: x => x },
      storage: { local: {
        get(keys, cb) {
          const selected = keys === null ? data : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, data[k]]));
          cb(clone(selected));
        },
        set(values, cb) { Object.assign(data, clone(values)); cb(); },
        remove(keys, cb) { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete data[k]); cb(); }
      } }
    }
  };
  vm.createContext(context);
  const instrumented = source.replace('  globalThis.__dupSupabaseSync = {', `
  globalThis.testHooks = { compactOutboxItems, claimNextOutboxItemForAttempt, fetchSupabaseWithTimeout,
    applyCanonicalState, normalizeCanonicalState, handleRuntimeMessage, setSyncMeta,
    loadStoredSession, getRemoteCanonicalState };
  globalThis.__dupSupabaseSync = {`).replace(/  function delay\(ms\) \{[\s\S]*?\n  \}/,
    '  async function delay(ms) {}');
  vm.runInContext(instrumented, context);
  return { data, context, hooks: context.testHooks, api: context.__dupSupabaseSync,
    calls: () => calls, sockets: () => sockets };
}
const response = (status, data) => ({ status, ok: status < 400, statusText: String(status),
  headers: { get: () => null }, text: async () => JSON.stringify(data), json: async () => data });

(async () => {
  const h = harness({ setting_copy_mode: true });
  assert.equal((await h.api.syncSet({ setting_copy_mode: true })).operationsQueued, 0);
  assert.equal(h.calls(), 0);
  h.data.dup_execution_analysis_state_v1 = { status: 'ready', currentBatch: null, nextLaunchAt: 0, sourcePageId: '' };
  assert.equal((await h.api.syncSet({ dup_execution_analysis_state_v1:
    { status: 'running', currentBatch: ['temporary'], nextLaunchAt: 100, sourcePageId: 'tab' } })).operationsQueued, 0);

  const sent = { mutationId: 'already-sent', deviceId: 'test', attempts: 1,
    operations: [{ type: 'counter_increment', counter_key: 'stats_history', date_key: '12.10.2026', delta: 1 }] };
  const fresh = { ...clone(sent), mutationId: 'fresh', attempts: 0 };
  const compacted = h.hooks.compactOutboxItems([sent, fresh]);
  assert.equal(compacted.outbox[0].mutationId, sent.mutationId);
  assert.equal(compacted.outbox[0].operations[0].delta, 1);
  h.data[OUTBOX] = [sent];
  const first = (await h.hooks.claimNextOutboxItemForAttempt()).item;
  const restarted = harness(h.data);
  assert.equal((await restarted.hooks.claimNextOutboxItemForAttempt()).item.sequence, first.sequence);
  assert.equal(restarted.data[OUTBOX][0].mutationId, 'already-sent');

  h.data[OUTBOX] = [];
  const before = clone(h.data);
  assert.equal(await h.hooks.applyCanonicalState(h.hooks.normalizeCanonicalState({ revision: 10, unchanged: true })), false);
  assert.deepEqual(h.data, before);
  await Promise.all([h.hooks.setSyncMeta({ transportPausedUntil: 9999999999999 }), h.hooks.setSyncMeta({ lastError: 'test' })]);
  assert.equal(h.data[META].transportPausedUntil, 9999999999999);

  const quota = harness({}, async () => response(402, {}));
  await assert.rejects(quota.hooks.fetchSupabaseWithTimeout('/rest/v1/test'), e => e.status === 402);
  assert.equal(quota.calls(), 1, '402 must not try the fallback origin');
  const quotaRestart = harness(quota.data, async () => response(200, {}));
  await assert.rejects(quotaRestart.hooks.fetchSupabaseWithTimeout('/auth/v1/user'), e => e.status === 402);
  await quotaRestart.api.startRealtimeSubscription();
  await quotaRestart.hooks.handleRuntimeMessage({ action: 'DUP_SUPABASE_GET_STATUS' });
  assert.equal(quotaRestart.calls(), 0);
  assert.equal(quotaRestart.sockets(), 0);

  const offline = harness({}, async () => response(503, {}));
  await offline.hooks.fetchSupabaseWithTimeout('/rest/v1/test');
  assert.equal(offline.calls(), 2);
  await assert.rejects(offline.hooks.fetchSupabaseWithTimeout('/rest/v1/test'), e => e.isTransportPaused);
  assert.equal(offline.calls(), 2);

  const rpcNames = [];
  const active = harness({
    dup_supabase_auth_session_v1: { access_token: 'test', refresh_token: 'test', expires_at: 9999999999,
      user: { id: '11111111-1111-1111-1111-111111111111' } },
    dup_supabase_device_id_v1: 'test', setting_copy_mode: true,
    [OUTBOX]: [{ mutationId: 'queued', deviceId: 'test', attempts: 0, baseRevision: 1,
      operations: [{ type: 'counter_increment', counter_key: 'stats_history', date_key: '12.10.2026', delta: 1 }] }]
  }, async (url, options) => {
    const name = url.split('/').pop(); rpcNames.push(name);
    if (name === 'extension_register_device_v3') return response(200, { revision: 1, last_sequence: 0 });
    if (name === 'extension_apply_mutation_v3') {
      assert.ok(JSON.parse(options.body).p_sequence > 0);
      return response(200, { status: 'applied', revision: 2, applied_revision: 2 });
    }
    if (name === 'extension_get_state_v3') return response(200, { revision: 2, kv: { setting_copy_mode: true },
      counter_days: [{ counter_key: 'stats_history', date_key: '12.10.2026', value: 1 }] });
    throw new Error('unexpected RPC ' + name);
  });
  await active.hooks.loadStoredSession();
  assert.equal((await active.api.flushOutbox()).success, true);
  assert.equal(active.data.setting_copy_mode, true, 'short ack must not erase local settings');
  assert.equal(active.data.stats_history['12.10.2026'], 1);
  assert.equal(active.data[OUTBOX].length, 0);
  assert.deepEqual(rpcNames, ['extension_register_device_v3', 'extension_apply_mutation_v3', 'extension_get_state_v3']);

  console.log('Passed: unchanged values, sent-packet identity, durable sequence, conditional cache, metadata concurrency, 402 pause/restart, no status traffic, offline backoff, compact acknowledgement.');
})().catch(error => { console.error(error); process.exitCode = 1; });
