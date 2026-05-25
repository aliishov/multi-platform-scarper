
function updateUI(state) {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const statusEl = document.getElementById('status');
  const logsEl = document.getElementById('logs');
  
  if (state && state.active) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusEl.innerText = `В процессе: ${state.currentKeyword} (${state.currentPosts?.length || 0}/${state.targetCount})`;
  } else {
    startBtn.style.display = 'block';
    startBtn.innerText = state && state.allResults?.length > 0 ? 'Начать заново' : 'Начать сбор';
    stopBtn.style.display = 'none';
    statusEl.innerText = 'Остановлено / Ожидание';
  }
  
  if (state && state.logs) {
    logsEl.innerHTML = state.logs.map(log => {
      const parts = log.split('] ');
      if (parts.length > 1) {
        return `<div class="log-entry"><span class="log-time">${parts[0]}]</span> ${parts.slice(1).join('] ')}</div>`;
      }
      return `<div class="log-entry">${log}</div>`;
    }).join('');
    logsEl.scrollTop = logsEl.scrollHeight;
  }
}

document.getElementById('start').addEventListener('click', () => {
  const keywordsRaw = document.getElementById('keywords').value;
  const count = parseInt(document.getElementById('count').value, 10);
  const platform = document.getElementById('platform').value;
  
  const keywords = keywordsRaw.split('\n').map(k => k.trim()).filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    alert('Пожалуйста, введите хотя бы одно ключевое слово.');
    return;
  }
  
  const initialState = {
    active: true,
    platform: platform,
    queue: keywords.slice(1),
    currentKeyword: keywords[0],
    targetCount: count,
    currentPosts: [],
    allResults: [],
    step: 'INITIAL_CHECK',
    logs: [`[${new Date().toLocaleTimeString()}] Запуск скрапера (${platform}). Первое слово: ${keywords[0]}`]
  };
  
  chrome.storage.local.set({ scrapeState: initialState }, () => {
    // Navigate to explore to ensure a clean search state
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      const targetUrl = platform === 'facebook' ? 'https://www.facebook.com/' : 'https://x.com/explore';
      
      if (currentTab && currentTab.url && currentTab.url.includes(platform === 'facebook' ? 'facebook.com' : 'x.com')) {
        chrome.tabs.update(currentTab.id, { url: targetUrl });
      } else if (currentTab) {
        chrome.tabs.update(currentTab.id, { url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  });
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.storage.local.get(['scrapeState'], (res) => {
    if (res.scrapeState) {
      const state = res.scrapeState;
      state.active = false;
      state.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Остановлено пользователем.`);
      chrome.storage.local.set({ scrapeState: state });
    }
  });
});

// Initial load
chrome.storage.local.get(['scrapeState'], (res) => {
  updateUI(res.scrapeState);
});

// Listen for updates from content script
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.scrapeState) {
    updateUI(changes.scrapeState.newValue);
  }
});
