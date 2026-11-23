#!/usr/bin/env node
// Install WorkBuddy hooks that forward real-time agent state to the pet service.
// Idempotent: re-running refreshes the hook commands to this repo's absolute path.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from '../src/config.mjs';

const SETTINGS = path.join(os.homedir(), '.workbuddy', 'settings.json');
const FORWARD = path.join(ROOT, 'bin', 'forward.mjs').replace(/\\/g, '/');
const COMMAND = `node "${FORWARD}"`;

const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'PermissionRequest',
  'PermissionDenied',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'TaskCreated',
  'TaskCompleted',
  'SessionEnd',
];

function load() {
  if (!fs.existsSync(SETTINGS)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (e) {
    console.error(`cannot parse ${SETTINGS}: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  const settings = load();
  settings.hooks = settings.hooks || {};

  for (const event of EVENTS) {
    const list = settings.hooks[event] || [];
    // Remove only our own old hook entries (identified by forward.mjs path).
    const cleaned = list.filter((group) => {
      const hs = group.hooks || [];
      return !hs.some((h) => typeof h.command === 'string' && h.command.includes('forward.mjs'));
    });

    const matcher = (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure')
      ? '.*' : undefined;
    const group = {
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: COMMAND, timeout: 5 }],
    };
    settings.hooks[event] = [...cleaned, group];
  }

  const backup = `${SETTINGS}.bak-${Date.now()}`;
  fs.copyFileSync(SETTINGS, backup);
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  console.log(`Installed ${EVENTS.length} pet hooks into ${SETTINGS}`);
  console.log(`Backup: ${backup}`);
  console.log('Note: WorkBuddy requires reviewing external hook changes in the /hooks panel before they take effect.');
}

main();
