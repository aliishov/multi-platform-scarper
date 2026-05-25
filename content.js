console.log("Scraper Content Script Loaded");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addLog(message, localState = null) {
  console.log(message);
  const time = new Date().toLocaleTimeString();
  const logMsg = `[${time}] ${message}`;
  
  if (localState) {
    if (!localState.logs) localState.logs = [];
    localState.logs.push(logMsg);
    if (localState.logs.length > 100) localState.logs.shift();
    await chrome.storage.local.set({ scrapeState: localState });
  } else {
    const res = await chrome.storage.local.get(['scrapeState']);
    if (res.scrapeState) {
      const state = res.scrapeState;
      if (!state.logs) state.logs = [];
      state.logs.push(logMsg);
      if (state.logs.length > 100) state.logs.shift();
      await chrome.storage.local.set({ scrapeState: state });
    }
  }
}

async function simulateTypingSimple(element, text) {
  element.focus();
  element.click();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const setter = nativeInputValueSetter || function(val) { this.value = val; };
  
  setter.call(element, '');
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(100);
  
  for (let i = 0; i < text.length; i++) {
    setter.call(element, element.value + text[i]);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(20);
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function simulateTyping(element, text, platform) {
  await addLog(`Фокус на строке поиска. Очистка старого текста...`);
  element.focus();
  element.click();
  
  // React input clearing hack
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const setter = nativeInputValueSetter || function(val) { this.value = val; };
  
  setter.call(element, '');
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  
  await addLog(`Начинаю медленный ввод...`);
  for (let i = 0; i < text.length; i++) {
    setter.call(element, element.value + text[i]);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(Math.floor(Math.random() * 200) + 100);
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  await addLog(`Ввод завершен. Эмулирую нажатие поиска...`);
  await sleep(800);
  
  const currentUrl = window.location.href;
  
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  
  const form = element.closest('form');
  if (form) {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  
  // Попытка найти кнопку поиска (лупу) и нажать её
  const searchBtn = document.querySelector('button[aria-label="Search"], button[aria-label="Поиск"], [role="button"][aria-label="Search"], [role="button"][aria-label="Поиск"]');
  if (searchBtn) {
    searchBtn.click();
  }
  
  await sleep(2000);
  
  if (window.location.href === currentUrl || (platform === 'facebook' && !window.location.href.includes('/search/'))) {
    await addLog(`Нажатие Enter не сработало, использую прямую ссылку...`);
    let searchUrl = '';
    if (platform === 'facebook') {
      searchUrl = `https://www.facebook.com/search/top/?q=${encodeURIComponent(text)}&filters=eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9In0%3D`;
    } else {
      searchUrl = `https://x.com/search?q=${encodeURIComponent(text)}&src=typed_query&f=live`;
    }
    window.location.assign(searchUrl);
  } else {
    runStateMachine();
  }
}

async function runStateMachine() {
  const res = await chrome.storage.local.get(['scrapeState']);
  const state = res.scrapeState;
  
  if (!state || !state.active) return;

  if (state.step === 'INITIAL_CHECK') {
    if (state.platform === 'twitter') {
      const isLoggedOut = document.querySelector('a[href="/login"]') || document.querySelector('a[href="/i/flow/login"]') || window.location.href.includes('login') || window.location.href.includes('onboarding');
      if (isLoggedOut) {
         let isNavigating = false;
         if (!window.location.href.includes('/login') && !window.location.href.includes('login_enter_password') && !window.location.href.includes('onboarding')) {
             window.location.assign('https://x.com/login');
             isNavigating = true;
             return;
         }
        await addLog(`Twitter: не залогинен. Начинаю процесс входа...`);
        if (!window.location.href.includes('/i/flow/login')) {
          // removed
        }
        
        await sleep(3000);
        let passwordInput = document.querySelector('input[type="password"]:not([aria-hidden="true"]):not([tabindex="-1"])') || document.querySelector('input[name="password"]:not([aria-hidden="true"])');
        let usernameInput = document.querySelector('input[name="username_or_email"]') || document.querySelector('input[autocomplete*="username"]') || document.querySelector('input[name="text"]') || document.querySelector('input:not([type="hidden"])');
        
        if (!passwordInput && usernameInput) {
           await simulateTypingSimple(usernameInput, "AlexeyMoro51303");
           
           usernameInput.blur();
           await sleep(500);

           // Look for Continue, Next, etc.
           const nextBtn = Array.from(document.querySelectorAll('div[data-testid*="next"], button')).find(b => {
               const t = b.innerText?.trim().toLowerCase();
               return t === 'next' || t === 'далее' || t === 'continue' || t === 'дальше';
           });
           
           const textNode = Array.from(document.querySelectorAll('span, p')).find(b => {
             const text = b.innerText?.trim().toLowerCase();
             return (text === 'next' || text === 'далее' || text === 'continue' || text === 'дальше') && b.children.length === 0;
           });

           if (nextBtn) {
             nextBtn.click();
           } else if (textNode) {
             textNode.click();
             if (textNode.parentElement) textNode.parentElement.click();
             if (textNode.parentElement?.parentElement) textNode.parentElement.parentElement.click();
           }
           
           // Also try pressing enter on the input just in case
           usernameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
           usernameInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
           
           // Emulate form submit if applicable
           const form = usernameInput.closest('form');
           if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

           await sleep(3000);
        }
        
        passwordInput = document.querySelector('input[type="password"]:not([aria-hidden="true"]):not([tabindex="-1"])') || document.querySelector('input[name="password"]:not([aria-hidden="true"])');
        if (passwordInput) {
           await simulateTypingSimple(passwordInput, "!pLYpMKQb3iz+ys");
           
           passwordInput.blur();
           await sleep(500);

           const loginBtn = document.querySelector('[data-testid="LoginForm_Login_Button"]') || Array.from(document.querySelectorAll('div[data-testid*="Login"], button')).find(b => {
               const t = b.innerText?.trim().toLowerCase();
               return t === 'log in' || t === 'войти' || t === 'вход' || t === 'login' || t === 'continue';
           });
           
           const loginText = Array.from(document.querySelectorAll('span, p')).find(b => {
             const text = b.innerText?.trim().toLowerCase();
             return (text === 'log in' || text === 'войти' || text === 'вход' || text === 'login' || text === 'continue') && b.children.length === 0;
           });

           if (loginBtn) {
             loginBtn.click();
           } else if (loginText) {
             loginText.click();
             if (loginText.parentElement) loginText.parentElement.click();
             if (loginText.parentElement?.parentElement) loginText.parentElement.parentElement.click();
           }
           
           passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
           passwordInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

           const pForm = passwordInput.closest('form');
           if (pForm) pForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

           await sleep(5000); // Wait for login to finish
        }
        
        // Check if login was successful, redirect to explore
        if (document.querySelector('[data-testid="AppTabBar_Explore_Link"]')) {
           window.location.assign('https://x.com/explore');
           return;
        }
        
        await addLog('Ожидание логина (X)...');
        setTimeout(runStateMachine, 3000);
        return;

      } else {
         await addLog(`Twitter: залогинен. Переход к поиску...`);
         state.step = 'SEARCHING';
         await chrome.storage.local.set({ scrapeState: state });
         if (!window.location.href.includes('/explore') && !window.location.href.includes('/search')) {
            window.location.assign('https://x.com/explore');
            return;
         }
         runStateMachine();
         return;
      }
    } else if (state.platform === 'facebook') {
      const emailInputExists = document.getElementById('email');
      const passInputExists = document.getElementById('pass');
      
      const useAnotherProfileBtn = Array.from(document.querySelectorAll('div[role="button"], span, a, button')).find(el => el.innerText && (
        el.innerText.toLowerCase() === 'use another profile' || 
        el.innerText.toLowerCase() === 'log into another account' || 
        el.innerText.toLowerCase() === 'use another account' ||
        el.innerText.toLowerCase().includes('другой аккаунт') ||
        el.innerText.toLowerCase().includes('другой профиль') ||
        el.innerText.toLowerCase().includes('another profile')
      ));

      const isLoggedOut = emailInputExists || passInputExists || useAnotherProfileBtn || window.location.href.includes('/login');

      if (isLoggedOut) {
         if (useAnotherProfileBtn) {
             await addLog(`Facebook: Нажимаю кнопку для выбора другого профиля...`);
             useAnotherProfileBtn.click();
             await sleep(2000);
         }
         await addLog(`Facebook: не залогинен. Ввожу данные...`);
         const emailInput = document.getElementById('email') || document.querySelector('input[name="email"]') || document.querySelector('input[type="text"]') || document.getElementById('_r_6_');
         const passInput = document.getElementById('pass') || document.querySelector('input[name="pass"]') || document.querySelector('input[type="password"]') || document.getElementById('_r_9_');
         const loginBtn = document.querySelector('button[name="login"]') || document.querySelector('button[type="submit"]') || document.querySelector('div[aria-label="Log In"][role="button"]');
         
         if (emailInput && passInput) {
           await simulateTypingSimple(emailInput, "raulalishov849@gmail.com");
           await simulateTypingSimple(passInput, "Ds7B*R@qjgMdudw");
           if (loginBtn) {
               loginBtn.click();
           } else {
               const loginForm = document.getElementById('login_form');
               if (loginForm) loginForm.submit();
           }
           await sleep(5000); // Wait for login
           window.location.assign('https://www.facebook.com/');
           return;
         }
      } else {
         await addLog(`Facebook: залогинен. Переход к поиску...`);
         state.step = 'SEARCHING';
         await chrome.storage.local.set({ scrapeState: state });
         runStateMachine();
         return;
      }
    }
  } else if (state.step === 'SEARCHING') {

    await addLog(`Ищу строку поиска на текущей странице...`);
    let searchInput = null;
    for(let i=0; i<10; i++) {
      if (state.platform === 'facebook') {
        searchInput = document.querySelector('input[type="search"], [role="search"] input, input[placeholder*="Search" i], input[placeholder*="Поиск" i]');
      } else {
        searchInput = document.querySelector('[data-testid="SearchBox_Search_Input"]') || document.querySelector('input[aria-label*="Search" i]') || document.querySelector('input[placeholder*="Search" i]') || document.querySelector('input[aria-label*="Поиск" i]') || document.querySelector('input[placeholder*="Поиск" i]') || document.querySelector('[role="search"] input');
      }
      if (searchInput) break;
      await sleep(1000);
    }
    
    if (searchInput) {
      state.step = 'SCRAPING';
      await chrome.storage.local.set({ scrapeState: state });
      await simulateTyping(searchInput, state.currentKeyword, state.platform);
    } else {
      await addLog(`Строка поиска не найдена. Повторная попытка через 5 сек...`);
      setTimeout(runStateMachine, 5000);
    }
  } 
  else if (state.step === 'SCRAPING') {
    if (!window.location.href.includes('/search')) {
      await addLog(`Ожидание загрузки страницы результатов поиска...`);
      setTimeout(runStateMachine, 2000);
      return;
    }
    
    if (state.platform === 'twitter') {
      if (!window.location.href.includes('f=live')) {
        await addLog(`Ищу вкладку "Последние" (Latest)...`);
        const latestTab = document.querySelector('a[href*="f=live"][role="tab"]');
        if (latestTab) {
          await addLog(`Кликаю на вкладку "Последние"...`);
          latestTab.click();
          await sleep(2000);
        } else {
          await addLog(`Вкладка не найдена, применяю фильтр через ссылку...`);
          const url = new URL(window.location.href);
          url.searchParams.set('f', 'live');
          window.location.href = url.toString();
          return;
        }
      }
      await addLog(`Ожидание появления твитов...`);
      for(let i=0; i<15; i++) {
        if (document.querySelectorAll('article[data-testid="tweet"]').length > 0) break;
        await sleep(1000);
      }
      await addLog(`Начинаю сбор постов по слову "${state.currentKeyword}"...`);
      await scrapeTwitterLoop(state);
    } else if (state.platform === 'facebook') {
      let filterApplied = false;
      
      await addLog(`Ищу кнопку фильтров "Все" / "All"...`);
      const allSpans = Array.from(document.querySelectorAll('span'));
      let filterBtn = null;
      
      for (const span of allSpans) {
        const text = span.innerText?.trim().toLowerCase();
        if (text === 'все' || text === 'all' || text === 'фильтры' || text === 'filters') {
          // Ищем родительский элемент, который можно нажать (a, button, listitem)
          filterBtn = span.closest('a, [role="button"], [role="link"], [role="listitem"]') || span;
          break;
        }
      }
      
      if (filterBtn) {
        await addLog(`Открываю меню фильтров...`);
        // Имитируем полноценный клик
        filterBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        filterBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        filterBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        filterBtn.click();
        await sleep(2500);
        
        await addLog(`Ищу переключатель "Недавние публикации" / "Recent posts"...`);
        
        // Сначала пытаемся найти по aria-label (самый надежный способ по вашему HTML)
        let recentToggle = document.querySelector('input[role="switch"][aria-label*="Недавние" i], input[role="switch"][aria-label*="Recent" i], input[type="checkbox"][aria-label*="Недавние" i], input[type="checkbox"][aria-label*="Recent" i]');
        
        // Если не нашли, ищем по тексту
        if (!recentToggle) {
          const popupSpans = Array.from(document.querySelectorAll('span'));
          for (const span of popupSpans) {
            const text = span.innerText?.trim().toLowerCase();
            if (text === 'недавние публикации' || text === 'recent posts') {
              const listItem = span.closest('[role="listitem"]');
              if (listItem) {
                recentToggle = listItem.querySelector('input[role="switch"], input[type="checkbox"]');
              }
              if (!recentToggle) {
                 // Если инпут не найден, попробуем кликнуть сам текст
                 recentToggle = span;
              }
              break;
            }
          }
        }
        
        if (recentToggle) {
          const isChecked = recentToggle.getAttribute('aria-checked') === 'true' || recentToggle.checked;
          if (!isChecked) {
            await addLog(`Включаю "Недавние публикации"...`);
            recentToggle.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            recentToggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            recentToggle.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            recentToggle.click();
            await sleep(4000); // Wait for new request
            filterApplied = true;
          } else {
            await addLog(`Фильтр "Недавние публикации" уже включен.`);
            filterApplied = true;
          }
        } else {
          await addLog(`Не нашел переключатель "Недавние публикации".`);
        }
      } else {
        await addLog(`Не нашел кнопку "Все".`);
      }
      
      // Fallback to URL modification if UI click failed
      if (!filterApplied && !window.location.href.includes('filters=')) {
        await addLog(`Применяю фильтр "Последние" (Recent) через ссылку...`);
        const url = new URL(window.location.href);
        // Убеждаемся что мы на /search/top/
        if (url.pathname.includes('/search/posts')) {
          url.pathname = url.pathname.replace('/search/posts', '/search/top');
        } else if (!url.pathname.includes('/search/top')) {
          url.pathname = '/search/top/';
        }
        url.searchParams.set('filters', 'eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9In0=');
        window.location.assign(url.toString());
        return;
      }
      
      await addLog(`Ожидание появления постов Facebook...`);
      for(let i=0; i<15; i++) {
        if (document.querySelectorAll('[role="article"], [data-pagelet*="FeedUnit"], div[data-ad-comet-preview="message"], div[data-ad-preview="message"]').length > 0) break;
        await sleep(1000);
      }
      await addLog(`Начинаю сбор постов по слову "${state.currentKeyword}"...`);
      await scrapeFacebookLoop(state);
    }
  }
}

// --- TWITTER SCRAPER ---
async function scrapeTwitterLoop(state) {
  let noNewPostsCount = 0;
  let lastPostCount = state.currentPosts.length;
  const seenUrls = new Set(state.currentPosts.map(p => p.url));
  
  while (state.currentPosts.length < state.targetCount && state.active) {
    const currentRes = await chrome.storage.local.get(['scrapeState']);
    if (!currentRes.scrapeState || !currentRes.scrapeState.active) {
      await addLog(`Скрапинг прерван.`);
      return;
    }
    state = currentRes.scrapeState;

    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let foundOldPost = false;
    let newPostsInThisScroll = 0;
    
    for (const article of articles) {
      if (state.currentPosts.length >= state.targetCount) break;
      
      try {
        const timeEl = article.querySelector('time');
        if (!timeEl) continue;
        
        const links = Array.from(article.querySelectorAll('a[role="link"]'));
        const timeLink = links.find(a => a.contains(timeEl));
        const postUrl = timeLink ? timeLink.href : null;
        
        if (!postUrl || seenUrls.has(postUrl)) continue;
        
        article.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const userEl = article.querySelector('[data-testid="User-Name"]');
        let authorName = "Unknown";
        let authorUrl = "Unknown";
        if (userEl) {
          const authorLinks = Array.from(userEl.querySelectorAll('a[role="link"]'));
          if (authorLinks.length > 0) {
            authorName = authorLinks[0].textContent;
            authorUrl = authorLinks[0].href;
          }
        }
        
        await addLog(`Читаю пост от ${authorName}...`);
        await sleep(Math.floor(Math.random() * 2000) + 1500);
        
        const dateStr = timeEl.getAttribute('datetime');
        const postDate = new Date(dateStr);
        const now = new Date();
        const diffHours = (now - postDate) / (1000 * 60 * 60);
        
        if (diffHours > 48) {
          foundOldPost = true;
          await addLog(`Найден пост старше 48 часов (${Math.round(diffHours)} ч.). Остановка сбора для этого слова.`);
          break;
        }
        
        const showMoreBtn = article.querySelector('[data-testid="tweet-text-show-more-link"]');
        if (showMoreBtn) {
          await addLog(`Раскрываю длинный текст...`);
          showMoreBtn.click();
          await sleep(Math.floor(Math.random() * 1000) + 800);
        }
        
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : "";
        
        const mediaUrls = [];
        const photos = article.querySelectorAll('[data-testid="tweetPhoto"] img');
        photos.forEach(img => mediaUrls.push(img.src));
        const videos = article.querySelectorAll('video');
        videos.forEach(vid => mediaUrls.push(vid.src));
        
        seenUrls.add(postUrl);
        
        const pad = (n) => n.toString().padStart(2, '0');
        const tzo = -postDate.getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const offset = dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
        const javaOffsetDateTime = `${postDate.getFullYear()}-${pad(postDate.getMonth() + 1)}-${pad(postDate.getDate())}T${pad(postDate.getHours())}:${pad(postDate.getMinutes())}:${pad(postDate.getSeconds())}${offset}`;
        
        const postData = {
          author: authorName,
          authorUrl: authorUrl,
          date: postDate.toLocaleString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          url: postUrl,
          text: text,
          media: mediaUrls
        };
        state.currentPosts.push(postData);
        
        chrome.runtime.sendMessage({
          action: 'sendPostToServer',
          data: {
            source: 'twitter',
            author: postData.author,
            authorUrl: postData.authorUrl,
            date: javaOffsetDateTime,
            postUrl: postData.url,
            postMedia: postData.media,
            postText: postData.text
          }
        }).then(async (response) => {
          if (response.success) {
            await addLog(`✅ Пост от ${authorName} успешно отправлен на сервер.`);
          } else if (response.status) {
            await addLog(`⚠️ Ошибка сервера при отправке поста: ${response.status}`);
          } else {
            await addLog(`❌ Ошибка сети при отправке поста: ${response.error}`);
          }
        }).catch(async (err) => {
          await addLog(`❌ Ошибка связи с расширением: ${err.message}`);
        });
        
        newPostsInThisScroll++;
        await chrome.storage.local.set({ scrapeState: state });
        
      } catch (e) {
        console.error("Error parsing tweet", e);
      }
    }
    
    if (newPostsInThisScroll > 0) {
      await addLog(`Собрано постов: ${state.currentPosts.length} из ${state.targetCount}`);
    }
    
    if (state.currentPosts.length >= state.targetCount || foundOldPost) {
      break;
    }
    
    await addLog(`Скроллинг вниз для загрузки новых постов...`);
    window.scrollBy({ top: Math.floor(Math.random() * 800) + 600, behavior: 'smooth' });
    await sleep(Math.floor(Math.random() * 1500) + 2000);
    
    if (state.currentPosts.length === lastPostCount) {
      noNewPostsCount++;
      if (noNewPostsCount > 4) {
        await addLog(`Новые посты не подгружаются. Переход к следующему шагу.`);
        break;
      }
    } else {
      noNewPostsCount = 0;
      lastPostCount = state.currentPosts.length;
    }
  }
  
  await finishKeyword(state);
}

// --- FACEBOOK SCRAPER ---
function parseFacebookDate(dateStr) {
  if (!dateStr) return new Date();
  const str = dateStr.toLowerCase().trim();
  let d = new Date();

  if (/just\s*now|только\s*что|today|сегодня/i.test(str)) {
    return d;
  }
  if (/yesterday|вчера/i.test(str)) {
    d.setDate(d.getDate() - 1);
    return d;
  }

  const relMatch = str.match(/(\d+)\s*(m|h|d|w|y|мин|ч|д|нед|г|л|sec|min|hour|day|week|month|year|мес|cек)/i);
  if (relMatch) {
    const val = parseInt(relMatch[1], 10);
    const unit = relMatch[2];

    if (unit.startsWith('s') || unit.startsWith('с')) d.setSeconds(d.getSeconds() - val);
    else if (unit.startsWith('m') || unit.startsWith('мин') || unit.startsWith('мес')) {
      if (unit.startsWith('mo') || unit.startsWith('мес')) d.setMonth(d.getMonth() - val);
      else d.setMinutes(d.getMinutes() - val);
    } else if (unit.startsWith('h') || unit.startsWith('ч')) d.setHours(d.getHours() - val);
    else if (unit.startsWith('d') || unit.startsWith('д')) d.setDate(d.getDate() - val);
    else if (unit.startsWith('w') || unit.startsWith('н')) d.setDate(d.getDate() - val * 7);
    else if (unit.startsWith('y') || unit.startsWith('г') || unit.startsWith('л')) d.setFullYear(d.getFullYear() - val);
    return d;
  }

  const monthsRU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const monthsEN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  let monthIndex = -1;
  monthsRU.forEach((m, i) => { if (str.includes(m)) monthIndex = i; });
  if (monthIndex === -1) monthsEN.forEach((m, i) => { if (str.includes(m)) monthIndex = i; });

  if (monthIndex !== -1) {
    const dayMatch = str.match(/\b(\d{1,2})\b/);
    if (dayMatch) {
      d.setMonth(monthIndex);
      d.setDate(parseInt(dayMatch[1], 10));
      const yearMatch = str.match(/\b(20\d{2})\b/);
      if (yearMatch) d.setFullYear(parseInt(yearMatch[1], 10));
      else if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
      return d;
    }
  }
  return d;
}

async function scrapeFacebookLoop(state) {
  let noNewPostsCount = 0;
  let lastPostCount = state.currentPosts.length;
  const seenSignatures = new Set(state.currentPosts.map(p => p.url));
  
  while (state.currentPosts.length < state.targetCount && state.active) {
    const currentRes = await chrome.storage.local.get(['scrapeState']);
    if (!currentRes.scrapeState || !currentRes.scrapeState.active) {
      await addLog(`Скрапинг прерван.`);
      return;
    }
    state = currentRes.scrapeState;

    let articles = Array.from(document.querySelectorAll('[role="article"], [data-pagelet*="FeedUnit"], div.x1yztbdb, div.x1lliihq > div.x1n2onr6 > div[style*="border-radius"]'));
    if (articles.length < 2) {
      const timeLinks = Array.from(document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="], a[href*="/photos/"], a[href*="/videos/"], h2 a[href], h3 a[href], h4 a[href], strong a[href]'));
      const uniqueParents = new Set(articles);
      for (const link of timeLinks) {
         let p = link.parentElement;
         let found = null;
         for(let i=0; i<15; i++) {
           if (!p) break;
           const rect = p.getBoundingClientRect();
           // Looking for an element that spans the post content
           if (rect.height > 100 && rect.height < 3000 && p.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"], div[dir="auto"]')) {
              found = p;
           }
           if (rect.height > 3500) break; // Don't go too high (like main window)
           p = p.parentElement;
         }
         if (found) {
            uniqueParents.add(found);
         }
      }
      articles = Array.from(uniqueParents);
    }
    
    let foundOldPost = false;
    let newPostsInThisScroll = 0;
    
    for (const article of articles) {
      if (state.currentPosts.length >= state.targetCount) break;
      
      try {
        // Find URL to use as signature
        let postUrl = null;
        const anchors = Array.from(article.querySelectorAll('a[href]'));
        for (const a of anchors) {
          const h = a.href || '';
          if (h.includes('/posts/') || h.includes('/permalink/') || h.includes('story_fbid=') || h.includes('/photos/') || h.includes('/videos/') || h.includes('/watch/') || h.includes('/groups/')) {
            postUrl = h;
            break;
          }
        }
        
        if (!postUrl) {
          const timeAnchor = Array.from(article.querySelectorAll('a')).find(a => {
            const lbl = String(a.getAttribute('aria-label') || '').toLowerCase();
            const rel = String(a.getAttribute('rel') || '').toLowerCase();
            return (lbl && lbl.length > 2 && /\d/.test(lbl)) || (a.innerText && /\d/.test(a.innerText) && (a.innerText.includes('ч')||a.innerText.includes('м')) && !a.href.includes('profile')) || rel.includes('noopener');
          });
          if (timeAnchor && timeAnchor.href && timeAnchor.href.includes('facebook.com')) {
             postUrl = timeAnchor.href;
          }
        }
        
        const textNodes = Array.from(article.querySelectorAll('[data-testid="post_message"], [data-ad-comet-preview="message"], div[dir="auto"]'));
        const textContent = textNodes.map(n => n.innerText?.trim()).filter(Boolean).join('\n') || article.innerText?.trim() || "";
        
        const signature = postUrl || textContent.substring(0, 100);
        if (!signature || seenSignatures.has(signature)) continue;
        
        article.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Author
        let authorName = "Unknown";
        let authorUrl = "Unknown";
        for (const sel of ['h2 a[href]', 'h3 a[href]', 'h4 a[href]', 'strong a[href]', 'a[role="link"][href]']) {
          const el = article.querySelector(sel);
          if (el && el.innerText?.trim().length > 0) {
            authorName = el.innerText.trim();
            authorUrl = el.href;
            break;
          }
        }
        
        await addLog(`Читаю пост от ${authorName}...`);
        await sleep(Math.floor(Math.random() * 2000) + 1500);
        
        // Date
        let rawDate = '';
        
        if (postUrl) {
          const timeAnchor = Array.from(article.querySelectorAll('a')).find(a => a.href === postUrl);
          if (timeAnchor && timeAnchor.innerText && timeAnchor.innerText.trim().length > 0) {
            rawDate = timeAnchor.innerText.trim();
          }
        }
        
        if (!rawDate || rawDate.length < 2) {
          for (const a of article.querySelectorAll('a[aria-label], [title], abbr[data-utime], a[role="link"]')) {
            const label = a.getAttribute('aria-label')?.trim() || a.getAttribute('title')?.trim() || '';
            if (label && label.length > 2 && /\d/.test(label)) {
              rawDate = label;
              break;
            }
            const txt = a.innerText?.trim() || '';
            if (txt && !txt.includes('\n') && /\d/.test(txt) && (txt.includes('ч') || txt.includes('м') || txt.includes('д') || txt.includes('h') || txt.includes('m') || txt.includes('w') || txt.includes('y'))) {
              rawDate = txt;
              break;
            }
          }
        }
        
        if (!rawDate) {
          const timeEl = article.querySelector('time');
          if (timeEl) rawDate = timeEl.getAttribute('datetime') || timeEl.innerText?.trim() || '';
        }
        
        const postDate = parseFacebookDate(rawDate);
        const now = new Date();
        const diffHours = (now - postDate) / (1000 * 60 * 60);
        
        if (diffHours > 48) {
          foundOldPost = true;
          await addLog(`Найден пост старше 48 часов (${Math.round(diffHours)} ч.). Остановка сбора для этого слова.`);
          break;
        }
        
        // See more
        const seeMoreCandidates = Array.from(article.querySelectorAll('div[role="button"], span, a')).filter(el => {
          const txt = el.innerText?.trim().toLowerCase() || '';
          return txt === 'see more' || txt === 'ещё' || txt === 'показать еще' || txt === 'read more';
        });
        if (seeMoreCandidates.length > 0) {
          await addLog(`Раскрываю длинный текст...`);
          seeMoreCandidates[0].click();
          await sleep(Math.floor(Math.random() * 1000) + 800);
        }
        
        // Text
        let text = "";
        const textSelectors = ['[data-testid="post_message"]', '[data-ad-comet-preview="message"]', 'div[dir="auto"]'];
        for (const sel of textSelectors) {
          const nodes = Array.from(article.querySelectorAll(sel));
          if (nodes.length > 0) {
            text = nodes.map(n => n.innerText?.trim()).filter(Boolean).join('\n');
            if (text) break;
          }
        }
        
        if (!text) {
           text = article.innerText?.trim() || "";
        }
        
        // Media
        const mediaUrls = [];
        const fbDomains = ['facebook.com', 'fb.com', 'fb.me', 'l.facebook.com', 'instagram.com'];
        Array.from(article.querySelectorAll('a[href]')).forEach(a => {
          try {
            const url = new URL(a.href);
            if (url.protocol.startsWith('http') && !fbDomains.some(d => url.hostname.includes(d))) {
              mediaUrls.push(url.href);
            }
          } catch(e) {}
        });
        Array.from(article.querySelectorAll('img')).forEach(img => {
          if (img.src && img.src.includes('scontent')) mediaUrls.push(img.src);
        });
        
        seenSignatures.add(signature);
        
        const pad = (n) => n.toString().padStart(2, '0');
        const tzo = -postDate.getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const offset = dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
        const javaOffsetDateTime = `${postDate.getFullYear()}-${pad(postDate.getMonth() + 1)}-${pad(postDate.getDate())}T${pad(postDate.getHours())}:${pad(postDate.getMinutes())}:${pad(postDate.getSeconds())}${offset}`;
        
        const postData = {
          author: authorName,
          authorUrl: authorUrl,
          date: postDate.toLocaleString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          url: postUrl || window.location.href,
          text: text,
          media: Array.from(new Set(mediaUrls))
        };
        state.currentPosts.push(postData);
        
        chrome.runtime.sendMessage({
          action: 'sendPostToServer',
          data: {
            source: 'facebook',
            author: postData.author,
            authorUrl: postData.authorUrl,
            date: javaOffsetDateTime,
            postUrl: postData.url,
            postMedia: postData.media,
            postText: postData.text
          }
        }).then(async (response) => {
          if (response.success) {
            await addLog(`✅ Пост от ${authorName} успешно отправлен на сервер.`);
          } else if (response.status) {
            await addLog(`⚠️ Ошибка сервера при отправке поста: ${response.status}`);
          } else {
            await addLog(`❌ Ошибка сети при отправке поста: ${response.error}`);
          }
        }).catch(async (err) => {
          await addLog(`❌ Ошибка связи с расширением: ${err.message}`);
        });
        
        newPostsInThisScroll++;
        await chrome.storage.local.set({ scrapeState: state });
        
      } catch (e) {
        console.error("Error parsing facebook post", e);
      }
    }
    
    if (newPostsInThisScroll > 0) {
      await addLog(`Собрано постов: ${state.currentPosts.length} из ${state.targetCount}`);
    }
    
    if (state.currentPosts.length >= state.targetCount || foundOldPost) {
      break;
    }
    
    await addLog(`Скроллинг вниз для загрузки новых постов...`);
    window.scrollBy({ top: Math.floor(Math.random() * 800) + 600, behavior: 'smooth' });
    await sleep(Math.floor(Math.random() * 1500) + 2000);
    
    if (state.currentPosts.length === lastPostCount) {
      noNewPostsCount++;
      if (noNewPostsCount > 4) {
        await addLog(`Новые посты не подгружаются. Переход к следующему шагу.`);
        break;
      }
    } else {
      noNewPostsCount = 0;
      lastPostCount = state.currentPosts.length;
    }
  }
  
  await finishKeyword(state);
}

async function finishKeyword(state) {
  state.allResults.push({
    keyword: state.currentKeyword,
    posts: state.currentPosts,
    timestamp: new Date().toISOString()
  });
  
  if (state.queue.length > 0) {
    state.currentKeyword = state.queue.shift();
    state.currentPosts = [];
    state.step = 'INITIAL_CHECK';
    await addLog(`Переход к следующему слову: ${state.currentKeyword}`);
    await chrome.storage.local.set({ scrapeState: state });
    
    runStateMachine();
  } else {
    state.active = false;
    await addLog(`Сбор полностью завершен! Сохраняю файл...`);
    await chrome.storage.local.set({ scrapeState: state });
    downloadResults(state.allResults);
  }
}

function downloadResults(allResults) {
  let output = `╔══════════════════════════════════════════════════════════════╗\n`;
  output += `║ SEARCH SIMULATOR — MULTI KEYWORD RESULT                      ║\n`;
  output += `║ Generated : ${new Date().toISOString()}                     ║\n`;
  output += `╚══════════════════════════════════════════════════════════════╝\n`;
  
  for (const result of allResults) {
    output += `════════════════════════════════════════════════════════════════\n`;
    output += `KEYWORD : ${result.keyword}\n`;
    output += `Scraped : ${result.timestamp} Posts: ${result.posts.length}\n`;
    output += `════════════════════════════════════════════════════════════════\n`;
    
    result.posts.forEach((post, index) => {
      output += `▶ POST ${index + 1}\n`;
      output += `Author : ${post.author}\n`;
      output += `Author URL : ${post.authorUrl}\n`;
      output += `Date : ${post.date}\n`;
      output += `Post URL : ${post.url}\n`;
      output += `Post Media : ${JSON.stringify(post.media)}\n`;
      output += `Text :\n${post.text}\n`;
      output += `────────────────────────────────────────────────────────────\n`;
    });
  }
  
  const blob = new Blob([output], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scrape_result_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(runStateMachine, 2000));
} else {
  setTimeout(runStateMachine, 2000);
}
