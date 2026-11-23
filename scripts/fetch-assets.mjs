#!/usr/bin/env node
// Fetch the animation assets we reuse from PC2005-cloud/dsh-pet via GitHub API.
// Raw.githubusercontent is blocked by some local proxies; the API works.
// Source: https://github.com/PC2005-cloud/dsh-pet  (assets CC BY-NC-SA 4.0)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from '../src/config.mjs';

const DEST = path.join(ROOT, 'assets', 'webm');
const REPO = 'PC2005-cloud/dsh-pet';
const API = 'https://api.github.com/repos';

// Work tiers (6) + idle pool + clicks + sleep
const NAMES = [
  '工作状态-思考冒泡',
  '工作状态-忙碌点按',
  '工作状态-清点归档',
  '工作状态-原地踱步张望',
  '工作状态-雀跃庆祝',
  '工作状态-垂头叹气冒汗',
  '待机呼吸休闲',
  '悠闲哼歌',
  '超大伸懒腰',
  '原地敲击桌面互动',
  '写代码',
  '轻快记录',
  '摇扇纳凉',
  '原地漂浮踏步',
  '东张西望',
  '原地专心玩魔方',
  '可爱宅舞',
  '吃Token',
  '吃冰淇淋融化',
  '玩水枪',
  '点击回应-开心跃动',
  '点击回应-害羞惊讶',
  '点击回应-傲娇生气',
  '点击回应-挠痒咯咯笑',
  '点击回应-元气挥手',
  '睡觉-开始',
  '睡觉-循环',
  '睡觉-起来',
];

function token() {
  // Reuse the git credential store like the rest of the local setup.
  try {
    const f = path.join(os.homedir(), '.git-credentials');
    const line = fs.readFileSync(f, 'utf8').split('\n').find((l) => l.includes('@github.com'));
    if (!line) return '';
    const cred = line.match(/https:\/\/([^@]+)@github\.com/)?.[1] || '';
    return cred.includes(':') ? cred.slice(cred.lastIndexOf(':') + 1) : cred;
  } catch { return ''; }
}

async function download(name) {
  const file = name + '.webm';
  const out = path.join(DEST, file);
  if (fs.existsSync(out) && fs.statSync(out).size > 10_000) {
    console.log(`skip  ${file}`);
    return 'skip';
  }
  const url = `${API}/${REPO}/contents/dsh-pet/assets/webm/${encodeURIComponent(file)}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'workbuddy-pet-fetch' };
  const ghToken = token();
  if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    console.warn(`FAIL  ${file} — HTTP ${res.status}`);
    return 'fail';
  }
  const json = await res.json();
  if (!json.content) {
    console.warn(`FAIL  ${file} — no content in API response`);
    return 'fail';
  }
  const buf = Buffer.from(json.content.replace(/\s/g, ''), 'base64');
  fs.writeFileSync(out, buf);
  console.log(`ok    ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
  return 'ok';
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  let ok = 0, fail = 0;
  for (const name of NAMES) {
    const r = await download(name);
    if (r === 'ok') ok++;
    if (r === 'fail') fail++;
  }
  console.log(`\ndone: ${ok} downloaded, ${fail} failed, ${NAMES.length - ok - fail} already present`);
  if (fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
