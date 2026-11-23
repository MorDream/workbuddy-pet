// Pet renderer: long-polls /state and switches WebM animations live.
const video = document.getElementById('pet');
const bubble = document.getElementById('bubble');
const badge = document.getElementById('mode-badge');
const taskText = document.getElementById('task-text');

let currentAnim = '';
let lastCounter = -1;
const bubbleTimers = new Map();

function animUrl(name) {
  return `/assets/webm/${encodeURIComponent(name)}.webm`;
}

function playAnim(name) {
  if (!name || name === currentAnim) return;
  const url = animUrl(name);
  video.src = url;
  video.load();
  video.play().catch(() => {});
  currentAnim = name;
}

function render(s) {
  // Work tier overrides mode badge; idle = 摸鱼中; sleep = Zzz
  if (s.mode === 'sleep') {
    badge.textContent = '睡觉中';
    badge.className = 'sleep';
  } else if (s.mode === 'work') {
    badge.textContent = tierLabel(s.tier);
    badge.className = 'work';
  } else {
    badge.textContent = '摸鱼中';
    badge.className = '';
  }
  taskText.textContent = s.task ? `· ${s.task}` : '';

  if (s.bubble) {
    bubble.textContent = s.bubble;
    bubble.classList.remove('hidden');
    const key = s.counter;
    clearTimeout(bubbleTimers.get(key));
    bubbleTimers.set(key, setTimeout(() => bubble.classList.add('hidden'), 8000));
  }

  playAnim(s.anim);
}

function tierLabel(tier) {
  return {
    thinking: '思考中', working: '工作中', result: '整理中',
    waiting: '等你确认', success: '完成啦', error: '出错啦',
  }[tier] || tier;
}

async function pollState() {
  try {
    const res = await fetch(`/state?since=${lastCounter}&timeout=10000`);
    const s = await res.json();
    if (s.counter !== lastCounter) {
      lastCounter = s.counter;
      render(s);
    }
  } catch {
    // service temporarily unavailable; retry
  }
  setTimeout(pollState, 300);
}

// Click: quick response (local only, no service needed for instant feedback)
document.getElementById('stage').addEventListener('click', async () => {
  try {
    await fetch('/anim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '点击回应-开心跃动' }),
    });
  } catch {}
});

pollState();
