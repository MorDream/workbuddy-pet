#!/usr/bin/env node
// WorkBuddy hook -> local pet control service.
// Reads hook JSON from stdin, POSTs it to /event, emits nothing to agent context.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_PORT, PORT_FILE } from '../src/config.mjs';

const PORT_FILE_PATH = PORT_FILE;

function resolvePort() {
  try {
    const p = Number(fs.readFileSync(PORT_FILE_PATH, 'utf8').trim());
    if (Number.isFinite(p) && p > 0) return p;
  } catch {}
  return DEFAULT_PORT;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', async () => {
  try {
    const payload = input ? JSON.parse(input) : {};
    const port = resolvePort();
    await fetch(`http://127.0.0.1:${port}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Never block the agent. Pet service may not be running.
  }
  // Structured output: no context injection, no transcript noise.
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
});
