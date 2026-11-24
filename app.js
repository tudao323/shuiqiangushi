/* ============================================================
 * 夜读 v2 · 音频播放引擎
 * - 播放预生成的「晓晓」神经网络女声朗读音频
 * - 睡眠合集：多篇故事串成 15/30/60 分钟连续播放
 * - 睡眠定时 / 每晚定时任务
 * - 每日精选 / 随机 / 收藏（持久化）
 * ============================================================ */

(function () {
  'use strict';

  const STORIES = window.STORIES || [];
  const BOOKS_RAW = window.BOOKS || [];
  const $ = (id) => document.getElementById(id);

  // 把「公共领域有声书」规范化为与故事一致的结构，复用同一套播放器
  const BOOK_COVERS = ['book', 'moon', 'window', 'lamp', 'star', 'book', 'snow', 'moon'];
  const BOOKS = BOOKS_RAW.map((b, i) => ({
    id: b.id, title: b.title, style: b.category, minutes: b.minutes,
    quote: b.intro, summary: b.author + ' · ' + (b.source || '公共领域经典'),
    cover: BOOK_COVERS[i % BOOK_COVERS.length], paragraphs: b.paragraphs,
    isBook: true, duration: b.duration, audio: b.audio, source: b.source, author: b.author
  }));

  // 统一内容池：故事 + 有声书（收藏/阅读器/列表共用）
  const ALL = STORIES.concat(BOOKS);
  const findItem = (id) => ALL.find(x => x.id === id);

  // 音频时长（秒，实测）
  const DUR = {
    'last-train': 146, 'midnight-noodles': 145, 'seventh-letter': 143,
    'bookstore-rain': 127, 'moonlight-cat': 128, 'copy-shop': 139,
    'father-watch': 148, 'seaside-record': 132, 'insomnia-clinic': 159,
    'before-snow': 134
  };
  BOOKS.forEach(b => { DUR[b.id] = b.duration; });
  const audioSrc = (id) => {
    const b = BOOKS.find(x => x.id === id);
    return b ? 'books/' + b.audio : 'audio/' + id + '.mp3';
  };

  // 睡眠合集定义
  const MIXES = {
    mix15: { key: 'mix15', name: '15 分钟浅眠', target: 15 * 60, icon: 'moon', featured: false },
    mix30: { key: 'mix30', name: '30 分钟深眠', target: 30 * 60, icon: 'star', featured: true },
    mix60: { key: 'mix60', name: '60 分钟长夜', target: 60 * 60, icon: 'infinity', featured: false }
  };

  // ---------- 持久化 ----------
  const DEFAULT_SETTINGS = {
    rate: 1.0, volume: 1.0, font: 19, warm: false, sleep: 0,
    taskOn: false, taskTime: '23:00', taskMix: 'daily'
  };
  function loadJSON(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  let settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON('yedu_v2_settings', {}));
  let favorites = loadJSON('yedu_favs', []);
  let readSet = loadJSON('yedu_read', {});
  let lastDaily = loadJSON('yedu_lastDaily', { date: '', id: '' });

  // ---------- 音频引擎 ----------
  const audio = $('audioEl');
  let queue = [];
  let queueIndex = 0;
  let queueName = '单篇播放';
  let isQueueMix = false;
  let mixTarget = 0;
  let elapsedBefore = 0;
  let currentStory = null;
  let isPlaying = false;
  let sleepTimer = null;
  let sleepEndAt = 0;

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function buildQueueFromMix(mix) {
    const ids = STORIES.map(s => s.id);
    const shuffled = ids.slice().sort(() => Math.random() - 0.5);
    const out = [];
    let total = 0, i = 0;
    while (total < mix.target && out.length < 40) {
      out.push(shuffled[i % shuffled.length]);
      total += DUR[shuffled[i % shuffled.length]] || 140;
      i++;
      if (i > shuffled.length) shuffled.sort(() => Math.random() - 0.5);
    }
    return out;
  }

  function playQueue(ids, name, opts) {
    opts = opts || {};
    queue = ids.slice();
    queueIndex = 0;
    queueName = name;
    isQueueMix = !!opts.mix;
    mixTarget = opts.mix ? opts.mix.target : 0;
    elapsedBefore = 0;
    if (!queue.length) return;
    loadTrack(0, true);
  }

  function loadTrack(index, autoplay) {
    if (index < 0 || index >= queue.length) { onQueueFinished(); return; }
    queueIndex = index;
    const story = findItem(queue[index]);
    if (!story) { loadTrack(index + 1, autoplay); return; }
    currentStory = story;
    elapsedBefore = queue.slice(0, index).reduce((a, id) => a + (DUR[id] || 140), 0);

    audio.src = audioSrc(story.id);
    audio.playbackRate = settings.rate;
    audio.volume = settings.volume;

    $('readerTitle').textContent = story.title;
    $('readerH1').textContent = story.title;
    $('readerQuote').textContent = '「' + story.quote + '」';
    $('readerMeta').innerHTML =
      '<span class="tag">' + story.style + '</span>' +
      '<span class="tag tag-plain">约 ' + story.minutes + ' 分钟</span>';
    $('readerCover').innerHTML = window.coverArt(story.cover, indexOf(story) + 1);
    $('readerBody').innerHTML = story.paragraphs.map(p => '<p>' + escapeHTML(p) + '</p>').join('');
    $('readerFav').classList.toggle('faved', favorites.includes(story.id));
    $('readerScroll').scrollTop = 0;

    updateQueueInfo();
    readSet[story.id] = true;
    saveJSON('yedu_read', readSet);

    $('durTime').textContent = fmtTime(DUR[story.id] || 0);
    if (autoplay) {
      audio.play().then(() => { isPlaying = true; updatePlayerUI(); })
        .catch(() => { isPlaying = false; updatePlayerUI(); });
    } else {
      isPlaying = false;
      updatePlayerUI();
    }
  }

  function updateQueueInfo() {
    if (isQueueMix) {
      const remain = Math.max(0, Math.round(mixTarget - elapsedBefore - (audio.currentTime || 0)));
      $('queueInfo').textContent = queueName + ' · 第 ' + (queueIndex + 1) + '/' + queue.length + ' 篇 · 约剩 ' + Math.ceil(remain / 60) + ' 分钟';
    } else if (queue.length > 1) {
      $('queueInfo').textContent = queueName + ' · 第 ' + (queueIndex + 1) + '/' + queue.length + ' 篇';
    } else {
      $('queueInfo').textContent = '单篇播放';
    }
  }

  function togglePlay() {
    if (!currentStory && queue.length === 0) {
      playQueue([dailyStory.id], '单篇播放');
      return;
    }
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play().then(() => { isPlaying = true; }).catch(() => {}); }
    updatePlayerUI();
  }

  function onQueueFinished() {
    isPlaying = false;
    audio.pause();
    updatePlayerUI();
    clearSleepTimer();
    toast('播放完毕，晚安 🌙');
  }

  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || (currentStory ? DUR[currentStory.id] : 0);
    const ratio = d ? (audio.currentTime / d) : 0;
    $('progressFill').style.width = (ratio * 100) + '%';
    if (!$('audioSeek').matches(':active')) $('audioSeek').value = Math.round(ratio * 1000);
    $('curTime').textContent = fmtTime(audio.currentTime);
    if (isQueueMix) updateQueueInfo();
  });
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && isFinite(audio.duration)) $('durTime').textContent = fmtTime(audio.duration);
  });
  audio.addEventListener('ended', () => {
    if (queueIndex + 1 < queue.length) loadTrack(queueIndex + 1, true);
    else onQueueFinished();
  });
  audio.addEventListener('play', () => { isPlaying = true; updatePlayerUI(); });
  audio.addEventListener('pause', () => { isPlaying = false; updatePlayerUI(); });

  function updatePlayerUI() {
    $('player').classList.toggle('playing', isPlaying);
    $('playBtn').classList.toggle('playing', isPlaying);
    $('miniPlayBtn').classList.toggle('playing', isPlaying);
    $('playerLabel').textContent = isPlaying
      ? (currentStory ? '正在播放 · ' + currentStory.title : '正在播放')
      : (currentStory ? '已暂停 · ' + currentStory.title : '轻触聆听');
  }

  // ---------- 睡眠定时 ----------
  function startSleepTimer() {
    clearSleepTimer();
    if (!settings.sleep) { updateSleepBadge(); return; }
    sleepEndAt = Date.now() + settings.sleep * 60000;
    sleepTimer = setInterval(() => {
      const remain = Math.max(0, Math.ceil((sleepEndAt - Date.now()) / 60000));
      updateSleepBadge(remain);
      if (Date.now() >= sleepEndAt) {
        audio.pause(); isPlaying = false; clearSleepTimer(); updatePlayerUI();
        toast('睡眠时间到，晚安 🌙');
      }
    }, 1000);
    updateSleepBadge(settings.sleep);
  }
  function clearSleepTimer() {
    if (sleepTimer) { clearInterval(sleepTimer); sleepTimer = null; }
    updateSleepBadge();
  }
  function updateSleepBadge(min) {
    const badge = $('sleepBadge'), btn = $('sleepToggle');
    if (!badge || !btn) return;
    if (settings.sleep > 0 && min != null) {
      badge.textContent = min; badge.classList.remove('hidden'); btn.classList.add('active');
      $('playerSub').textContent = '睡眠定时 ' + min + ' 分钟 · 到点轻停';
    } else if (settings.sleep > 0) {
      badge.textContent = settings.sleep; badge.classList.remove('hidden'); btn.classList.add('active');
    } else {
      badge.classList.add('hidden'); btn.classList.remove('active');
      $('playerSub').textContent = '晓晓 · 温暖女声';
    }
  }

  // ---------- 每晚定时任务 ----------
  let lastFiredDate = '';
  function checkTask() {
    if (!settings.taskOn) return;
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const today = dateKey(now);
    if (hhmm === settings.taskTime && lastFiredDate !== today) {
      lastFiredDate = today;
      toast('睡前时间到，开始播放 🌙');
      startTaskPlayback();
    }
  }
  function startTaskPlayback() {
    const choice = settings.taskMix;
    if (choice === 'daily') {
      openReader(dailyStory);
      playQueue([dailyStory.id], '今夜精选');
    } else if (MIXES[choice]) {
      const mix = MIXES[choice];
      openReader(null);
      playQueue(buildQueueFromMix(mix), mix.name, { mix });
    }
    if (settings.sleep) startSleepTimer();
  }

  // ---------- 每日精选 ----------
  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hashString(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
  function getDailyStory() {
    const today = dateKey(new Date());
    if (lastDaily.date === today) {
      const f = STORIES.find(s => s.id === lastDaily.id);
      if (f) return f;
    }
    const s = STORIES[hashString(today) % STORIES.length];
    lastDaily = { date: today, id: s.id };
    saveJSON('yedu_lastDaily', lastDaily);
    return s;
  }
  let dailyStory = null;

  // ---------- 渲染 ----------
  function indexOf(story) { return ALL.findIndex(x => x.id === story.id); }
  function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  function renderGreeting() {
    const h = new Date().getHours();
    let hello = '晚上好';
    if (h < 5) hello = '夜深了';
    else if (h < 11) hello = '早上好';
    else if (h < 14) hello = '中午好';
    else if (h < 18) hello = '下午好';
    $('greetingHello').textContent = hello;
    const d = new Date();
    $('greetingDate').textContent = (d.getMonth()+1) + '月' + d.getDate() + '日 · 星期' + ['日','一','二','三','四','五','六'][d.getDay()];
  }

  function renderFeatured() {
    const s = dailyStory;
    $('featureCover').innerHTML = window.coverArt(s.cover, indexOf(s) + 1);
    $('featureTags').innerHTML = '<span class="tag">' + s.style + '</span><span class="tag tag-plain">约 ' + s.minutes + ' 分钟</span>';
    $('featureTitle').textContent = s.title;
    $('featureQuote').textContent = '「' + s.quote + '」';
    $('featureSummary').textContent = s.summary;
  }

  function renderMixes() {
    const mixIcons = {
      moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.6 6.6 0 0 0 10.7 10.7z"/></svg>',
      star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.1l5.8-.8z"/></svg>',
      infinity: '<svg viewBox="0 0 24 24"><path d="M6.5 8a4 4 0 1 0 0 8c2.5 0 4-4 5.5-4s3 4 5.5 4a4 4 0 1 0 0-8c-2.5 0-4 4-5.5 4S9 8 6.5 8z"/></svg>'
    };
    $('mixGrid').innerHTML = Object.values(MIXES).map(m =>
      '<button class="mix-card' + (m.featured ? ' featured-mix' : '') + '" data-mix="' + m.key + '">' +
        '<span class="mix-ico">' + mixIcons[m.icon] + '</span>' +
        '<span class="mix-num">' + (m.target / 60) + '<small>分钟</small></span>' +
        '<span class="mix-name">' + m.name + '</span>' +
      '</button>'
    ).join('');
  }

  function renderOfficialLinks() {
    const links = [
      { name: '喜马拉雅 · 助眠专区', color: '#f24b3a', mark: '喜', url: 'https://www.ximalaya.com/' },
      { name: '懒人听书', color: '#ff8a3d', mark: '懒', url: 'https://www.lrts.me/' },
      { name: '微信读书 · 听书', color: '#2dc16b', mark: '读', url: 'https://weread.qq.com/' }
    ];
    $('officialLinks').innerHTML = links.map(l =>
      '<a class="official-link" href="' + l.url + '" target="_blank" rel="noopener">' +
        '<span class="ol-dot" style="background:' + l.color + '">' + l.mark + '</span>' +
        '<span>' + l.name + '</span><span class="ol-arrow">→</span></a>'
    ).join('');
  }

  function bookItemHTML(s) {
    const read = !!readSet[s.id];
    return '<button class="story-item" data-id="' + s.id + '" data-book="1">' +
      '<span class="story-thumb">' + window.coverArt(s.cover, indexOf(s) + 1) + '</span>' +
      '<span class="story-info">' +
        '<span class="story-style">' + s.style + ' · 公版经典</span>' +
        '<h3>' + s.title + '</h3><p>' + s.author + ' · 有声书</p>' +
        '<span class="story-foot"><span>约 ' + s.minutes + ' 分钟</span>' +
        (read ? '<span>已听</span>' : '') +
        '</span></span></button>';
  }

  function renderBooks() {
    if (!$('booksList')) return;
    $('booksCount').textContent = BOOKS.length + ' 部';
    $('booksList').innerHTML = BOOKS.map(bookItemHTML).join('');
  }

  function storyItemHTML(s) {
    const fav = favorites.includes(s.id), read = !!readSet[s.id];
    return '<button class="story-item" data-id="' + s.id + '">' +
      '<span class="story-thumb">' + window.coverArt(s.cover, indexOf(s) + 1) + '</span>' +
      '<span class="story-info">' +
        '<span class="story-style">' + s.style + '</span>' +
        '<h3>' + s.title + '</h3><p>' + s.summary + '</p>' +
        '<span class="story-foot"><span>约 ' + s.minutes + ' 分钟</span>' +
        (read ? '<span>已读</span>' : '') + (fav ? '<span class="fav-mark">♥ 已收藏</span>' : '') +
        '</span></span></button>';
  }

  let activeFilter = '全部';
  function renderLibrary() {
    const styles = ['全部'].concat(Array.from(new Set(STORIES.map(s => s.style))));
    $('filterChips').innerHTML = styles.map(st =>
      '<button class="chip' + (st === activeFilter ? ' active' : '') + '" data-style="' + st + '">' + st + '</button>').join('');
    const list = activeFilter === '全部' ? STORIES : STORIES.filter(s => s.style === activeFilter);
    $('libraryCount').textContent = list.length + ' 篇';
    $('storyList').innerHTML = list.map(storyItemHTML).join('');
  }
  function renderFavorites() {
    const list = ALL.filter(s => favorites.includes(s.id));
    $('favEmpty').classList.toggle('hidden', list.length > 0);
    $('favList').innerHTML = list.map(s => s.isBook ? bookItemHTML(s) : storyItemHTML(s)).join('');
  }

  // ---------- 播放器界面 ----------
  function openReader(story) {
    $('reader').classList.remove('hidden');
    $('tabbar').classList.add('hidden');
    if (story) {
      queue = [story.id]; queueIndex = 0; queueName = '单篇播放';
      isQueueMix = false; mixTarget = 0;
      loadTrack(0, false);
    }
  }
  function closeReader() {
    $('reader').classList.add('hidden');
    $('tabbar').classList.remove('hidden');
    if (settingsFromReader) {
      settingsFromReader = false;
      $('backToReader').classList.add('hidden');
      showPage('home');
    }
    renderLibrary(); renderFavorites();
  }
  function toggleFavorite(id) {
    const i = favorites.indexOf(id);
    if (i >= 0) { favorites.splice(i, 1); toast('已取消收藏'); }
    else { favorites.push(id); toast('已收藏 ♥'); }
    saveJSON('yedu_favs', favorites);
    if (currentStory && currentStory.id === id) $('readerFav').classList.toggle('faved', favorites.includes(id));
    renderLibrary(); renderFavorites();
  }
  function randomStory(excludeId) {
    let pool = STORIES.filter(s => s.id !== excludeId);
    if (!pool.length) pool = STORIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- 导航 ----------
  let settingsFromReader = false;
  function showPage(name) {
    ['home','fav','settings'].forEach(p => $('page-' + p).classList.toggle('hidden', p !== name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === name));
    window.scrollTo(0, 0);
    if (name === 'fav') renderFavorites();
    if (name !== 'settings') { settingsFromReader = false; $('backToReader').classList.add('hidden'); }
  }

  // ---------- 设置 ----------
  function applySettings() {
    document.body.classList.toggle('warm', !!settings.warm);
    document.querySelector('meta[name="theme-color"]').content = settings.warm ? '#171310' : '#121426';
    $('rateRange').value = settings.rate; $('rateValue').textContent = Number(settings.rate).toFixed(1) + ' ×';
    $('volumeRange').value = settings.volume; $('volumeValue').textContent = Math.round(settings.volume*100) + '%';
    $('fontRange').value = settings.font; updateFontLabel();
    $('warmToggle').checked = !!settings.warm;
    $('sleepSelect').value = String(settings.sleep);
    $('taskToggle').checked = !!settings.taskOn;
    $('taskTime').value = settings.taskTime || '23:00';
    $('taskMix').value = settings.taskMix || 'daily';
    audio.playbackRate = settings.rate;
    audio.volume = settings.volume;
    applyReaderFont();
    updateSleepBadge();
    updateTaskNote();
  }
  function updateFontLabel() {
    const f = Number(settings.font);
    $('fontValue').textContent = f <= 17 ? '小' : f <= 20 ? '标准' : f <= 22 ? '大' : '超大';
  }
  function applyReaderFont() { document.documentElement.style.setProperty('--reader-font', settings.font + 'px'); }
  function persist() { saveJSON('yedu_v2_settings', settings); }
  function updateTaskNote() {
    $('taskNote').textContent = settings.taskOn
      ? '已开启：每天 ' + settings.taskTime + ' 自动播放' + ({daily:'今夜精选',mix15:'15分钟浅眠',mix30:'30分钟深眠',mix60:'60分钟长夜'}[settings.taskMix]) + '。请保持 App 打开。'
      : '定时任务在 App 打开时生效；关闭后浏览器无法在后台自动发声。';
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.add('hidden'), 300); }, 2200);
  }

  function buildStars() {
    let html = '';
    for (let i = 0; i < 40; i++) {
      html += '<span class="star" style="left:' + (Math.random()*100).toFixed(2) + '%;top:' + (Math.random()*70).toFixed(2) + '%;animation-delay:' + (Math.random()*4).toFixed(2) + 's;animation-duration:' + (3+Math.random()*4).toFixed(2) + 's"></span>';
    }
    $('stars').innerHTML = html;
  }

  // ---------- 事件 ----------
  function bindEvents() {
    $('featureListen').addEventListener('click', () => { openReader(dailyStory); playQueue([dailyStory.id], '单篇播放'); });
    $('featureRead').addEventListener('click', () => { openReader(dailyStory); });

    $('mixGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.mix-card');
      if (!card) return;
      const mix = MIXES[card.dataset.mix];
      openReader(null);
      playQueue(buildQueueFromMix(mix), mix.name, { mix });
      toast(mix.name + ' · 已开始连续播放');
    });

    $('randomBtn').addEventListener('click', () => {
      const s = randomStory(currentStory && currentStory.id);
      toast('为你抽到一篇 · ' + s.title);
      setTimeout(() => { openReader(s); playQueue([s.id], '单篇播放'); }, 250);
    });
    $('toFavBtn').addEventListener('click', () => showPage('fav'));

    ['storyList','favList','booksList'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const item = e.target.closest('.story-item');
        if (!item) return;
        const s = findItem(item.dataset.id);
        if (s) { openReader(s); playQueue([s.id], '单篇播放'); }
      });
    });

    $('filterChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeFilter = chip.dataset.style; renderLibrary();
    });

    $('readerBack').addEventListener('click', closeReader);
    $('readerFav').addEventListener('click', () => { if (currentStory) toggleFavorite(currentStory.id); });
    $('nextStoryBtn').addEventListener('click', () => {
      const s = randomStory(currentStory && currentStory.id);
      openReader(s); playQueue([s.id], '单篇播放');
    });

    $('playBtn').addEventListener('click', togglePlay);
    $('miniPlayBtn').addEventListener('click', togglePlay);
    $('prevBtn').addEventListener('click', () => { if (queueIndex > 0) loadTrack(queueIndex - 1, isPlaying); });
    $('nextBtn').addEventListener('click', () => { if (queueIndex + 1 < queue.length) loadTrack(queueIndex + 1, isPlaying); });

    $('audioSeek').addEventListener('input', (e) => {
      if (audio.duration) audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
    });

    $('textToggle').addEventListener('click', () => {
      const body = $('readerText');
      body.classList.toggle('hidden');
      $('textToggle').classList.toggle('open', !body.classList.contains('hidden'));
    });

    $('sleepToggle').addEventListener('click', () => {
      const opts = [0,10,15,20,30,45,60];
      const i = opts.indexOf(Number(settings.sleep));
      settings.sleep = opts[(i+1) % opts.length];
      persist(); $('sleepSelect').value = String(settings.sleep);
      if (isPlaying) startSleepTimer(); else updateSleepBadge();
      toast(settings.sleep ? '睡眠定时 ' + settings.sleep + ' 分钟' : '已关闭睡眠定时');
    });

    $('toSettings').addEventListener('click', () => {
      settingsFromReader = true;
      $('reader').classList.add('hidden');
      $('tabbar').classList.remove('hidden');
      $('backToReader').classList.remove('hidden');
      showPage('settings');
      $('backToReader').classList.remove('hidden');
      toast('调整后可返回继续收听');
    });
    $('backToReader').addEventListener('click', () => {
      $('reader').classList.remove('hidden');
      $('tabbar').classList.add('hidden');
      $('backToReader').classList.add('hidden');
      window.scrollTo(0, 0);
    });

    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showPage(t.dataset.page)));

    $('rateRange').addEventListener('input', (e) => {
      settings.rate = Number(e.target.value);
      $('rateValue').textContent = settings.rate.toFixed(1) + ' ×';
      audio.playbackRate = settings.rate; persist();
    });
    $('volumeRange').addEventListener('input', (e) => {
      settings.volume = Number(e.target.value);
      $('volumeValue').textContent = Math.round(settings.volume*100) + '%';
      audio.volume = settings.volume; persist();
    });
    $('fontRange').addEventListener('input', (e) => {
      settings.font = Number(e.target.value); updateFontLabel(); applyReaderFont(); persist();
    });
    $('warmToggle').addEventListener('change', (e) => {
      settings.warm = e.target.checked;
      document.body.classList.toggle('warm', settings.warm);
      document.querySelector('meta[name="theme-color"]').content = settings.warm ? '#171310' : '#121426';
      persist();
    });
    $('sleepSelect').addEventListener('change', (e) => {
      settings.sleep = Number(e.target.value); persist();
      if (isPlaying) startSleepTimer(); else updateSleepBadge();
    });
    $('taskToggle').addEventListener('change', (e) => {
      settings.taskOn = e.target.checked; persist(); updateTaskNote();
      toast(settings.taskOn ? '已开启每晚定时播放' : '已关闭定时任务');
    });
    $('taskTime').addEventListener('change', (e) => { settings.taskTime = e.target.value; persist(); updateTaskNote(); });
    $('taskMix').addEventListener('change', (e) => { settings.taskMix = e.target.value; persist(); updateTaskNote(); });
  }

  // 检测是否为旧缓存页面：仅显示温和的顶部提示，不遮挡界面、不强制打断播放
  function checkStaleCache() {
    if (window.__staleShown) return true;
    const required = ['mixGrid', 'taskToggle', 'audioEl', 'featureListen', 'reader'];
    const missing = required.filter(id => !document.getElementById(id));
    if (!missing.length) return false;
    window.__staleShown = true;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 16px;background:#e8a860;color:#241a0e;font-size:13px;line-height:1.5;text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 6px 20px rgba(0,0,0,.45)';
    bar.innerHTML = '<span>检测到旧版界面，点右侧更新到最新版</span>' +
      '<button id="yeduReloadBtn" style="flex:none;border:0;background:#241a0e;color:#f3e6cf;padding:7px 14px;border-radius:8px;font-size:12px;cursor:pointer">更新</button>';
    document.body.appendChild(bar);
    bar.querySelector('#yeduReloadBtn').addEventListener('click', () => {
      if (window.caches) caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      }
      location.reload();
    });
    return true;
  }

  function init() {
    if (checkStaleCache()) return;
    try {
      buildStars();
      dailyStory = getDailyStory();
      renderGreeting(); renderFeatured(); renderMixes(); renderOfficialLinks();
      renderBooks(); renderLibrary(); renderFavorites(); applySettings(); bindEvents();
      audio.volume = settings.volume; audio.playbackRate = settings.rate;
      setInterval(checkTask, 20000);
      setTimeout(checkTask, 1000);
    } catch (err) {
      console.error('夜读初始化失败', err);
      checkStaleCache();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
