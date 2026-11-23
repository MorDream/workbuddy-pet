import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const DEFAULT_PORT = 17340;
export const HOST = '127.0.0.1';

export const RUNTIME_DIR = path.join(os.homedir(), '.workbuddy-pet');
export const PORT_FILE = path.join(RUNTIME_DIR, 'port');
export const LOG_FILE = path.join(RUNTIME_DIR, 'pet.log');

// Work-status tiers: aligned with dsh-pet's 6 workStatus animations.
// 0 thinking / 1 working / 2 result / 3 waiting / 4 success / 5 error
export const WORK_TIERS = ['thinking', 'working', 'result', 'waiting', 'success', 'error'];

export const WORK_ANIM = {
  thinking: '工作状态-思考冒泡',
  working: '工作状态-忙碌点按',
  result: '工作状态-清点归档',
  waiting: '工作状态-原地踱步张望',
  success: '工作状态-雀跃庆祝',
  error: '工作状态-垂头叹气冒汗',
};

export const WORK_TEXT = {
  thinking: ['正在认真想下一步呢', '让我整理一下思路~', '正在梳理接下来要做什么'],
  working: ['正在处理任务呢', '这一步正在进行中哦', '正在继续干活呢，别打扰我~'],
  result: ['这一步处理好啦，接着看下一步', '搞定一步，继续看看哦~'],
  waiting: ['需要你确认一下呢', '这里要等你看一下哦', '轮到你来决定啦，等你~'],
  success: ['这一轮搞定啦，真棒！', '任务完成咯，可以摸鱼啦~'],
  error: ['这一步好像没跑通呢', '刚才的操作遇到点问题哦', '这里卡了一下，再等等你呢'],
};

// Idle / leisure animations — reused from dsh-pet's random chain pools.
export const IDLE_POOL = [
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
];

export const IDLE_TEXTS = [
  '主人今天也在努力呀，我先在旁边玩会儿~',
  '摸鱼中……有活叫我哦',
  '伸个懒腰，Ready！',
  '发呆中……要不要陪我玩？',
  '我先把小鲸鱼养着，等你回来~',
];

export const CLICK_ANIMS = [
  '点击回应-开心跃动',
  '点击回应-害羞惊讶',
  '点击回应-傲娇生气',
  '点击回应-挠痒咯咯笑',
  '点击回应-元气挥手',
];

export const SLEEP_ANIM = { start: '睡觉-开始', loop: '睡觉-循环', end: '睡觉-起来' };

// Map WorkBuddy hook events to work tiers (codex-pet style: state signal, not emotion).
export const EVENT_TIER = {
  UserPromptSubmit: 'thinking',
  SessionStart: 'idle',
  PreToolUse: 'working',
  PostToolUse: 'result',
  PostToolUseFailure: 'error',
  Notification: 'waiting',
  PermissionRequest: 'waiting',
  PermissionDenied: 'error',
  Stop: 'success',
  StopFailure: 'error',
  SubagentStart: 'working',
  SubagentStop: 'result',
  PreCompact: 'thinking',
  PostCompact: 'result',
  TaskCreated: 'thinking',
  TaskCompleted: 'success',
  SessionEnd: 'idle',
};

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
