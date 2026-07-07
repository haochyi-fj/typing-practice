// ===== 配置 =====
const CONFIG = {
  API_BASE: 'https://typing-api.256589617.workers.dev',
  STORAGE_KEYS: {
    history: 'typing_history',
    docs: 'typing_docs',
    settings: 'typing_settings'
  },
  defaultText: `春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。
床前明月光，疑是地上霜。举头望明月，低头思故乡。
白日依山尽，黄河入海流。欲穷千里目，更上一层楼。
千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。`,
  maxLocalDocs: 20,
  maxHistory: 50
};

let state = {
  mode: 'time',
  timeLimit: 60,
  countLimit: 200,
  isRunning: false,
  isFinished: false,
  isPaused: false,
  startTime: null,
  endTime: null,
  timerId: null,
  elapsed: 0,
  totalErrors: 0,
  totalTyped: 0,
  totalCorrect: 0,
  currentText: '',
  currentDocName: '默认文本',
  currentDocId: null,
  history: [],
  localDocs: [],
  cloudDocs: [],
  docTab: 'local'
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function init() {
  loadSettings();
  loadHistory();
  loadLocalDocs();
  state.currentText = CONFIG.defaultText;
  renderTextDisplay();
  updateDocInfo();
  bindEvents();
  window.addEventListener('scroll', handleScroll);
  document.addEventListener('keydown', handleGlobalKey);
}

function bindEvents() {
  $('sidebarToggle').addEventListener('click', toggleSidebar);
  const input = $('typingInput');
  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('paste', (e) => e.preventDefault());
  document.addEventListener('click', (e) => {
    const sidebar = $('sidebar');
    const toggle = $('sidebarToggle');
    if (window.innerWidth <= 768 && sidebar.classList.contains('show-mobile') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('show-mobile');
    }
  });
}

function toggleSidebar() {
  const sidebar = $('sidebar');
  const main = $('main');
  const toggle = $('sidebarToggle');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('show-mobile');
    return;
  }
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('sidebar-collapsed');
  toggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

function renderTextDisplay() {
  const display = $('textDisplay');
  const text = state.currentText;
  display.innerHTML = text.split('').map((char, i) => 
    `<span class="char" data-index="${i}" id="char-${i}">${char === '\n' ? '<br>' : char}</span>`
  ).join('');
}

function updateDocInfo() {
  $('docName').textContent = state.currentDocName;
  $('docMeta').textContent = `共 ${state.currentText.length} 字`;
}

function handleInput(e) {
  if (state.isFinished) {
    e.target.value = e.target.value.slice(0, state.currentText.length);
    return;
  }
  const input = e.target;
  const value = input.value;
  const text = state.currentText;
  if (!state.isRunning && value.length > 0) {
    startTimer();
  }
  if (state.mode === 'count' && value.length >= state.countLimit) {
    input.value = value.slice(0, state.countLimit);
  }
  updateCharHighlights(value, text);
  updateStats(value, text);
  if (value.length >= text.length) {
    finishPractice();
  }
}

function handleKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
  }
}

