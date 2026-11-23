import { EventEmitter } from 'node:events';
import {
  EVENT_TIER,
  WORK_ANIM,
  WORK_TEXT,
  IDLE_POOL,
  IDLE_TEXTS,
  pick,
} from './config.mjs';

// How long a tier stays before the pet drifts back to idle (ms).
// Working/thinking get a long leash: a single long Bash call can take minutes.
const TIER_TTL = {
  thinking: 180_000,
  working: 300_000,
  result: 90_000,
  waiting: 180_000,
  success: 30_000,
  error: 90_000,
};

export class PetState extends EventEmitter {
  constructor() {
    super();
    this.counter = 0;
    this.mode = 'idle'; // idle | work | sleep
    this.tier = 'idle';
    this.anim = IDLE_POOL[0];
    this.bubble = IDLE_TEXTS[0];
    this.task = '';
    this.tool = '';
    this.sessionId = '';
    this.generationId = '';
    this.source = 'init';
    this.updatedAt = Date.now();
    this.history = [];
    this._idleTimer = null;
  }

  snapshot() {
    return {
      counter: this.counter,
      mode: this.mode,
      tier: this.tier,
      anim: this.anim,
      bubble: this.bubble,
      task: this.task,
      tool: this.tool,
      sessionId: this.sessionId,
      generationId: this.generationId,
      source: this.source,
      updatedAt: this.updatedAt,
      history: this.history.slice(0, 20),
    };
  }

  _commit(patch) {
    Object.assign(this, patch);
    this.counter += 1;
    this.updatedAt = Date.now();
    this.emit('change', this.snapshot());
  }

  _pushHistory(entry) {
    this.history = [{ at: Date.now(), ...entry }, ...this.history].slice(0, 50);
  }

  _scheduleIdle() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    const ttl = TIER_TTL[this.tier] ?? 60_000;
    this._idleTimer = setTimeout(() => {
      if (this.mode === 'work') this.setIdle('auto-idle');
    }, ttl);
    this._idleTimer.unref?.();
  }

  setIdle(source = 'manual') {
    if (this.mode === 'sleep') return { ok: false, reason: 'sleeping' };
    this._pushHistory({ event: 'idle', from: this.tier });
    this._commit({
      mode: 'idle',
      tier: 'idle',
      anim: pick(IDLE_POOL),
      bubble: pick(IDLE_TEXTS),
      source,
      tool: '',
    });
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    return { ok: true };
  }

  setWorkTier(tier, meta = {}) {
    if (this.mode === 'sleep') return { ok: false, reason: 'sleeping' };
    if (!(tier in WORK_ANIM)) return { ok: false, reason: 'unknown-tier', tier };
    const patch = {
      mode: 'work',
      tier,
      anim: WORK_ANIM[tier],
      bubble: pick(WORK_TEXT[tier]),
      source: meta.source ?? 'api',
    };
    if (meta.task) patch.task = String(meta.task).slice(0, 500);
    if (meta.tool !== undefined) patch.tool = String(meta.tool).slice(0, 200);
    if (meta.sessionId) patch.sessionId = String(meta.sessionId);
    if (meta.generationId) patch.generationId = String(meta.generationId);
    this._pushHistory({ event: tier, tool: patch.tool ?? this.tool });
    this._commit(patch);
    this._scheduleIdle();
    return { ok: true };
  }

  // Main entry point: a WorkBuddy hook event arrives.
  applyHook(payload = {}) {
    const event = payload.hook_event_name || payload.event || '';
    const sessionId = payload.session_id || '';
    const generationId = payload.generation_id || '';

    if (this.mode === 'sleep') {
      this._pushHistory({ event, blocked: 'sleeping' });
      return { ok: false, reason: 'sleeping', event };
    }

    if (event === 'UserPromptSubmit') {
      return this.setWorkTier('thinking', {
        source: 'hook:UserPromptSubmit',
        task: (payload.prompt || '').split('\n')[0].slice(0, 200),
        sessionId,
        generationId,
      });
    }

    if (event === 'PreToolUse' || event === 'SubagentStart') {
      return this.setWorkTier('working', {
        source: `hook:${event}`,
        tool: payload.tool_name || '',
        sessionId,
        generationId,
      });
    }

    if (event === 'PostToolUse' || event === 'SubagentStop') {
      return this.setWorkTier('result', {
        source: `hook:${event}`,
        tool: payload.tool_name || '',
        sessionId,
        generationId,
      });
    }

    if (event === 'PostToolUseFailure' || event === 'StopFailure' || event === 'PermissionDenied') {
      return this.setWorkTier('error', {
        source: `hook:${event}`,
        tool: payload.tool_name || '',
        sessionId,
        generationId,
      });
    }

    if (event === 'Stop') {
      return this.setWorkTier('success', {
        source: 'hook:Stop',
        sessionId,
        generationId,
      });
    }

    if (event === 'Notification') {
      const type = payload.notification_type || '';
      // Only "needs your input" notifications flip the pet to waiting.
      if (['permission_prompt', 'elicitation_dialog', 'idle_prompt'].includes(type)) {
        return this.setWorkTier('waiting', {
          source: `hook:Notification:${type}`,
          sessionId,
          generationId,
        });
      }
      this._pushHistory({ event, ignored: type });
      return { ok: true, ignored: true, event };
    }

    if (event === 'SessionEnd') {
      return this.setIdle('hook:SessionEnd');
    }

    if (event === 'SessionStart') {
      this._pushHistory({ event });
      this._commit({
        mode: 'idle',
        tier: 'idle',
        anim: pick(IDLE_POOL),
        bubble: '我醒啦，有活尽管叫我~',
        source: 'hook:SessionStart',
        sessionId,
        task: '',
        tool: '',
      });
      return { ok: true };
    }

    // Generic fallback for future / unknown events with a known tier.
    const tier = EVENT_TIER[event];
    if (tier && tier !== 'idle') {
      return this.setWorkTier(tier, { source: `hook:${event}`, sessionId, generationId });
    }

    this._pushHistory({ event, ignored: 'unmapped' });
    return { ok: true, ignored: true, event };
  }

  setAnim(name, source = 'api') {
    if (this.mode === 'sleep') return { ok: false, reason: 'sleeping' };
    this._pushHistory({ event: 'anim', name });
    this._commit({ anim: String(name), source });
    return { ok: true };
  }

  setBubble(text, source = 'api') {
    this._pushHistory({ event: 'say', text: String(text).slice(0, 200) });
    this._commit({ bubble: String(text).slice(0, 500), source });
    return { ok: true };
  }

  sleep() {
    this._pushHistory({ event: 'sleep' });
    this._commit({
      mode: 'sleep',
      tier: 'idle',
      anim: SLEEP_ANIM_LOOP,
      bubble: '呼……呼……（在睡觉，别烦我）',
      source: 'api:sleep',
    });
    if (this._idleTimer) clearTimeout(this._idleTimer);
    return { ok: true };
  }

  wake() {
    if (this.mode !== 'sleep') return { ok: true, alreadyAwake: true };
    this._pushHistory({ event: 'wake' });
    this._commit({
      mode: 'idle',
      anim: pick(IDLE_POOL),
      bubble: '唔……我醒了，主人！',
      source: 'api:wake',
    });
    return { ok: true };
  }
}

const SLEEP_ANIM_LOOP = '睡觉-循环';
