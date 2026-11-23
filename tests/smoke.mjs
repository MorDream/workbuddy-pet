#!/usr/bin/env node
// End-to-end smoke test of the control service + state machine.
import assert from 'node:assert/strict';
import { startServer } from '../src/server.mjs';

const PORT = 18740;
const BASE = `http://127.0.0.1:${PORT}`;

async function req(p, method = 'GET', body) {
  const res = await fetch(BASE + p, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  });
  return { status: res.status, json: await res.json() };
}

const { server, state } = await startServer({ port: PORT, writePortFile: false });
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

try {
  console.log('control service:');
  let r = await req('/health');
  check('health returns ok', () => assert.equal(r.json.ok, true));

  r = await req('/state');
  check('initial state is idle', () => {
    assert.equal(r.json.mode, 'idle');
    assert.ok(r.json.anim.includes('待机') || r.json.anim.length > 0);
  });

  console.log('hook -> state mapping:');
  r = await req('/event', 'POST', { hook_event_name: 'UserPromptSubmit', prompt: '帮我写一个网站', session_id: 's1' });
  check('UserPromptSubmit -> thinking', () => {
    assert.equal(r.json.ok, true);
    assert.equal(state.tier, 'thinking');
    assert.equal(state.task, '帮我写一个网站');
  });

  r = await req('/event', 'POST', { hook_event_name: 'PreToolUse', tool_name: 'Bash' });
  check('PreToolUse -> working', () => assert.equal(state.tier, 'working'));

  r = await req('/event', 'POST', { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
  check('PostToolUse -> result', () => assert.equal(state.tier, 'result'));

  r = await req('/event', 'POST', { hook_event_name: 'Notification', notification_type: 'permission_prompt' });
  check('permission notification -> waiting', () => assert.equal(state.tier, 'waiting'));

  r = await req('/event', 'POST', { hook_event_name: 'Stop' });
  check('Stop -> success', () => assert.equal(state.tier, 'success'));

  r = await req('/event', 'POST', { hook_event_name: 'UserPromptSubmit', prompt: 'again' });
  r = await req('/event', 'POST', { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' });
  check('tool failure -> error', () => assert.equal(state.tier, 'error'));

  console.log('sleep gate:');
  await req('/sleep', 'POST');
  r = await req('/event', 'POST', { hook_event_name: 'UserPromptSubmit', prompt: 'wake me' });
  check('sleeping blocks hook events', () => assert.equal(r.json.reason, 'sleeping'));
  await req('/wake', 'POST');
  r = await req('/state');
  check('wake returns to idle', () => assert.equal(r.json.mode, 'idle'));

  console.log('manual controls:');
  r = await req('/work-status', 'POST', { state: 'thinking', task: '手工任务' });
  check('external work-status writes thinking', () => {
    assert.equal(r.json.ok, true);
    assert.equal(state.tier, 'thinking');
  });
  r = await req('/work-status', 'POST', { state: 'bogus' });
  check('invalid tier rejected', () => assert.equal(r.status, 400));
  r = await req('/idle', 'POST');
  check('idle clears work', () => assert.equal(state.mode, 'idle'));
  r = await req('/say', 'POST', { text: '你好呀' });
  check('say writes bubble', () => assert.equal(state.bubble, '你好呀'));
  r = await req('/animations');
  check('animations endpoint works', () => assert.ok(Array.isArray(r.json.animations)));

  console.log('long-poll:');
  const before = state.counter;
  const pending = req(`/state?since=${before}&timeout=3000`);
  await new Promise((r) => setTimeout(r, 50));
  await req('/say', 'POST', { text: '触发长轮询返回' });
  r = await pending;
  check('state change resolves long-poll', () => assert.equal(r.json.bubble, '触发长轮询返回'));

  console.log(`\n${passed} checks passed.`);
} finally {
  server.close();
}