function updateCharHighlights(typed, target) {
  const maxLen = Math.max(typed.length, target.length);
  for (let i = 0; i < maxLen; i++) {
    const charEl = $(`char-${i}`);
    if (!charEl) continue;
    charEl.classList.remove('correct', 'incorrect', 'current');
    if (i < typed.length) {
      if (typed[i] === target[i]) {
        charEl.classList.add('correct');
      } else {
        charEl.classList.add('incorrect');
      }
    } else if (i === typed.length) {
      charEl.classList.add('current');
    }
  }
  const currentEl = document.querySelector('.char.current');
  if (currentEl) {
    currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateStats(typed, target) {
  let correct = 0;
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < target.length && typed[i] === target[i]) {
      correct++;
    } else {
      errors++;
    }
  }
  state.totalCorrect = correct;
  state.totalErrors = errors;
  state.totalTyped = typed.length;
  const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 / 60 : 0;
  if (elapsed > 0.01) {
    const wpm = Math.round(state.totalTyped / elapsed);
    const cpm = Math.round((state.totalTyped + state.totalErrors) / elapsed);
    const accuracy = state.totalTyped > 0 ? Math.round((state.totalCorrect / state.totalTyped) * 100) : 100;
    $('wpm').textContent = wpm || 0;
    $('cpm').textContent = cpm || 0;
    $('accuracy').textContent = `${accuracy}%`;
    $('errors').textContent = state.totalErrors;
  }
  const progress = target.length > 0 ? (typed.length / target.length) * 100 : 0;
  $('progressBar').style.width = `${progress}%`;
  $('progressText').textContent = `${Math.round(progress)}%`;
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.startTime = Date.now();
  const timerEl = $('timer');
  const timerCard = $('timerCard');
  if (state.mode === 'time') {
    let remaining = state.timeLimit;
    timerEl.textContent = remaining;
    state.timerId = setInterval(() => {
      remaining--;
      state.elapsed = state.timeLimit - remaining;
      timerEl.textContent = remaining;
      if (remaining <= 10) {
        timerCard.classList.add('warning');
      }
      if (remaining <= 0) {
        finishPractice();
      }
      updateStats($('typingInput').value, state.currentText);
    }, 1000);
  } else {
    $('timerLabel').textContent = '已用时间';
    timerEl.textContent = '0';
    state.timerId = setInterval(() => {
      state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      timerEl.textContent = state.elapsed;
      updateStats($('typingInput').value, state.currentText);
    }, 1000);
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function setMode(mode) {
  if (state.isRunning) return;
  state.mode = mode;
  $$('[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  $('timeSetting').style.display = mode === 'time' ? 'flex' : 'none';
  $('countSetting').style.display = mode === 'count' ? 'flex' : 'none';
  if (mode === 'time') {
    $('timer').textContent = state.timeLimit;
    $('timerLabel').textContent = '倒计时';
  } else {
    $('timer').textContent = '0';
    $('timerLabel').textContent = '已用时间';
  }
  $('timerCard').classList.remove('warning');
}

function updateSettings() {
  if (state.isRunning) return;
  state.timeLimit = parseInt($('timeInput').value) || 60;
  state.countLimit = parseInt($('countInput').value) || 200;
  if (state.mode === 'time') {
    $('timer').textContent = state.timeLimit;
  }
  saveSettings();
}

function startPractice() {
  if (state.isRunning) return;
  resetPractice();
  $('typingInput').disabled = false;
  $('typingInput').focus();
  $('startBtn').textContent = '⏸ 暂停';
  $('startBtn').onclick = pausePractice;
}

function pausePractice() {
  if (!state.isRunning || state.isFinished) return;
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    stopTimer();
    $('typingInput').disabled = true;
    $('startBtn').textContent = '▶ 继续';
  } else {
    state.startTime = Date.now() - state.elapsed * 1000;
    startTimer();
    $('typingInput').disabled = false;
    $('typingInput').focus();
    $('startBtn').textContent = '⏸ 暂停';
  }
}

function resetPractice() {
  stopTimer();
  state.isRunning = false;
  state.isFinished = false;
  state.isPaused = false;
  state.startTime = null;
  state.endTime = null;
  state.elapsed = 0;
  state.totalErrors = 0;
  state.totalTyped = 0;
  state.totalCorrect = 0;
  $('typingInput').value = '';
  $('typingInput').disabled = true;
  $('typingInput').placeholder = '点击"开始练习"后在此输入...';
  $('wpm').textContent = '0';
  $('cpm').textContent = '0';
  $('accuracy').textContent = '100%';
  $('errors').textContent = '0';
  $('progressBar').style.width = '0%';
  $('progressText').textContent = '0%';
  if (state.mode === 'time') {
    $('timer').textContent = state.timeLimit;
    $('timerLabel').textContent = '倒计时';
  } else {
    $('timer').textContent = '0';
    $('timerLabel').textContent = '已用时间';
  }
  $('timerCard').classList.remove('warning');
  $('startBtn').textContent = '▶ 开始练习';
  $('startBtn').onclick = startPractice;
  renderTextDisplay();
  scrollToTop();
}

function finishPractice() {
  if (state.isFinished) return;
  state.isFinished = true;
  state.endTime = Date.now();
  stopTimer();
  const elapsed = state.elapsed || Math.floor((state.endTime - state.startTime) / 1000);
  const typed = $('typingInput').value;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < state.currentText.length && typed[i] === state.currentText[i]) {
      correct++;
    }
  }
  const wpm = elapsed > 0 ? Math.round((typed.length / elapsed) * 60) : 0;
  const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  const cpm = elapsed > 0 ? Math.round((typed.length / elapsed) * 60) : 0;
  const record = {
    id: Date.now(),
    time: new Date().toLocaleString('zh-CN'),
    mode: state.mode === 'time' ? '计时' : '字数',
    wpm,
    accuracy,
    cpm,
    errors: state.totalErrors,
    elapsed,
    docName: state.currentDocName
  };
  state.history.unshift(record);
  if (state.history.length > CONFIG.maxHistory) {
    state.history.pop();
  }
  saveHistory();
  renderHistory();
  $('finalWpm').textContent = wpm;
  $('finalAccuracy').textContent = `${accuracy}%`;
  $('finalCpm').textContent = cpm;
  $('finalErrors').textContent = state.totalErrors;
  $('finalTime').textContent = `${elapsed}s`;
  $('resultModal').classList.add('show');
  $('typingInput').disabled = true;
  $('startBtn').textContent = '▶ 开始练习';
  $('startBtn').onclick = startPractice;
}

