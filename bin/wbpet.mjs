#!/usr/bin/env node
// Manual control CLI for the pet.
// Usage: wbpet <command> [args]
//   status                    current pet state
//   thinking|working|result|waiting|success|error [task]
//   idle                      go back to leisure mode
//   sleep | wake
//   anim <name>               play a named WebM animation
//   say <text>                show a bubble
//   anims                     list available animations
//   event <JSON>              inject a raw hook-style event
import fs from 'node:fs';
import { DEFAULT_PORT, PORT_FILE, WORK_TIERS } from '../src/config.mjs';

const [, , cmd, ...args] = process.argv;

function resolvePort() {
  try {
    const p = Number(fs.readFileSync(PORT_FILE, 'utf8').trim());
    if (Number.isFinite(p) && p > 0) return p;
  } catch {}
  return DEFAULT_PORT;
}
const BASE = `http://127.0.0.1:${resolvePort()}`;

async function req(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

const usage = `wbpet — WorkBuddy 桌宠控制
用法:
  wbpet status                       查看当前状态
  wbpet thinking|working|result|waiting|success|error [任务描述]
  wbpet idle                         回到闲暇摸鱼
  wbpet sleep | wake                 睡觉 / 叫醒
  wbpet anim <动画名>                 播放指定动画
  wbpet say <文本>                    头顶气泡说一句话
  wbpet anims                        列出全部可用动画
  wbpet event '<JSON>'               注入原始 hook 事件
`;

if (!cmd || cmd === '--help' || cmd === '-h') {
  process.stdout.write(usage);
  process.exit(0);
}

try {
  let out;
  if (cmd === 'status') out = await req('/state');
  else if (cmd === 'idle') out = await req('/idle', 'POST');
  else if (cmd === 'sleep') out = await req('/sleep', 'POST');
  else if (cmd === 'wake') out = await req('/wake', 'POST');
  else if (cmd === 'anims' || cmd === 'animations') out = await req('/animations');
  else if (cmd === 'anim') out = await req('/anim', 'POST', { name: args.join(' ') });
  else if (cmd === 'say') out = await req('/say', 'POST', { text: args.join(' ') });
  else if (cmd === 'event') out = await req('/event', 'POST', JSON.parse(args.join(' ')));
  else if (WORK_TIERS.includes(cmd)) {
    out = await req('/work-status', 'POST', { state: cmd, task: args.join(' ') });
  } else {
    process.stderr.write(`unknown command: ${cmd}\n${usage}`);
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} catch (err) {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
}
