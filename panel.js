// panel.js - Pomodoro Panel Logic
// Author: GitHub Copilot

// ====== Motivation Texts ======
const MOTIVATION_TEXTS = [
  "Tập trung hoàn thành, đừng để ý đến mạng xã hội!",
  "Stay focused, your future self will thank you!",
  "Hoàn thành Pomodoro này, bạn sẽ thấy tự hào!",
  "Keep going, one step at a time!",
  "Đừng trì hoãn, hãy làm ngay bây giờ!",
  "No distractions, just action!",
  "Bạn làm được mà, cố lên!",
  "Every Pomodoro counts!",
  "Tập trung để thành công!",
  "Focus brings results!"
];
let shuffledTexts = [];
let currentTextIdx = 0;
let motivationTimer = null;

function shuffleArray(arr) {
  return arr.map(v => [Math.random(), v]).sort().map(a => a[1]);
}
function showMotivation(idx) {
  document.getElementById('motivation-text').textContent = shuffledTexts[idx];
}
function nextMotivation() {
  currentTextIdx = (currentTextIdx + 1) % shuffledTexts.length;
  showMotivation(currentTextIdx);
  resetMotivationTimer();
}
function prevMotivation() {
  currentTextIdx = (currentTextIdx - 1 + shuffledTexts.length) % shuffledTexts.length;
  showMotivation(currentTextIdx);
  resetMotivationTimer();
}
function resetMotivationTimer() {
  if (motivationTimer) clearTimeout(motivationTimer);
  motivationTimer = setTimeout(nextMotivation, 30000);
}

// ====== Pomodoro Logic ======
const CYCLE_LENGTH = 4; // Số chu kỳ làm việc trước nghỉ dài
let pomodoroState = null;
let pomodoroTimer = null;
let progressInterval = null;

function parsePreset(val) {
  return val.split(',').map(Number);
}
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}
function playAudio(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}
function setProgressBar(percent, text, phase) {
  const bar = document.getElementById('progressbar');
  bar.style.width = percent + '%';
  bar.textContent = text;
  bar.classList.remove('short-rest', 'long-rest');
  if (phase === 'short') bar.classList.add('short-rest');
  else if (phase === 'long') bar.classList.add('long-rest');
  else bar.classList.remove('short-rest', 'long-rest');
}
function blinkTaskInput(on) {
  const input = document.getElementById('task-input');
  if (on) input.classList.add('blink');
  else input.classList.remove('blink');
}
function resetUI() {
  document.getElementById('task-input').value = '';
  document.getElementById('task-input').classList.remove('is-invalid', 'blink');
  document.getElementById('preset-select').selectedIndex = 0;
  document.getElementById('custom-minutes').value = '';
  setProgressBar(0, '00:00');
}
function stopPomodoro() {
  if (pomodoroTimer) clearTimeout(pomodoroTimer);
  if (progressInterval) clearInterval(progressInterval);
  pomodoroState = null;
  blinkTaskInput(false);
  setProgressBar(0, '00:00');
  const bar = document.getElementById('progressbar');
  bar.classList.remove('paddingleft');
}
function startPomodoro() {
  stopPomodoro();
  const task = document.getElementById('task-input').value.trim();
  const custom = parseFloat(document.getElementById('custom-minutes').value);
  const preset = parsePreset(document.getElementById('preset-select').value);
  if (!task) {
    document.getElementById('task-input').classList.add('is-invalid');
    return;
  }
  document.getElementById('task-input').classList.remove('is-invalid');
  blinkTaskInput(true);
  
  const bar = document.getElementById('progressbar');
  bar.classList.add('paddingleft');

  if (!isNaN(custom) && custom > 0) {
    // Custom single phase
    runPhase('work', custom * 60, () => {
      blinkTaskInput(false);
      notify('Pomodoro', 'hết thời gian');
      playAudio('audio-long-rest');
      stopPomodoro();
    }, 'work');
  } else {
    // Pomodoro cycle
    pomodoroState = {
      phase: 'work',
      preset,
      cycle: 0,
      phaseIdx: 0
    };
    runPomodoroCycle();
  }
}
function runPhase(phase, seconds, onEnd, presetPhase) {
  let elapsed = 0;
  setProgressBar(100, formatTime(seconds), presetPhase);
  progressInterval = setInterval(() => {
    elapsed++;
    const remain = seconds - elapsed;
    setProgressBar(Math.max(0, 100 * (remain / seconds)), formatTime(remain), presetPhase);
    if (remain <= 0) {
      clearInterval(progressInterval);
      onEnd();
    }
  }, 1000);
}
function runPomodoroCycle() {
  if (!pomodoroState) return;
  const { preset, cycle, phase } = pomodoroState;
  let phaseName, seconds, audioId, notifyMsg;
  if (phase === 'work') {
    phaseName = 'work';
    seconds = preset[0] * 60;
    audioId = 'audio-working';
    notifyMsg = 'làm việc thôi';
  } else if (phase === 'short') {
    phaseName = 'short';
    seconds = preset[1] * 60;
    audioId = 'audio-short-rest';
    notifyMsg = 'nghỉ ngơi thôi';
  } else {
    phaseName = 'long';
    seconds = preset[2] * 60;
    audioId = 'audio-long-rest';
    notifyMsg = 'thư giãn thôi';
  }
  notify('Pomodoro', notifyMsg);
  playAudio(audioId);
  runPhase(phase, seconds, () => {
    // Next phase logic
    if (phase === 'work') {
      pomodoroState.cycle++;
      if (pomodoroState.cycle % CYCLE_LENGTH === 0) {
        pomodoroState.phase = 'long';
      } else {
        pomodoroState.phase = 'short';
      }
    } else {
      pomodoroState.phase = 'work';
    }
    runPomodoroCycle();
  }, phaseName);
}

// ====== Event Listeners ======
document.addEventListener('DOMContentLoaded', () => {
  // Motivation
  shuffledTexts = shuffleArray(MOTIVATION_TEXTS);
  currentTextIdx = 0;
  showMotivation(currentTextIdx);
  resetMotivationTimer();
  document.getElementById('btn-next').onclick = nextMotivation;
  document.getElementById('btn-prev').onclick = prevMotivation;

  // Pomodoro
  document.getElementById('btn-play').onclick = startPomodoro;
  document.getElementById('btn-stop').onclick = () => {
    stopPomodoro();
    resetUI();
  };
  document.getElementById('preset-select').onchange = () => {
    if (pomodoroState) {
      stopPomodoro();
      resetUI();
    }
  };
  document.getElementById('task-input').oninput = function() {
    this.classList.remove('is-invalid');
  };
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
});