function closeModal() {
  $('resultModal').classList.remove('show');
}

function closeModalAndReset() {
  closeModal();
  resetPractice();
}

function toggleHistory() {
  const panel = $('historyPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    renderHistory();
  }
}

function renderHistory() {
  const list = $('historyList');
  if (state.history.length === 0) {
    list.innerHTML = '<div class="doc-empty">暂无练习记录</div>';
    return;
  }
  list.innerHTML = state.history.map(h => {
    let badgeClass = 'badge-low';
    let badgeText = '加油';
    if (h.wpm >= 80) { badgeClass = 'badge-high'; badgeText = '优秀'; }
    else if (h.wpm >= 50) { badgeClass = 'badge-mid'; badgeText = '良好'; }
    return `
      <div class="history-item">
        <span class="history-time">${h.time}</span>
        <span class="history-mode">${h.mode}</span>
        <span class="history-wpm">${h.wpm} WPM</span>
        <span class="history-acc">${h.accuracy}%</span>
        <span class="history-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  }).join('');
}

function clearHistory() {
  if (!confirm('确定要清空所有历史记录吗？')) return;
  state.history = [];
  saveHistory();
  renderHistory();
}

function handleFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const name = file.name.replace(/\\.[^/.]+$/, '');
    addLocalDoc(name, text);
    loadText(text, name);
    resetPractice();
    input.value = '';
    showToast(`已导入: ${name} (${text.length}字)`);
  };
  reader.readAsText(file);
}

function loadText(text, name, docId = null) {
  state.currentText = text;
  state.currentDocName = name;
  state.currentDocId = docId;
  renderTextDisplay();
  updateDocInfo();
}

function addLocalDoc(name, text) {
  const doc = {
    id: 'local_' + Date.now(),
    name: name,
    text: text,
    length: text.length,
    created: new Date().toISOString()
  };
  const existingIndex = state.localDocs.findIndex(d => d.name === name);
  if (existingIndex >= 0) {
    state.localDocs[existingIndex] = doc;
  } else {
    state.localDocs.unshift(doc);
  }
  if (state.localDocs.length > CONFIG.maxLocalDocs) {
    state.localDocs.pop();
  }
  saveLocalDocs();
}

function deleteLocalDoc(id) {
  state.localDocs = state.localDocs.filter(d => d.id !== id);
  saveLocalDocs();
  renderDocList();
}

function loadLocalDoc(id) {
  const doc = state.localDocs.find(d => d.id === id);
  if (doc) {
    loadText(doc.text, doc.name, doc.id);
    resetPractice();
    closeDocModal();
    showToast(`已加载: ${doc.name}`);
  }
}

async function fetchCloudDocs() {
  if (!CONFIG.API_BASE) return;
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/docs`);
    if (!response.ok) throw new Error('获取云端文档失败');
    const data = await response.json();
    state.cloudDocs = data.docs || [];
    renderDocList();
  } catch (err) {
    console.warn('云端文档获取失败:', err.message);
    state.cloudDocs = [];
    renderDocList();
  }
}

async function uploadDocToCloud(name, text) {
  if (!CONFIG.API_BASE) {
    showToast('请先配置云端地址', 'error');
    return;
  }
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text })
    });
    if (!response.ok) throw new Error('上传失败');
    showToast('已上传到云端');
    await fetchCloudDocs();
  } catch (err) {
    console.error('上传失败:', err);
    showToast('上传失败: ' + err.message, 'error');
  }
}

