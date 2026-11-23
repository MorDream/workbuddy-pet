#!/usr/bin/env node
// Launcher that strips WorkBuddy's ELECTRON_RUN_AS_NODE / NODE_OPTIONS before
// starting Electron. In a plain terminal these vars are absent and this is a no-op.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function electronBin() {
  try {
    return require('electron');
  } catch {
    // fallback: read path.txt from the electron package
    const p = path.join(ROOT, 'node_modules', 'electron', 'path.txt');
    if (fs.existsSync(p)) {
      return path.join(ROOT, 'node_modules', 'electron', 'dist', fs.readFileSync(p, 'utf8').trim());
    }
    throw new Error('electron binary not found; run `npm install` first');
  }
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;

const child = spawn(electronBin(), [path.join(ROOT, 'src', 'electron-main.cjs')], {
  env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (err) => {
  console.error('failed to start pet:', err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
