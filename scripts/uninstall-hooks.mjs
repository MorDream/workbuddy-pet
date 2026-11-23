#!/usr/bin/env node
// Remove WorkBuddy pet hooks from user settings (idempotent).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SETTINGS = path.join(os.homedir(), '.workbuddy', 'settings.json');

if (!fs.existsSync(SETTINGS)) {
  console.log('settings not found, nothing to do');
  process.exit(0);
}
const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
if (!settings.hooks) {
  console.log('no hooks configured, nothing to do');
  process.exit(0);
}

let removed = 0;
for (const [event, groups] of Object.entries(settings.hooks)) {
  settings.hooks[event] = groups.filter((g) => {
    const keep = !(g.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('forward.mjs'));
    if (!keep) removed++;
    return keep;
  });
  if (settings.hooks[event].length === 0) delete settings.hooks[event];
}
if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

const backup = `${SETTINGS}.bak-${Date.now()}`;
fs.copyFileSync(SETTINGS, backup);
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
console.log(`Removed ${removed} hook group(s). Backup: ${backup}`);