async function deleteCloudDoc(id) {
  if (!CONFIG.API_BASE) return;
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/docs/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('删除失败');
    showToast('已删除云端文档');
    await fetchCloudDocs();
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败: ' + err.message, 'error');
  }
}

async function loadCloudDoc(id) {
  if (!CONFIG.API_BASE) return;
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/docs/${id}`);
    if (!response.ok) throw new Error('获取文档失败');
    const data = await response.json();
    loadText(data.text, data.name, id);
    resetPractice();
    closeDocModal();
    showToast(`已加载云端文档: ${data.name}`);
  } catch (err) {
    console.error('加载失败:', err);
    showToast('加载失败: ' + err.message, 'error');
  }
}

function openDocManager() {
  $('docModal').classList.add('show');
  renderDocList();
  fetchCloudDocs();
}

function closeDocModal() {
  $('docModal').classList.remove('show');
}

function switchDocTab(tab) {
  state.docTab = tab;
  const tabs = document.querySelectorAll('.doc-tabs .btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active',
      (tab === 'local' && btn.textContent.includes('本地')) ||
      (tab === 'cloud' && btn.textContent.includes('云端'))
    );
  });
  renderDocList();
}

function renderDocList() {
  const list = $('docList');
  const docs = state.docTab === 'local' ? state.localDocs : state.cloudDocs;
  if (docs.length === 0) {
    const emptyMsg = state.docTab === 'local'
      ? '暂无本地文档，点击"导入文本"添加'
      : '暂无云端文档，请先配置 Worker 地址';
    list.innerHTML = `<div class="doc-empty">${emptyMsg}</div>`;
    return;
  }
  list.innerHTML = docs.map(doc => {
    const isActive = state.currentDocId === doc.id;
    const date = new Date(doc.created || Date.now()).toLocaleDateString('zh-CN');
    return `
      <div class="doc-item ${isActive ? 'active' : ''}" onclick="selectDoc('${doc.id}')">
        <span class="doc-item-name">${doc.name}</span>
        <span class="doc-item-meta">${doc.length || doc.text?.length || 0}字 · ${date}</span>
        <div class="doc-item-actions" onclick="event.stopPropagation()">
          ${state.docTab === 'local' ?
            `<button class="btn btn-sm" onclick="uploadLocalDoc('${doc.id}')">☁️ 上传</button>` : ''}
          <button class="btn btn-sm" onclick="delete${state.docTab === 'local' ? 'Local' : 'Cloud'}Doc('${doc.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function selectDoc(id) {
  if (state.docTab === 'local') {
    loadLocalDoc(id);
  } else {
    loadCloudDoc(id);
  }
}

function uploadLocalDoc(id) {
  const doc = state.localDocs.find(d => d.id === id);
  if (doc) {
    uploadDocToCloud(doc.name, doc.text);
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.settings);
    if (saved) {
      const settings = JSON.parse(saved);
      state.mode = settings.mode || 'time';
      state.timeLimit = settings.timeLimit || 60;
      state.countLimit = settings.countLimit || 200;
      $('timeInput').value = state.timeLimit;
      $('countInput').value = state.countLimit;
      setMode(state.mode);
    }
  } catch (e) {
    console.warn('加载设置失败:', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.settings, JSON.stringify({
      mode: state.mode,
      timeLimit: state.timeLimit,
      countLimit: state.countLimit
    }));
  } catch (e) {
    console.warn('保存设置失败:', e);
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.history);
    if (saved) {
      state.history = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('加载历史失败:', e);
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(state.history));
  } catch (e) {
    console.warn('保存历史失败:', e);
  }
}

function loadLocalDocs() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.docs);
    if (saved) {
      state.localDocs = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('加载文档失败:', e);
    state.localDocs = [];
  }
}

function saveLocalDocs() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.docs, JSON.stringify(state.localDocs));
  } catch (e) {
    console.warn('保存文档失败:', e);
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleScroll() {
  const btn = $('backToTop');
  if (window.scrollY > 200) {
    btn.classList.add('show');
  } else {
    btn.classList.remove('show');
  }
}

function handleGlobalKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!state.isRunning) {
      startPractice();
    } else if (state.isPaused) {
      pausePractice();
    }
  }
  if (e.key === 'Escape') {
    closeModal();
    closeDocModal();
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? 'rgba(248, 113, 113, 0.9)' : 'rgba(56, 189, 248, 0.9)'};
    color: #0b1121;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    z-index: 300;
    backdrop-filter: blur(8px);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', init);
