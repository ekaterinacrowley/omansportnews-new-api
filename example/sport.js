// Контейнеры для видов спорта
let footballContainer;
let cricketContainer;
let basketballContainer;
let volleyballContainer;
let hockeyContainer;

// Функция для инициализации контейнеров (создаёт отсутствующие для всех SPORTS)
function initializeContainers() {
  footballContainer = document.getElementById('footballLeagues');
  cricketContainer = document.getElementById('cricketLeagues');
  basketballContainer = document.getElementById('basketballLeagues');
  volleyballContainer = document.getElementById('volleyballLeagues');
  hockeyContainer = document.getElementById('hockeyLeagues');

  // Создаём контейнеры для всех зарегистрированных видов спорта
  SPORTS.forEach(sport => ensureSportContainer(sport));

  console.log('=== ИНИЦИАЛИЗАЦИЯ КОНТЕЙНЕРОВ ===');
  SPORTS.forEach(sport => console.log(`${sport}Container:`, document.getElementById(`${sport}Leagues`)));
}

// Храним текущую дату для всех видов спорта (общая)
let currentDate = getTodayTimestamp();

// Флаги для предотвращения множественных запросов (динамически расширяется)
const loadingFlags = {
  football: false,
  cricket: false,
  basketball: false,
  volleyball: false,
  hockey: false
};

// Хранилище данных для фильтров
const availableFilters = {};
const lastFetchedData = {};

// Хранилище доступных дат для каждого вида спорта (предстоящие матчи)
const availableDatesBySport = {
  football: [],
  cricket: [],
  basketball: [],
  volleyball: [],
  hockey: []
};

// Хранилище доступных дат для завершенных матчей
const completedDatesBySport = {
  football: [],
  cricket: [],
  basketball: [],
  volleyball: [],
  hockey: []
};

// Общее хранилище всех доступных дат
let allAvailableDates = [];

// Сопоставление API-имён видов спорта с существующими slug'ами
const SPORT_NAME_ALIASES = {
  'football': 'football',
  'soccer': 'football',
  'ice hockey': 'hockey',
  'hockey': 'hockey',
  'basketball': 'basketball',
  'tennis': 'tennis',
  'baseball': 'baseball',
  'cricket': 'cricket',
  'volleyball': 'volleyball',
  'rugby': 'rugby',
  'rugby union': 'rugby',
  'rugby league': 'rugby'
};

// Создаёт или возвращает уже существующий контейнер для спорта в DOM
function ensureSportContainer(slug) {
  const containerId = `${slug}Leagues`;
  let el = document.getElementById(containerId);
  if (el) return el;

  // Создаём новый контейнер перед #newsContainer
  el = document.createElement('div');
  el.className = 'leagues';
  el.id = containerId;
  el.style.display = 'none';

  const newsEl = document.getElementById('newsContainer');
  if (newsEl && newsEl.parentNode) {
    newsEl.parentNode.insertBefore(el, newsEl);
  } else {
    const mainSection = document.querySelector('.sports-section') || document.querySelector('main') || document.body;
    mainSection.appendChild(el);
  }
  console.log(`[SPORTS] Created container #${containerId}`);
  return el;
}

// Инициализирует глобальные структуры для нового вида спорта
function registerSport(slug) {
  if (!loadingFlags.hasOwnProperty(slug)) loadingFlags[slug] = false;
  if (!availableDatesBySport.hasOwnProperty(slug)) availableDatesBySport[slug] = [];
  if (!completedDatesBySport.hasOwnProperty(slug)) completedDatesBySport[slug] = [];
}

// Загружает список всех видов спорта из API и расширяет SPORTS/SPORT_IDS/SPORT_NAMES
async function fetchAndInitSports() {
  console.log('[SPORTS] Fetching available sports from API...');
  try {
    const resp = await fetch('/api/sports');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const items = Array.isArray(data) ? data : (data.items || []);

    items.forEach(item => {
      const apiName = (item.name || '').trim();
      const apiId = item.id;
      if (!apiName || !apiId) return;

      const lowerName = apiName.toLowerCase();
      // Ищем существующий alias или генерируем новый slug
      const slug = SPORT_NAME_ALIASES[lowerName] || lowerName.replace(/[^a-z0-9]/g, '');

      if (!SPORTS.includes(slug)) {
        // Новый вид спорта — добавляем
        SPORTS.push(slug);
        SPORT_IDS[slug] = apiId;
        SPORT_NAMES[slug] = apiName;
        registerSport(slug);
        console.log(`[SPORTS] Added new sport: ${slug} (id=${apiId}, name="${apiName}")`);
      } else if (SPORT_IDS[slug] !== apiId) {
        // Уточняем ID если он изменился
        console.log(`[SPORTS] Updating ID for ${slug}: ${SPORT_IDS[slug]} → ${apiId}`);
        SPORT_IDS[slug] = apiId;
      }
    });

    console.log(`[SPORTS] Final SPORTS list:`, SPORTS);
  } catch (e) {
    console.warn('[SPORTS] Failed to fetch sports list, using defaults:', e.message);
  }
}

// Минимальная и максимальная доступные даты
let minAvailableDate = null;
let maxAvailableDate = null;

// Соответствие sportId для каждого вида спорта (пополняется динамически из API)
let SPORT_IDS = {
  football: 1,
  basketball: 2,
  hockey: 3,
  cricket: 4,
  volleyball: 5
};

let SPORT_NAMES = {
  football: 'Football',
  cricket: 'Cricket',
  basketball: 'Basketball',
  volleyball: 'Volleyball',
  hockey: 'Hockey'
};

let SPORTS = ['football', 'cricket', 'basketball', 'volleyball', 'hockey'];
// Виды спорта, которые грузятся при старте страницы (остальные — по клику)
const INITIAL_SPORTS = new Set(['football', 'cricket', 'basketball', 'volleyball', 'hockey', 'tennis']);
const MAX_PAST_MATCHES_PER_SPORT = 10;
const CACHE_ENABLED = true;
const sidebarState = {
  sport: '',
  country: '',
  leagueId: ''
};
let hasExplicitSportSelection = false;
let isGlobalDateUpdating = false;
let matchesLoaderCounter = 0;
let matchesLoaderAnimation = null;

function getMatchesLoadingText() {
  try {
    if (typeof getText === 'function') {
      return getText('matches.loading');
    }
  } catch (_e) {
    // no-op
  }
  return 'Loading matches...';
}

function updateMatchesLoaderText() {
  const overlay = document.getElementById('matchesLoadingOverlay');
  if (!overlay) return;

  const textEl = overlay.querySelector('.matches-loading__text');
  const innerEl = overlay.querySelector('.matches-loading__inner');
  const text = getMatchesLoadingText();

  if (textEl) textEl.textContent = text;
  if (innerEl) innerEl.setAttribute('aria-label', text);
}

function ensureMatchesLoader() {
  let overlay = document.getElementById('matchesLoadingOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'matchesLoadingOverlay';
  overlay.className = 'matches-loading';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="matches-loading__inner" role="status" aria-live="polite" aria-label="${getMatchesLoadingText()}">
      <div class="matches-loading__animation" style="width: 220px; height: 220px"></div>
      <div class="matches-loading__text">${getMatchesLoadingText()}</div>
    </div>
  `;

  document.body.appendChild(overlay);
  initMatchesLoaderAnimation();
  return overlay;
}

function initMatchesLoaderAnimation() {
  if (matchesLoaderAnimation) return;

  const overlay = document.getElementById('matchesLoadingOverlay');
  const animationContainer = overlay?.querySelector('.matches-loading__animation');
  if (!animationContainer) {
    console.warn('[LOADER] Animation container not found');
    return;
  }

  const lottieApi = window.lottie;
  if (!lottieApi || typeof lottieApi.loadAnimation !== 'function') {
    console.warn('[LOADER] lottie-web is not available yet, waiting...');
    // Wait for lottie-web to be available
    const checkLottie = setInterval(() => {
      if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
        clearInterval(checkLottie);
        console.log('[LOADER] lottie-web became available, retrying init');
        initMatchesLoaderAnimation();
      }
    }, 100);
    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkLottie), 5000);
    return;
  }

  try {
    matchesLoaderAnimation = lottieApi.loadAnimation({
      container: animationContainer,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: 'images/Soccerplayerkickingball.json',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet'
      }
    });
    console.log('[LOADER] Animation initialized successfully');
  } catch (err) {
    console.error('[LOADER] Failed to initialize animation:', err);
    matchesLoaderAnimation = null;
  }
}

function showMatchesLoader() {
  matchesLoaderCounter += 1;
  const overlay = ensureMatchesLoader();
  
  // Retry animation init if it failed before
  if (!matchesLoaderAnimation) {
    initMatchesLoaderAnimation();
  }
  
  if (matchesLoaderAnimation && typeof matchesLoaderAnimation.play === 'function') {
    try {
      matchesLoaderAnimation.play();
      console.log('[LOADER] Animation started playing');
    } catch (err) {
      console.error('[LOADER] Failed to play animation:', err);
    }
  } else {
    console.warn('[LOADER] No animation ready to play');
  }
  
  updateMatchesLoaderText();
  overlay.classList.add('matches-loading--active');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideMatchesLoader() {
  matchesLoaderCounter = Math.max(0, matchesLoaderCounter - 1);
  if (matchesLoaderCounter > 0) return;

  const overlay = document.getElementById('matchesLoadingOverlay');
  if (!overlay) return;
  if (matchesLoaderAnimation && typeof matchesLoaderAnimation.pause === 'function') {
    matchesLoaderAnimation.pause();
  }
  overlay.classList.remove('matches-loading--active');
  overlay.setAttribute('aria-hidden', 'true');
}

function isExcludedFutureLeague(event) {
  const leagueName = event?.tournamentNameLocalization || event?.tournament?.name || '';
  return /winner|results/i.test(leagueName);
}

const MATCHES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MATCHES_CACHE_PREFIX = 'fastscore.matchesCache.v2';

function normalizeDayTimestamp(timestamp) {
  const date = new Date(Number(timestamp || 0) * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function isQuotaExceededError(error) {
  if (!error) return false;
  return error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014;
}

function getMatchesCacheRecords() {
  const records = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(`${MATCHES_CACHE_PREFIX}:`)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      records.push({
        key,
        expiresAt: parsed?.expiresAt || 0
      });
    } catch (_e) {
      records.push({ key, expiresAt: 0 });
    }
  }
  return records;
}

function cleanupExpiredMatchesCache() {
  const now = Date.now();
  const records = getMatchesCacheRecords();
  records.forEach(({ key, expiresAt }) => {
    if (!expiresAt || expiresAt < now) {
      localStorage.removeItem(key);
    }
  });
}

function evictOldestMatchesCacheEntries(count = 15) {
  const records = getMatchesCacheRecords()
    .sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
    .slice(0, count);

  records.forEach(({ key }) => {
    localStorage.removeItem(key);
  });
}

function buildCacheKey(scope, params = {}) {
  const sortedEntries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const suffix = sortedEntries.map(([key, value]) => `${key}=${value}`).join('&');
  return `${MATCHES_CACHE_PREFIX}:${scope}:${suffix}`;
}

function readCache(cacheKey) {
  if (!CACHE_ENABLED) return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.value;
  } catch (e) {
    console.warn('[CACHE] read failed:', cacheKey, e);
    return null;
  }
}

function writeCache(cacheKey, value) {
  if (!CACHE_ENABLED) return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      value,
      expiresAt: Date.now() + MATCHES_CACHE_TTL_MS
    }));
  } catch (e) {
    if (!isQuotaExceededError(e)) {
      console.warn('[CACHE] write failed:', cacheKey, e);
      return;
    }

    try {
      cleanupExpiredMatchesCache();
      localStorage.setItem(cacheKey, JSON.stringify({
        value,
        expiresAt: Date.now() + MATCHES_CACHE_TTL_MS
      }));
    } catch (_retryError) {
      try {
        evictOldestMatchesCacheEntries(20);
        localStorage.setItem(cacheKey, JSON.stringify({
          value,
          expiresAt: Date.now() + MATCHES_CACHE_TTL_MS
        }));
      } catch (finalError) {
        console.warn('[CACHE] skipped write after quota cleanup:', cacheKey, finalError);
      }
    }
  }
}

async function getCachedOrFetch(cacheKey, fetcher) {
  if (!CACHE_ENABLED) {
    return fetcher();
  }

  const cached = readCache(cacheKey);
  if (cached) {
    console.log('[CACHE] HIT', cacheKey);
    return cached;
  }

  console.log('[CACHE] MISS', cacheKey);
  const fresh = await fetcher();
  if (!fresh?.meta?.mock) {
    writeCache(cacheKey, fresh);
  } else {
    console.warn('[CACHE] skip mock response:', cacheKey);
  }
  return fresh;
}

// Функция для получения URL логотипа команды
function getTeamLogo(imageData) {
  if (!imageData) return '';
  if (Array.isArray(imageData) && imageData[0]) {
    return `/api/img/opponent/${imageData[0]}`;
  }
  if (typeof imageData === 'string' && imageData) {
    return `/api/img/opponent/${imageData}`;
  }
  return '';
}

// Функция для получения URL логотипа турнира
function getTournamentLogo(imageData) {
  if (!imageData) return '';
  if (Array.isArray(imageData) && imageData[0]) {
    return `/api/img/tournament/${imageData[0]}`;
  }
  if (typeof imageData === 'string' && imageData) {
    return `/api/img/tournament/${imageData}`;
  }
  return '';
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTodayTimestamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

// Проверка, является ли дата прошедшей (любая дата до текущего дня)
function isPastDate(timestamp) {
  const todayTimestamp = getTodayTimestamp();
  return timestamp < todayTimestamp;
}

function limitMatchesForDisplay(matches, dateTimestamp = currentDate) {
  if (!Array.isArray(matches)) return [];
  if (!isPastDate(dateTimestamp)) return matches;
  return matches.slice(0, MAX_PAST_MATCHES_PER_SPORT);
}

// Проверка, есть ли матчи в выбранную дату хотя бы для одного вида спорта
function hasAnyMatchesOnDate(timestamp) {
  const dateStr = formatDate(timestamp);
  return allAvailableDates.some(d => d.dateStr === dateStr);
}

// Получение завершенных матчей (результатов) за конкретную дату
async function fetchCompletedMatchesForSport(sport, dateFrom, dateTo) {
  console.log(`[RESULTS] Fetching completed matches for ${sport} from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`);
  
  try {
    const sportId = SPORT_IDS[sport];
    const normalizedDateFrom = normalizeDayTimestamp(dateFrom);
    const normalizedDateTo = normalizedDateFrom + 24 * 3600;
    const cacheKey = buildCacheKey('results-events', { sportId, dateFrom: normalizedDateFrom, dateTo: normalizedDateTo });

    // Используем даты для запроса
    const url = `/api/results-events?sportId=${sportId}&dateFrom=${normalizedDateFrom}&dateTo=${normalizedDateTo}`;
    console.log(`[RESULTS] Fetching: ${url}`);
    
    const data = await getCachedOrFetch(cacheKey, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
    console.log(`[RESULTS] Response for ${sport}:`, data);
    
    let events = [];
    if (data.items && Array.isArray(data.items)) {
      events = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      events = data.data;
    } else if (Array.isArray(data)) {
      events = data;
    }
    
    // Фильтруем события по дате (на всякий случай)
    const filteredEvents = events.filter(event => {
      if (!event.startDate) return false;
      // Проверяем, что событие попадает в диапазон дат
      return event.startDate >= normalizedDateFrom && event.startDate < normalizedDateTo;
    });
    
    console.log(`[RESULTS] ${sport} completed matches found: ${filteredEvents.length}`);
    if (filteredEvents.length > 0) {
      console.log(`[RESULTS] First result for ${sport}:`, filteredEvents[0]);
      console.log(`[RESULTS] Result structure:`, Object.keys(filteredEvents[0]));
    }

    return filteredEvents;
    
  } catch (e) {
    console.error(`[RESULTS] Error fetching ${sport} results:`, e);
    return [];
  }
}

// Получение доступных дат из завершенных матчей (за последние 30 дней)
async function fetchCompletedDates(sport) {
  console.log(`[DATES] Fetching completed dates for ${sport}...`);
  
  try {
    const todayStart = getTodayTimestamp();
    const thirtyDaysAgo = todayStart - 30 * 24 * 3600; // 30 дней назад
    const todayEnd = todayStart + 24 * 3600;
    
    const sportId = SPORT_IDS[sport];
    const url = `/api/results-events?sportId=${sportId}&dateFrom=${thirtyDaysAgo}&dateTo=${todayEnd}`;
    console.log(`[DATES] Fetching completed dates for ${sport}:`, url);
    const cacheKey = buildCacheKey('results-dates-source', { sportId, dateFrom: thirtyDaysAgo, dateTo: todayEnd });

    const data = await getCachedOrFetch(cacheKey, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
    console.log(`[DATES] Response for ${sport}:`, data);
    
    let events = [];
    if (data.items && Array.isArray(data.items)) {
      events = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      events = data.data;
    } else if (Array.isArray(data)) {
      events = data;
    }
    
    const datesMap = new Map();
    events.forEach(event => {
      if (event.startDate) {
        const dateTimestamp = normalizeDayTimestamp(event.startDate);
        const dateStr = formatDate(dateTimestamp);
        if (!datesMap.has(dateStr)) {
          datesMap.set(dateStr, dateTimestamp);
        }
      }
    });
    
    completedDatesBySport[sport] = Array.from(datesMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([dateStr, timestamp]) => ({ dateStr, timestamp }));
    
    console.log(`[DATES] ${sport} completed dates:`, completedDatesBySport[sport].length);
    if (completedDatesBySport[sport].length > 0) {
      console.log(`[DATES] First completed date for ${sport}:`, completedDatesBySport[sport][0]);
    }
    
    return completedDatesBySport[sport];
    
  } catch (e) {
    console.error(`[DATES] Error fetching completed dates for ${sport}:`, e);
    return [];
  }
}
// Получение доступных дат для предстоящих матчей
async function fetchFutureDates(sport) {
  console.log(`[DATES] Fetching future dates for ${sport}...`);
  
  try {
    const now = getTodayTimestamp();
    const weekLater = now + 7 * 24 * 3600;
    const sportId = SPORT_IDS[sport];
    
    const url = `/api/events?sportId=${sportId}&gtStart=${now}&ltStart=${weekLater}`;
    console.log(`[DATES] Fetching future dates for ${sport}:`, url);
    const cacheKey = buildCacheKey('future-dates-source', { sportId, gtStart: now, ltStart: weekLater });

    const data = await getCachedOrFetch(cacheKey, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
    let events = [];
    
    if (data.items && Array.isArray(data.items)) {
      events = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      events = data.data;
    } else if (Array.isArray(data)) {
      events = data;
    }
    
    const filteredEvents = events.filter(event => !isExcludedFutureLeague(event));

    const datesMap = new Map();
    filteredEvents.forEach(event => {
      if (event.startDate) {
        const dateTimestamp = normalizeDayTimestamp(event.startDate);
        const dateStr = formatDate(dateTimestamp);
        if (!datesMap.has(dateStr)) {
          datesMap.set(dateStr, dateTimestamp);
        }
      }
    });
    
    availableDatesBySport[sport] = Array.from(datesMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([dateStr, timestamp]) => ({ dateStr, timestamp }));
    
    console.log(`[DATES] ${sport} future dates:`, availableDatesBySport[sport].length);
    
    return availableDatesBySport[sport];
    
  } catch (e) {
    console.error(`[DATES] Error fetching future dates for ${sport}:`, e);
    return [];
  }
}

// Получение всех доступных дат (объединение предстоящих и завершенных)
async function fetchAllAvailableDates() {
  console.log('[DATES] Fetching all available dates...');
  
  // Получаем предстоящие даты
  for (const sport of SPORTS) {
    await fetchFutureDates(sport);
  }
  
  // Получаем завершенные даты
  for (const sport of SPORTS) {
    await fetchCompletedDates(sport);
  }
  
  // Объединяем все даты в один массив
  const allDatesMap = new Map();
  
  // Добавляем предстоящие даты
  for (const sport of SPORTS) {
    availableDatesBySport[sport].forEach(({ dateStr, timestamp }) => {
      if (!allDatesMap.has(dateStr)) {
        allDatesMap.set(dateStr, {
          timestamp: timestamp,
          sports: [sport],
          type: 'upcoming'
        });
      } else {
        const existing = allDatesMap.get(dateStr);
        existing.sports.push(sport);
      }
    });
  }
  
  // Добавляем завершенные даты
  for (const sport of SPORTS) {
    completedDatesBySport[sport].forEach(({ dateStr, timestamp }) => {
      if (!allDatesMap.has(dateStr)) {
        allDatesMap.set(dateStr, {
          timestamp: timestamp,
          sports: [sport],
          type: 'completed'
        });
      } else {
        const existing = allDatesMap.get(dateStr);
        existing.sports.push(sport);
        existing.type = 'both';
      }
    });
  }
  
  // Преобразуем в массив и сортируем
  allAvailableDates = Array.from(allDatesMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([dateStr, data]) => ({
      dateStr: dateStr,
      timestamp: data.timestamp,
      sports: data.sports,
      type: data.type || 'upcoming'
    }));
  
  // Определяем минимальную и максимальную доступные даты
  if (allAvailableDates.length > 0) {
    minAvailableDate = allAvailableDates[0].timestamp;
    maxAvailableDate = allAvailableDates[allAvailableDates.length - 1].timestamp;
  } else {
    minAvailableDate = null;
    maxAvailableDate = null;
  }
  
  console.log('[DATES] All available dates:', allAvailableDates);
  console.log('[DATES] Min date:', minAvailableDate ? new Date(minAvailableDate * 1000).toISOString() : 'null');
  console.log('[DATES] Max date:', maxAvailableDate ? new Date(maxAvailableDate * 1000).toISOString() : 'null');
  
  // Обновляем отображение datePicker
  updateDatePicker();
  
  return allAvailableDates;
}

// Функция для получения статуса матча
function getMatchStatus(event, isResult = false) {
  if (isResult) {
    return {
      isLive: false,
      isFinished: true,
      statusText: 'FT'
    };
  }
  
  const period = event.period || 0;
  const now = Math.floor(Date.now() / 1000);
  const startTime = event.startDate;
  
  if (period > 0 && period <= 4) {
    const periodNames = { 1: '1H', 2: '2H', 3: '3H', 4: '4H' };
    return {
      isLive: true,
      isFinished: false,
      statusText: periodNames[period] || 'LIVE'
    };
  }
  
  if (period === 5 || (startTime && (now - startTime) > 7200)) {
    return {
      isLive: false,
      isFinished: true,
      statusText: 'FT'
    };
  }
  
  return {
    isLive: false,
    isFinished: false,
    statusText: 'NS'
  };
}

// Парсит счет из данных API (в т.ч. из `score: "2:1 (1:1,0:0)"`)
function parseResultScore(event) {
  let homeScore = '';
  let awayScore = '';
  let scoreString = '';

  // Проверяем наличие score в разных форматах
  if (event.score && typeof event.score === 'string') {
    scoreString = event.score || '';
    // Извлекаем основной счет из формата "7:9 (2:4,2:4,3:1)"
    const mainScoreMatch = scoreString.match(/^(\d+)\s*[:\-–—]\s*(\d+)/);
    if (mainScoreMatch) {
      homeScore = mainScoreMatch[1];
      awayScore = mainScoreMatch[2];
    }
  } else if (event.homeScore !== undefined || event.awayScore !== undefined) {
    homeScore = event.homeScore !== undefined ? event.homeScore : '';
    awayScore = event.awayScore !== undefined ? event.awayScore : '';
  } else if (event.score && typeof event.score === 'object') {
    if (event.score.home !== undefined && event.score.away !== undefined) {
      homeScore = event.score.home;
      awayScore = event.score.away;
    }
  } else if (event.scores && typeof event.scores === 'object') {
    if (event.scores.home !== undefined && event.scores.away !== undefined) {
      homeScore = event.scores.home;
      awayScore = event.scores.away;
    }
  }

  return { homeScore, awayScore, scoreString };
}

// Обновление отображения datePicker
function updateDatePicker() {
  const datePickerContainer = document.getElementById('globalDatePicker');
  if (!datePickerContainer) {
    console.warn('[DATES] globalDatePicker not found');
    return;
  }
  
  const prevDayBtn = datePickerContainer.querySelector('.prevDay');
  const nextDayBtn = datePickerContainer.querySelector('.nextDay');
  const dateSpan = datePickerContainer.querySelector('.filters__date');
  
  if (!prevDayBtn || !nextDayBtn) {
    console.warn('[DATES] Date picker buttons not found');
    return;
  }
  
  // Обновляем состояние кнопок навигации
  const hasPrev = canGoPrev();
  const hasNext = canGoNext();
  
  prevDayBtn.style.opacity = hasPrev ? '1' : '0.5';
  prevDayBtn.style.cursor = hasPrev ? 'pointer' : 'not-allowed';
  prevDayBtn.disabled = !hasPrev;
  
  nextDayBtn.style.opacity = hasNext ? '1' : '0.5';
  nextDayBtn.style.cursor = hasNext ? 'pointer' : 'not-allowed';
  nextDayBtn.disabled = !hasNext;
  
  // Форматируем отображение текущей даты
  const currentDateObj = new Date(currentDate * 1000);
  const day = String(currentDateObj.getDate()).padStart(2, '0');
  const month = String(currentDateObj.getMonth() + 1).padStart(2, '0');
  const weekday = currentDateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const isToday = formatDate(currentDate) === formatDate(getTodayTimestamp());
  const hasMatches = hasAnyMatchesOnDate(currentDate);
  const isPast = isPastDate(currentDate);
   
  if (dateSpan) {
    if (isToday && hasMatches) {
      dateSpan.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M3.99992 2.66602H11.9999C12.7072 2.66602 13.3854 2.94697 13.8855 3.44706C14.3856 3.94716 14.6666 4.62544 14.6666 5.33268V11.9993C14.6666 12.7066 14.3856 13.3849 13.8855 13.885C13.3854 14.3851 12.7072 14.666 11.9999 14.666H3.99992C3.29267 14.666 2.6144 14.3851 2.1143 13.885C1.6142 13.3849 1.33325 12.7066 1.33325 11.9993V5.33268C1.33325 4.62544 1.6142 3.94716 2.1143 3.44706C2.6144 2.94697 3.29267 2.66602 3.99992 2.66602ZM3.99992 3.99935C3.6463 3.99935 3.30716 4.13982 3.05711 4.38987C2.80706 4.63992 2.66659 4.97906 2.66659 5.33268V11.9993C2.66659 12.353 2.80706 12.6921 3.05711 12.9422C3.30716 13.1922 3.6463 13.3327 3.99992 13.3327H11.9999C12.3535 13.3327 12.6927 13.1922 12.9427 12.9422C13.1928 12.6921 13.3333 12.353 13.3333 11.9993V5.33268C13.3333 4.97906 13.1928 4.63992 12.9427 4.38987C12.6927 4.13982 12.3535 3.99935 11.9999 3.99935H3.99992Z"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M2 6.66634C2 6.48953 2.07024 6.31996 2.19526 6.19494C2.32029 6.06991 2.48986 5.99967 2.66667 5.99967H13.3333C13.5101 5.99967 13.6797 6.06991 13.8047 6.19494C13.9298 6.31996 14 6.48953 14 6.66634C14 6.84315 13.9298 7.01272 13.8047 7.13775C13.6797 7.26277 13.5101 7.33301 13.3333 7.33301H2.66667C2.48986 7.33301 2.32029 7.26277 2.19526 7.13775C2.07024 7.01272 2 6.84315 2 6.66634ZM5.33333 1.33301C5.51014 1.33301 5.67971 1.40325 5.80474 1.52827C5.92976 1.65329 6 1.82286 6 1.99967V4.66634C6 4.84315 5.92976 5.01272 5.80474 5.13775C5.67971 5.26277 5.51014 5.33301 5.33333 5.33301C5.15652 5.33301 4.98695 5.26277 4.86193 5.13775C4.7369 5.01272 4.66667 4.84315 4.66667 4.66634V1.99967C4.66667 1.82286 4.7369 1.65329 4.86193 1.52827C4.98695 1.40325 5.15652 1.33301 5.33333 1.33301ZM10.6667 1.33301C10.8435 1.33301 11.013 1.40325 11.1381 1.52827C11.2631 1.65329 11.3333 1.82286 11.3333 1.99967V4.66634C11.3333 4.84315 11.2631 5.01272 11.1381 5.13775C11.013 5.26277 10.8435 5.33301 10.6667 5.33301C10.4899 5.33301 10.3203 5.26277 10.1953 5.13775C10.0702 5.01272 10 4.84315 10 4.66634V1.99967C10 1.82286 10.0702 1.65329 10.1953 1.52827C10.3203 1.40325 10.4899 1.33301 10.6667 1.33301Z" />
          <path d="M5.33333 8.66667C5.33333 8.84348 5.2631 9.01305 5.13807 9.13807C5.01305 9.2631 4.84348 9.33333 4.66667 9.33333C4.48986 9.33333 4.32029 9.2631 4.19526 9.13807C4.07024 9.01305 4 8.84348 4 8.66667C4 8.48986 4.07024 8.32029 4.19526 8.19526C4.32029 8.07024 4.48986 8 4.66667 8C4.84348 8 5.01305 8.07024 5.13807 8.19526C5.2631 8.32029 5.33333 8.48986 5.33333 8.66667ZM5.33333 11.3333C5.33333 11.5101 5.2631 11.6797 5.13807 11.8047C5.01305 11.9298 4.84348 12 4.66667 12C4.48986 12 4.32029 11.9298 4.19526 11.8047C4.07024 11.6797 4 11.5101 4 11.3333C4 11.1565 4.07024 10.987 4.19526 10.8619C4.32029 10.7369 4.48986 10.6667 4.66667 10.6667C4.84348 10.6667 5.01305 10.7369 5.13807 10.8619C5.2631 10.987 5.33333 11.1565 5.33333 11.3333ZM8.66667 8.66667C8.66667 8.84348 8.59643 9.01305 8.4714 9.13807C8.34638 9.2631 8.17681 9.33333 8 9.33333C7.82319 9.33333 7.65362 9.2631 7.5286 9.13807C7.40357 9.01305 7.33333 8.84348 7.33333 8.66667C7.33333 8.48986 7.40357 8.32029 7.5286 8.19526C7.65362 8.07024 7.82319 8 8 8C8.17681 8 8.34638 8.07024 8.4714 8.19526C8.59643 8.32029 8.66667 8.48986 8.66667 8.66667ZM8.66667 11.3333C8.66667 11.5101 8.59643 11.6797 8.4714 11.8047C8.34638 11.9298 8.17681 12 8 12C7.82319 12 7.65362 11.9298 7.5286 11.8047C7.40357 11.6797 7.33333 11.5101 7.33333 11.3333C7.33333 11.1565 7.40357 10.987 7.5286 10.8619C7.65362 10.7369 7.82319 10.6667 8 10.6667C8.17681 10.6667 8.34638 10.7369 8.4714 10.8619C8.59643 10.987 8.66667 11.1565 8.66667 11.3333ZM12 8.66667C12 8.84348 11.9298 9.01305 11.8047 9.13807C11.6797 9.2631 11.5101 9.33333 11.3333 9.33333C11.1565 9.33333 10.987 9.2631 10.8619 9.13807C10.7369 9.01305 10.6667 8.84348 10.6667 8.66667C10.6667 8.48986 10.7369 8.32029 10.8619 8.19526C10.987 8.07024 11.1565 8 11.3333 8C11.5101 8 11.6797 8.07024 11.8047 8.19526C11.9298 8.32029 12 8.48986 12 8.66667ZM12 11.3333C12 11.5101 11.9298 11.6797 11.8047 11.8047C11.6797 11.9298 11.5101 12 11.3333 12C11.1565 12 10.987 11.9298 10.8619 11.8047C10.7369 11.6797 10.6667 11.5101 10.6667 11.3333C10.6667 11.1565 10.7369 10.987 10.8619 10.8619C10.987 10.7369 11.1565 10.6667 11.3333 10.6667C11.5101 10.6667 11.6797 10.7369 11.8047 10.8619C11.9298 10.987 12 11.1565 12 11.3333Z" />
        </svg>
        <button class="todayButton active">${day}/${month}</button>
      `;
    } else {
      dateSpan.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M3.99992 2.66602H11.9999C12.7072 2.66602 13.3854 2.94697 13.8855 3.44706C14.3856 3.94716 14.6666 4.62544 14.6666 5.33268V11.9993C14.6666 12.7066 14.3856 13.3849 13.8855 13.885C13.3854 14.3851 12.7072 14.666 11.9999 14.666H3.99992C3.29267 14.666 2.6144 14.3851 2.1143 13.885C1.6142 13.3849 1.33325 12.7066 1.33325 11.9993V5.33268C1.33325 4.62544 1.6142 3.94716 2.1143 3.44706C2.6144 2.94697 3.29267 2.66602 3.99992 2.66602ZM3.99992 3.99935C3.6463 3.99935 3.30716 4.13982 3.05711 4.38987C2.80706 4.63992 2.66659 4.97906 2.66659 5.33268V11.9993C2.66659 12.353 2.80706 12.6921 3.05711 12.9422C3.30716 13.1922 3.6463 13.3327 3.99992 13.3327H11.9999C12.3535 13.3327 12.6927 13.1922 12.9427 12.9422C13.1928 12.6921 13.3333 12.353 13.3333 11.9993V5.33268C13.3333 4.97906 13.1928 4.63992 12.9427 4.38987C12.6927 4.13982 12.3535 3.99935 11.9999 3.99935H3.99992Z"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M2 6.66634C2 6.48953 2.07024 6.31996 2.19526 6.19494C2.32029 6.06991 2.48986 5.99967 2.66667 5.99967H13.3333C13.5101 5.99967 13.6797 6.06991 13.8047 6.19494C13.9298 6.31996 14 6.48953 14 6.66634C14 6.84315 13.9298 7.01272 13.8047 7.13775C13.6797 7.26277 13.5101 7.33301 13.3333 7.33301H2.66667C2.48986 7.33301 2.32029 7.26277 2.19526 7.13775C2.07024 7.01272 2 6.84315 2 6.66634ZM5.33333 1.33301C5.51014 1.33301 5.67971 1.40325 5.80474 1.52827C5.92976 1.65329 6 1.82286 6 1.99967V4.66634C6 4.84315 5.92976 5.01272 5.80474 5.13775C5.67971 5.26277 5.51014 5.33301 5.33333 5.33301C5.15652 5.33301 4.98695 5.26277 4.86193 5.13775C4.7369 5.01272 4.66667 4.84315 4.66667 4.66634V1.99967C4.66667 1.82286 4.7369 1.65329 4.86193 1.52827C4.98695 1.40325 5.15652 1.33301 5.33333 1.33301ZM10.6667 1.33301C10.8435 1.33301 11.013 1.40325 11.1381 1.52827C11.2631 1.65329 11.3333 1.82286 11.3333 1.99967V4.66634C11.3333 4.84315 11.2631 5.01272 11.1381 5.13775C11.013 5.26277 10.8435 5.33301 10.6667 5.33301C10.4899 5.33301 10.3203 5.26277 10.1953 5.13775C10.0702 5.01272 10 4.84315 10 4.66634V1.99967C10 1.82286 10.0702 1.65329 10.1953 1.52827C10.3203 1.40325 10.4899 1.33301 10.6667 1.33301Z" />
          <path d="M5.33333 8.66667C5.33333 8.84348 5.2631 9.01305 5.13807 9.13807C5.01305 9.2631 4.84348 9.33333 4.66667 9.33333C4.48986 9.33333 4.32029 9.2631 4.19526 9.13807C4.07024 9.01305 4 8.84348 4 8.66667C4 8.48986 4.07024 8.32029 4.19526 8.19526C4.32029 8.07024 4.48986 8 4.66667 8C4.84348 8 5.01305 8.07024 5.13807 8.19526C5.2631 8.32029 5.33333 8.48986 5.33333 8.66667ZM5.33333 11.3333C5.33333 11.5101 5.2631 11.6797 5.13807 11.8047C5.01305 11.9298 4.84348 12 4.66667 12C4.48986 12 4.32029 11.9298 4.19526 11.8047C4.07024 11.6797 4 11.5101 4 11.3333C4 11.1565 4.07024 10.987 4.19526 10.8619C4.32029 10.7369 4.48986 10.6667 4.66667 10.6667C4.84348 10.6667 5.01305 10.7369 5.13807 10.8619C5.2631 10.987 5.33333 11.1565 5.33333 11.3333ZM8.66667 8.66667C8.66667 8.84348 8.59643 9.01305 8.4714 9.13807C8.34638 9.2631 8.17681 9.33333 8 9.33333C7.82319 9.33333 7.65362 9.2631 7.5286 9.13807C7.40357 9.01305 7.33333 8.84348 7.33333 8.66667C7.33333 8.48986 7.40357 8.32029 7.5286 8.19526C7.65362 8.07024 7.82319 8 8 8C8.17681 8 8.34638 8.07024 8.4714 8.19526C8.59643 8.32029 8.66667 8.48986 8.66667 8.66667ZM8.66667 11.3333C8.66667 11.5101 8.59643 11.6797 8.4714 11.8047C8.34638 11.9298 8.17681 12 8 12C7.82319 12 7.65362 11.9298 7.5286 11.8047C7.40357 11.6797 7.33333 11.5101 7.33333 11.3333C7.33333 11.1565 7.40357 10.987 7.5286 10.8619C7.65362 10.7369 7.82319 10.6667 8 10.6667C8.17681 10.6667 8.34638 10.7369 8.4714 10.8619C8.59643 10.987 8.66667 11.1565 8.66667 11.3333ZM12 8.66667C12 8.84348 11.9298 9.01305 11.8047 9.13807C11.6797 9.2631 11.5101 9.33333 11.3333 9.33333C11.1565 9.33333 10.987 9.2631 10.8619 9.13807C10.7369 9.01305 10.6667 8.84348 10.6667 8.66667C10.6667 8.48986 10.7369 8.32029 10.8619 8.19526C10.987 8.07024 11.1565 8 11.3333 8C11.5101 8 11.6797 8.07024 11.8047 8.19526C11.9298 8.32029 12 8.48986 12 8.66667ZM12 11.3333C12 11.5101 11.9298 11.6797 11.8047 11.8047C11.6797 11.9298 11.5101 12 11.3333 12C11.1565 12 10.987 11.9298 10.8619 11.8047C10.7369 11.6797 10.6667 11.5101 10.6667 11.3333C10.6667 11.1565 10.7369 10.987 10.8619 10.8619C10.987 10.7369 11.1565 10.6667 11.3333 10.6667C11.5101 10.6667 11.6797 10.7369 11.8047 10.8619C11.9298 10.987 12 11.1565 12 11.3333Z" />
        </svg>
        <button class="todayButton">${day}/${month}</button>
      `;
    }
  }
  
  // Обновляем обработчики навигации
  if (hasPrev) {
    prevDayBtn.onclick = () => {
      console.log('[DATE] Previous day clicked');
      const newDate = new Date(currentDate * 1000);
      newDate.setDate(newDate.getDate() - 1);
      const newTimestamp = Math.floor(newDate.getTime() / 1000);
      if (newTimestamp >= minAvailableDate) {
        changeGlobalDate(newTimestamp);
      }
    };
  } else {
    prevDayBtn.onclick = null;
  }
  
  if (hasNext) {
    nextDayBtn.onclick = () => {
      console.log('[DATE] Next day clicked');
      const newDate = new Date(currentDate * 1000);
      newDate.setDate(newDate.getDate() + 1);
      const newTimestamp = Math.floor(newDate.getTime() / 1000);
      if (newTimestamp <= maxAvailableDate) {
        changeGlobalDate(newTimestamp);
      }
    };
  } else {
    nextDayBtn.onclick = null;
  }
  
  // Обновляем обработчик кнопки Today
  const todayButton = dateSpan?.querySelector('.todayButton');
  if (todayButton) {
    todayButton.onclick = () => {
      console.log('[DATE] Today clicked');
      const todayTimestamp = getTodayTimestamp();
      if (currentDate !== todayTimestamp && hasAnyMatchesOnDate(todayTimestamp)) {
        changeGlobalDate(todayTimestamp);
      }
    };
  }
}

function canGoPrev() {
  if (!minAvailableDate) return false;
  const prevDate = new Date(currentDate * 1000);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevTimestamp = Math.floor(prevDate.getTime() / 1000);
  return prevTimestamp >= minAvailableDate;
}

function canGoNext() {
  if (!maxAvailableDate) return false;
  const nextDate = new Date(currentDate * 1000);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextTimestamp = Math.floor(nextDate.getTime() / 1000);
  return nextTimestamp <= maxAvailableDate;
}

// Функция смены общей даты
async function changeGlobalDate(newTimestamp) {
  showMatchesLoader();
  try {
  console.log(`[DATE] Changing global date to ${new Date(newTimestamp * 1000).toISOString()}`);
  isGlobalDateUpdating = true;
  currentDate = normalizeDayTimestamp(newTimestamp);
  
  // Обновляем отображение datePicker
  updateDatePicker();
  
  for (const sport of SPORTS) {
    // Очищаем старые данные
    if (availableFilters[sport]) {
      availableFilters[sport].leagues.clear();
      availableFilters[sport].countries.clear();
    }
    lastFetchedData[sport] = null;
    
  
    // Для прошедших дат (более 2 дней назад) загружаем результаты
      if (isPastDate(currentDate)) {
        console.log(`[${sport.toUpperCase()}] Date is past, loading results`);
        await loadSportResults(sport);
      } else {
        console.log(`[${sport.toUpperCase()}] Date is today or future, loading upcoming matches`);
        await loadSportMatches(sport);
      }
    }
  
    // Деактивировать/активировать фильтры в зависимости от типа даты
    if (isPastDate(currentDate)) {
      disableSidebarFilters(true);
    } else {
      disableSidebarFilters(false);
    }
  // Обновляем фильтры после полной загрузки всех спортов
  refreshSportList();
  updateResultsCount();
  if (getSelectedSport()) {
    populateFilterOptionsForSport(getSelectedSport());
  }
  await applyFilters(false);
  } finally {
    isGlobalDateUpdating = false;
    hideMatchesLoader();
  }
}

// Загрузка результатов (прошедших матчей)
async function loadSportResults(sport) {
  if (loadingFlags[sport]) {
    console.log(`[${sport.toUpperCase()}] ⏳ Already loading, skipping`);
    return;
  }
  
  loadingFlags[sport] = true;
  const container = document.getElementById(`${sport}Leagues`);
  
  if (!container) {
    console.error(`[${sport.toUpperCase()}] ❌ Container #${sport}Leagues not found!`);
    loadingFlags[sport] = false;
    return;
  }
  
  console.log(`[${sport.toUpperCase()}] Loading results for ${formatDate(currentDate)}`);
  const normalizedDateFrom = normalizeDayTimestamp(currentDate);
  const normalizedDateTo = normalizedDateFrom + 24 * 3600;
  container.innerHTML = `<p>Loading results...</p>`;
  
  try {
    const dateFrom = normalizedDateFrom;
    const dateTo = normalizedDateTo;
    const results = await fetchCompletedMatchesForSport(sport, dateFrom, dateTo);
    console.log(`[${sport.toUpperCase()}] ✅ Получено результатов: ${results.length}`);
    console.log(`[${sport.toUpperCase()}] Results date range: ${new Date(dateFrom * 1000).toISOString()} to ${new Date(dateTo * 1000).toISOString()}`);
    
    if (results.length > 0) {
      console.log(`[${sport.toUpperCase()}] First result:`, results[0]);
      console.log(`[${sport.toUpperCase()}] Result keys:`, Object.keys(results[0]));
      console.log(`[${sport.toUpperCase()}] Tournament info:`, {
        tournamentId: results[0].tournamentId,
        tournamentNameLocalization: results[0].tournamentNameLocalization,
        score: results[0].score,
        opponent1: results[0].opponent1NameLocalization,
        opponent2: results[0].opponent2NameLocalization
      });
    }
    
    updateAvailableFilters(sport, results);
    updateResultsCount();
    if (!isGlobalDateUpdating) refreshSportList();
    refreshSidebarOnDataUpdate(sport);
    
    if (getSelectedSport() === sport) {
      populateFilterOptionsForSport(sport);
    }
    
    if (results.length === 0) {
      const formattedDate = formatDate(currentDate);
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">
        <p>📅 No ${SPORT_NAMES[sport]} results for ${formattedDate}</p>
        <p style="font-size: 14px;">Try selecting another date</p>
      </div>`;
      return;
    }
    
    // Рендерим результаты
    const visibleResults = limitMatchesForDisplay(results, currentDate);
    console.log(`[${sport.toUpperCase()}] Calling renderSport with isResult=true, visible: ${visibleResults.length} / total: ${results.length}`);
    renderSport(sport, visibleResults, container, true);
    console.log(`[${sport.toUpperCase()}] After renderSport, container.innerHTML length:`, container.innerHTML.length);
    
  } catch (e) {
    console.error(`[${sport.toUpperCase()}] ❌ Ошибка загрузки результатов:`, e);
    container.innerHTML = `<p>Error: ${e.message}</p>`;
  } finally {
    loadingFlags[sport] = false;
  }
}

// Загрузка предстоящих матчей
async function loadSportMatches(sport) {
  if (loadingFlags[sport]) {
    console.log(`[${sport.toUpperCase()}] ⏳ Already loading, skipping`);
    return;
  }
  
  loadingFlags[sport] = true;
  const sportId = SPORT_IDS[sport];
  const container = document.getElementById(`${sport}Leagues`);
  
  console.log(`[${sport.toUpperCase()}] Getting container for #${sport}Leagues:`, container);
  console.log(`[${sport.toUpperCase()}] Container classList:`, container?.className);
  console.log(`[${sport.toUpperCase()}] Container style.display:`, container?.style.display);
  console.log(`[${sport.toUpperCase()}] Container computed style:`, container ? window.getComputedStyle(container).display : 'N/A');
  console.log(`[${sport.toUpperCase()}] Container offsetHeight:`, container?.offsetHeight);
  console.log(`[${sport.toUpperCase()}] Container clientHeight:`, container?.clientHeight);
  console.log(`[${sport.toUpperCase()}] Container parent:`, container?.parentElement?.className);
  console.log(`[${sport.toUpperCase()}] Container innerHTML before:`, container?.innerHTML.substring(0, 100));
  
  if (!container) {
    console.error(`[${sport.toUpperCase()}] ❌ Container #${sport}Leagues not found!`);
    loadingFlags[sport] = false;
    return;
  }
  
  const timestamp = currentDate;
  const dateFrom = normalizeDayTimestamp(timestamp);
  const dateTo = dateFrom + 24 * 3600;
  const cacheKey = buildCacheKey('events', { sportId, dateFrom, dateTo });
  
  console.log(`[${sport.toUpperCase()}] Loading matches for ${formatDate(timestamp)}`);
  container.innerHTML = `<p>Loading...</p>`;
  console.log(`[${sport.toUpperCase()}] After "Loading..." - innerHTML length:`, container.innerHTML.length);
  
  try {
    const url = `/api/events?sportId=${sportId}&gtStart=${dateFrom}&ltStart=${dateTo}`;
    console.log(`[${sport.toUpperCase()}] 🔄 Fetching: ${url}`);

    const data = await getCachedOrFetch(cacheKey, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
    
    let events = [];
    if (data.items && Array.isArray(data.items)) {
      events = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      events = data.data;
    } else if (Array.isArray(data)) {
      events = data;
    }

    events = events.filter(event => !isExcludedFutureLeague(event));
    
    console.log(`[${sport.toUpperCase()}] ✅ Получено событий: ${events.length}`);
    
    events.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    
    updateAvailableFilters(sport, events);
    updateResultsCount();
    if (!isGlobalDateUpdating) refreshSportList();
    refreshSidebarOnDataUpdate(sport);
    
    if (getSelectedSport() === sport) {
      populateFilterOptionsForSport(sport);
    }
    
    // Рендерим предстоящие матчи
    console.log(`[${sport.toUpperCase()}] About to call renderSport, container.innerHTML BEFORE:`, container.innerHTML.substring(0, 50));
    renderSport(sport, events, container, false);
    console.log(`[${sport.toUpperCase()}] renderSport returned, container.innerHTML AFTER:`, container.innerHTML.substring(0, 200));
    console.log(`[${sport.toUpperCase()}] container.children count:`, container.children.length);
    
  } catch (e) {
    console.error(`[${sport.toUpperCase()}] ❌ Ошибка загрузки:`, e);
    container.innerHTML = `<p>Error: ${e.message}</p>`;
  } finally {
    loadingFlags[sport] = false;
  }
}

// Универсальная функция рендеринга
function renderSport(sportName, events, container, isResult = false) {
  console.log(`[RENDER] render${sportName} called with ${events?.length || 0} events, isResult: ${isResult}`);
  console.log(`[RENDER] Container before clear:`, container ? 'EXISTS' : 'NULL', container?.innerHTML.length);
  
  if (!container) {
    console.error(`[RENDER] ${sportName} container is null!`);
    return;
  }
  
  container.innerHTML = "";
  console.log(`[RENDER] After clear, container.innerHTML:`, container.innerHTML);
  
  if (!events || events.length === 0) {
    console.warn(`[RENDER] No events to render for ${sportName}`);
    return;
  }
  
  console.log(`[RENDER] Starting render for ${events.length} events`);
  const sortedEvents = [...events].sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
  const eventsToRender = sortedEvents;
  
  const tournamentsMap = {};
  let fallbackTournamentCounter = 0;
  eventsToRender.forEach((event) => {
    const tournamentId = event.tournamentId || event.tournament?.id || event.tournament?.tournamentId;
    const tournamentName = event.tournamentNameLocalization || event.tournament?.name || SPORT_NAMES[sportName.toLowerCase()];
    const country = event.matchInfoObject?.locationCountry || '';
    
    // В результатах API может не вернуть tournamentId: группируем такие матчи в fallback-лигу,
    // чтобы не терять их в выдаче.
    const safeTournamentId = tournamentId || `fallback-${sportName}-${currentDate}-${fallbackTournamentCounter++}`;
    const safeTournamentName = tournamentId ? tournamentName : `${SPORT_NAMES[sportName.toLowerCase()]} Results`;
    
    if (!tournamentsMap[safeTournamentId]) {
      tournamentsMap[safeTournamentId] = { 
        tournament: { 
          id: safeTournamentId,
          name: safeTournamentName,
          country: country,
          logo: event.tournamentImage || null
        }, 
        events: [] 
      };
    }
    tournamentsMap[safeTournamentId].events.push(event);
  });
  
  const selectedSport = getSelectedSport();
  const sportSelected = selectedSport === sportName.toLowerCase();
  const allSportsSelected = selectedSport === '';
  const canShowAllLeagues = hasExplicitSportSelection && (allSportsSelected || sportSelected);
  let tournamentEntries = Object.entries(tournamentsMap);
  console.log(`[RENDER] Found ${tournamentEntries.length} tournaments for ${sportName}`);
  
  if (tournamentEntries.length === 0) {
    console.warn(`[RENDER] No tournaments found in tournamentsMap for ${sportName}`);
    return;
  }
  
  tournamentEntries.sort((a, b) => a[1].tournament.name.localeCompare(b[1].tournament.name));
  
  if (!canShowAllLeagues) {
    tournamentEntries = tournamentEntries.slice(0, 3);
  }
  
  let leagueCounter = 0;
  tournamentEntries.forEach(([tournamentId, { tournament, events }]) => {
    const sortedEventsInTournament = [...events].sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    
    const leagueEl = document.createElement('div');
    leagueEl.className = isResult ? 'league league--open' : 'league';
    leagueEl.dataset.leagueId = String(tournamentId || '');
    
    const tournamentLogo = tournament.logo ? getTournamentLogo(tournament.logo) : '';

    if (!isResult) {
      leagueEl.innerHTML = `
        <div class="league__header">
          <div class="league__name">
            ${tournamentLogo ? `<img src="${tournamentLogo}" class="league__logo" style="width: 24px; height: 24px; margin-right: 8px;" onerror="this.style.display='none'" alt="">` : ''}
            <span class="league__title">${tournament.name}</span>
            <div class="league__toggle">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M22.5411 17.5411C22.2472 17.8349 21.8486 18 21.4331 18C21.0175 18 20.6189 17.8349 20.325 17.5411L12.5669 9.78308L4.8089 17.5411C4.51331 17.8266 4.11741 17.9846 3.70648 17.981C3.29554 17.9774 2.90245 17.8126 2.61186 17.522C2.32127 17.2314 2.15645 16.8384 2.15287 16.4274C2.1493 16.0165 2.30728 15.6206 2.59277 15.325L11.4589 6.45888C11.7528 6.16506 12.1514 6 12.5669 6C12.9825 6 13.3811 6.16506 13.675 6.45888L22.5411 15.325C22.8349 15.6189 23 16.0175 23 16.4331C23 16.8486 22.8349 17.2472 22.5411 17.5411Z" fill="#A2A2A2"/>
              </svg>
            </div>
          </div>
          <div class="league__description">
            <div class="league__sport">${SPORT_NAMES[sportName.toLowerCase()]}</div>
            <div class="league__country">${tournament.country || ''}</div>
          </div>
        </div>
      `;
    } else {
      leagueEl.innerHTML = `
        <div class="league__header">
        <div class="league__description">
          <div class="league__sport">${SPORT_NAMES[sportName.toLowerCase()]}</div>
          <div class="league__country">${tournament.country || ''}</div>
        </div>
        </div>
      `;
    }
    
    const matchesEl = document.createElement('div');
    matchesEl.className = 'league__matches';
    
    sortedEventsInTournament.forEach(event => {
      const { isLive, isFinished, statusText } = getMatchStatus(event, isResult);
      
      const matchEl = document.createElement('div');
      matchEl.className = 'match';
      
      const infoEl = document.createElement('div');
      infoEl.className = 'match__info';
      
      const timeEl = document.createElement('div');
      timeEl.className = 'match__time';
      if (event.startDate) {
        // Для прошедших матчей показываем время начала
        if (isResult) {
          const matchDate = new Date(event.startDate * 1000);
          timeEl.textContent = matchDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } else {
          timeEl.textContent = formatTime(event.startDate);
        }
      } else {
        timeEl.textContent = '--:--';
      }
      infoEl.appendChild(timeEl);
      
      const timingEl = document.createElement('div');
      timingEl.className = 'match__timing';
      if (isLive) {
        timingEl.classList.add('match__timing--active');
        timingEl.textContent = statusText;
      } else if (isFinished || isResult) {
        timingEl.classList.add('match__timing--finished');
        timingEl.textContent = 'FT';
      } else {
        timingEl.textContent = statusText;
      }
      infoEl.appendChild(timingEl);
      
      const teamsEl = document.createElement('div');
      teamsEl.className = 'match__teams';
      
      const homeTeamName = event.opponent1NameLocalization || 'Home';
      const awayTeamName = event.opponent2NameLocalization || 'Away';
      
      const homeLogo = event.imageOpponent1 ? getTeamLogo(event.imageOpponent1) : '';
      const awayLogo = event.imageOpponent2 ? getTeamLogo(event.imageOpponent2) : '';
      
      teamsEl.innerHTML = `
        <div class="match__team match__team--home">
          ${homeLogo ? `<img src="${homeLogo}" class="match__team-logo" style="width: 24px; height: 24px; margin-right: 8px;" onerror="this.style.display='none'" alt="">` : '<div class="match__team-placeholder" style="width: 24px; height: 24px; margin-right: 8px;"></div>'}
          <span>${homeTeamName}</span>
        </div>
        <div class="match__team match__team--away">
          ${awayLogo ? `<img src="${awayLogo}" class="match__team-logo" style="width: 24px; height: 24px; margin-right: 8px;" onerror="this.style.display='none'" alt="">` : '<div class="match__team-placeholder" style="width: 24px; height: 24px; margin-right: 8px;"></div>'}
          <span>${awayTeamName}</span>
        </div>
      `;
      
      const scoreEl = document.createElement('div');
      scoreEl.className = 'match__score';
      if (isLive) scoreEl.classList.add('match__score--active');
      if (isFinished || isResult) scoreEl.classList.add('match__score--finished');
      
      let homeScore = '';
      let awayScore = '';
      
      if (isResult) {
        const parsed = parseResultScore(event);
        homeScore = parsed.homeScore;
        awayScore = parsed.awayScore;
        
        // Если счет не удалось распарсить, но есть строка score - показываем её
        if (!homeScore && !awayScore && event.score && typeof event.score === 'string') {
          const mainScoreMatch = event.score.match(/^(\d+)\s*[:\-–—]\s*(\d+)/);
          if (mainScoreMatch) {
            homeScore = mainScoreMatch[1];
            awayScore = mainScoreMatch[2];
          } else {
            // Если не удалось извлечь основной счет, показываем полную строку
            scoreEl.innerHTML = `<div class="match__score-full">${event.score}</div>`;
            matchEl.appendChild(infoEl);
            matchEl.appendChild(teamsEl);
            matchEl.appendChild(scoreEl);
            matchesEl.appendChild(matchEl);
            return;
          }
        }
      }
      
      scoreEl.innerHTML = `
        <div class="match__score-home">${homeScore}</div>
        <div class="match__score-away">${awayScore}</div>
      `;
      
      const digitsEl = document.createElement('div');
      digitsEl.className = 'match__digits';
      
      if (!isLive && !isFinished && !isResult) {
        digitsEl.innerHTML += `
          <div class="match__banner">
            The best bet <img src="images/vivabet.svg">
          </div>
        `;
      }
      
      matchEl.appendChild(infoEl);
      matchEl.appendChild(teamsEl);
      matchEl.appendChild(scoreEl);
      matchEl.appendChild(digitsEl);
      
      matchesEl.appendChild(matchEl);
    });
    
    leagueEl.appendChild(matchesEl);
    container.appendChild(leagueEl);
    
    console.log(`[RENDER] Added league #${leagueCounter} for ${sportName}, container.innerHTML length now: ${container.innerHTML.length}`);
    
    if (leagueCounter === 2) {
      insertNewsAfterLeague(leagueEl, container);
    }
    leagueCounter++;
  });
  
  console.log(`[RENDER] Rendered ${leagueCounter} leagues for ${sportName}`);
  console.log(`[RENDER] Final container.innerHTML length: ${container.innerHTML.length}`);
  console.log(`[RENDER] Final container.children.length: ${container.children.length}`);
  console.log(`[RENDER] Container is visible? display:`, container.style.display, 'visible:', container.offsetHeight > 0);
  console.log(`[RENDER] First 200 chars of final innerHTML:`, container.innerHTML.substring(0, 200));
  
  // ПРОВЕРКА: убедимся, что контейнер действительно в DOM
  if (!document.contains(container)) {
    console.error(`[RENDER] ❌ CRITICAL: Container for ${sportName} is NOT in DOM!`);
  } else {
    console.log(`[RENDER] ✓ Container for ${sportName} is in DOM`);
  }
  
  if (leagueCounter > 0 && leagueCounter < 3) {
    insertNewsAfterLeague(null, container);
  }
}

// Функции для фильтров
function updateAvailableFilters(sport, events) {
  if (!availableFilters[sport]) {
    availableFilters[sport] = { leagues: new Map(), countries: new Set() };
  }
  const store = availableFilters[sport];
  store.leagues.clear();
  store.countries.clear();
  
  events.forEach(event => {
    const leagueId = event.tournamentId;
    const leagueName = event.tournamentNameLocalization || SPORT_NAMES[sport];
    const country = event.matchInfoObject?.locationCountry || '';
    
    if (leagueId) {
      store.leagues.set(String(leagueId), { 
        id: leagueId, 
        name: leagueName, 
        country: country 
      });
    }
    if (country) {
      store.countries.add(country);
    }
  });
  
  lastFetchedData[sport] = events;
}

function refreshSportList(preferredSport = getSelectedSport()) {
  const sportList = document.getElementById('filterSportList');
  if (!sportList) return;
  
  sportList.innerHTML = '';

  const visibleSports = SPORTS.filter((sport) => hasSportResultsData(sport));
  const selectedSport = visibleSports.includes(preferredSport) ? preferredSport : '';
  const allSportsText = getI18nText('filters.allSports', 'All Sports');

  const allLabel = document.createElement('label');
  allLabel.className = 'filters__item';
  allLabel.innerHTML = `<input type="radio" name="filterSport" value="" id="filterSport-all" ${selectedSport ? '' : 'checked'}> <span>${allSportsText}</span>`;
  sportList.appendChild(allLabel);

  visibleSports.forEach(s => {
    const id = `filterSport-${s}`;
    const label = document.createElement('label');
    label.className = 'filters__item';
    const fallbackSportName = SPORT_NAMES[s] || (s.charAt(0).toUpperCase() + s.slice(1));
    const sportText = getI18nText(`sidebar.${s}`, fallbackSportName);
    label.innerHTML = `<input type="radio" name="filterSport" value="${s}" id="${id}" ${selectedSport === s ? 'checked' : ''}> <span>${sportText}</span>`;
    sportList.appendChild(label);
  });
  
  // Добавляем обработчики событий для радиокнопок
  const sportRadios = sportList.querySelectorAll('input[name="filterSport"]');
  sportRadios.forEach(r => r.addEventListener('change', async (e) => {
    const sport = e.target.value;
    hasExplicitSportSelection = true;
    const countryBlock = document.getElementById('filterCountryBlock');
    const leagueBlock = document.getElementById('filterLeagueBlock');
    const countryList = document.getElementById('filterCountryList');

    console.log(`[FILTER] Sport changed to: ${sport || 'all'}`);

    if (sport === 'football') {
      if (countryBlock) countryBlock.style.display = 'flex';
    } else {
      if (countryBlock) countryBlock.style.display = 'none';
      if (countryList) countryList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
    if (leagueBlock) leagueBlock.style.display = sport ? 'flex' : 'none';

    if (sport) {
      // Ленивая подгрузка данных для отображения списков лиг/стран
      if (!availableFilters[sport] || availableFilters[sport].leagues.size === 0) {
        const leagueList = document.getElementById('filterLeagueList');
        if (leagueList) leagueList.innerHTML = `<div class="filters__note">${getI18nText('matches.loading', 'Loading...')}</div>`;
        if (countryList) countryList.innerHTML = '';
        try {
          if (isPastDate(currentDate)) {
            await loadSportResults(sport);
          } else {
            await loadSportMatches(sport);
          }
        } catch (e) {
          console.warn(`[FILTER] Lazy load for filter failed (${sport}):`, e);
        }
      }
      populateFilterOptionsForSport(sport);
    } else {
      const leagueList = document.getElementById('filterLeagueList');
      if (countryList) countryList.innerHTML = '';
      if (leagueList) leagueList.innerHTML = '';
    }
    updateResultsCount();
  }));
}

function populateFilterOptionsForSport(sport) {
  const countryList = document.getElementById('filterCountryList');
  const leagueList = document.getElementById('filterLeagueList');
  
  console.log(`[FILTER] Populating filters for ${sport}`);
  
  if (!availableFilters[sport]) {
    console.log(`[FILTER] No filters available for ${sport}`);
    if (countryList) countryList.innerHTML = '';
    if (leagueList) leagueList.innerHTML = '';
    return;
  }
  
  if (sport === 'football') {
    const countries = Array.from(availableFilters[sport].countries).sort();
    console.log(`[FILTER] Countries for ${sport}:`, countries);
    if (countryList) {
      countryList.innerHTML = countries.length ? countries.map(c => `
        <label class="filters__item">
          <input type="checkbox" value="${c}">
          <span>${c}</span>
        </label>
      `).join('') : `<div class="filters__note">${getI18nText('filters.noCountries', 'No countries')}</div>`;
    }
  } else {
    if (countryList) countryList.innerHTML = '';
  }
  
  if (leagueList) {
    const leagues = Array.from(availableFilters[sport].leagues.values()).sort((a,b) => a.name.localeCompare(b.name));
    console.log(`[FILTER] Leagues for ${sport}:`, leagues.length);
    leagueList.innerHTML = leagues.length ? leagues.map(l => `
      <label class="filters__item">
        <input type="checkbox" value="${l.id}" data-country="${l.country || ''}">
        <span>${l.name}${l.country ? ' — ' + l.country : ''}</span>
      </label>
    `).join('') : `<div class="filters__note">${getI18nText('filters.noLeagues', 'No leagues')}</div>`;
  }
  
  try { filterLeaguesBySelectedCountries(sport); } catch (e) { /* no-op */ }
}

function filterLeaguesBySelectedCountries(sport) {
  const leagueList = document.getElementById('filterLeagueList');
  const countryChecks = Array.from(document.querySelectorAll('#filterCountryList input[type="checkbox"]:checked')).map(i => i.value);
  
  if (!leagueList) return;
  
  const labels = Array.from(leagueList.querySelectorAll('label'));
  
  if (countryChecks.length === 0) {
    labels.forEach(lbl => lbl.style.display = '');
    return;
  }
  
  labels.forEach(lbl => {
    const cb = lbl.querySelector('input[type="checkbox"]');
    const leagueCountry = cb?.getAttribute('data-country') || '';
    if (!leagueCountry || countryChecks.includes(leagueCountry)) {
      lbl.style.display = '';
    } else {
      lbl.style.display = 'none';
      if (cb) cb.checked = false;
    }
  });
}

function getSelectedSport() {
  const checked = document.querySelector('input[name="filterSport"]:checked');
  return checked ? checked.value : null;
}

function getI18nText(key, fallback, vars = {}) {
  let text = null;
  try {
    if (typeof window.getText === 'function') {
      text = window.getText(key, vars);
    }
  } catch (_e) {
    text = null;
  }

  if (text === null || text === undefined || text === '') {
    text = fallback;
  }

  return String(text).replace(/\{(\w+)\}/g, (_m, token) => {
    return vars[token] !== undefined ? String(vars[token]) : `{${token}}`;
  });
}

function updateResultsCount() {
  const resultsBtn = document.querySelector('.filter__results');
  if (!resultsBtn) return;
  
  const hasSportSelection = Boolean(document.querySelector('input[name="filterSport"]:checked'));
  const sport = getSelectedSport();
  const countryChecks = Array.from(document.querySelectorAll('#filterCountryList input[type="checkbox"]:checked'));
  const leagueChecks = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked'));
  const anySelection = hasSportSelection || countryChecks.length > 0 || leagueChecks.length > 0;
  
  if (!anySelection) {
    resultsBtn.style.display = 'none';
    return;
  } else {
    resultsBtn.style.display = '';
  }
  
  let count = 0;
  
  if (!sport) {
    count = SPORTS.reduce((sum, sportName) => {
      const arr = lastFetchedData[sportName] || [];
      return sum + limitMatchesForDisplay(arr, currentDate).length;
    }, 0);
    resultsBtn.textContent = getI18nText('filter.showResults', 'Show {count} results', { count });
    return;
  } else if (sport === 'football') {
    const data = lastFetchedData.football || [];
    let matches = data;
    const countryChecksVals = countryChecks.map(i => i.value);
    const leagueIds = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked')).map(i => i.value);
    if (countryChecksVals.length) matches = matches.filter(m => countryChecksVals.includes(m.matchInfoObject?.locationCountry));
    if (leagueIds.length) matches = matches.filter(m => leagueIds.includes(String(m.tournamentId)));
    count = limitMatchesForDisplay(matches, currentDate).length;
  } else {
    const arr = lastFetchedData[sport] || [];
    const leagueIds = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked')).map(i => i.value);
    let matches = arr;
    if (leagueIds.length) {
      matches = arr.filter(m => leagueIds.includes(String(m.tournamentId)));
    }
    count = limitMatchesForDisplay(matches, currentDate).length;
  }
  
  resultsBtn.textContent = getI18nText('filter.showResults', 'Show {count} results', { count });
}

async function applyFilters(close = true) {
  hasExplicitSportSelection = true;
  const sport = getSelectedSport();
  const filtersEl = document.querySelector('.filters');
  const filtersBlock = document.querySelector('.filters__content');
  if (close && filtersEl && filtersBlock) filtersBlock.classList.remove('filters__content--active');

  syncSidebarFromMainFilters();
  
  // Ленивая загрузка: если данные для выбранного спорта ещё не загружены — грузим сейчас
  if (sport && !lastFetchedData[sport] && !loadingFlags[sport]) {
    console.log(`[FILTER] Lazy loading ${sport} (id=${SPORT_IDS[sport]})...`);
    try {
      showMatchesLoader();
      if (isPastDate(currentDate)) {
        await loadSportResults(sport);
      } else {
        await loadSportMatches(sport);
      }
    } catch (e) {
      console.warn(`[FILTER] Lazy load failed for ${sport}:`, e);
    } finally {
      hideMatchesLoader();
    }
  }

  const containers = SPORTS.map(s => `${s}Leagues`);
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  
  if (!sport) {
    SPORTS.forEach((sportName) => {
      const containerEl = document.getElementById(`${sportName}Leagues`);
      if (!containerEl) return;

      containerEl.style.display = '';
      const data = lastFetchedData[sportName] || [];
      renderSport(sportName, limitMatchesForDisplay(data, currentDate), containerEl, isPastDate(currentDate));
    });
    try {
      removeInlineNews();
      const footballContainer = document.getElementById('footballLeagues');
      insertNewsAfterLeague(null, footballContainer);
    } catch(e) { /* no-op */ }
    return;
  }
  
  const containerId = `${sport}Leagues`;
  const container = document.getElementById(containerId);
  if (container) container.style.display = '';
  
  console.log(`[FILTER] Applying filters for ${sport}`);
  
  if (sport === 'football') {
    const data = lastFetchedData.football || [];
    let matches = data;
    const countryChecks = Array.from(document.querySelectorAll('#filterCountryList input[type="checkbox"]:checked')).map(i => i.value);
    const leagueIds = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked')).map(i => i.value);
    if (countryChecks.length) matches = matches.filter(m => countryChecks.includes(m.matchInfoObject?.locationCountry));
    if (leagueIds.length) matches = matches.filter(m => leagueIds.includes(String(m.tournamentId)));
    console.log(`[FILTER] Football filtered: ${matches.length} from ${data.length}`);
    renderSport(sport, limitMatchesForDisplay(matches, currentDate), container, isPastDate(currentDate));
  } else {
    const data = lastFetchedData[sport] || [];
    const leagueIds = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked')).map(i => i.value);
    const filtered = leagueIds.length ? data.filter(m => leagueIds.includes(String(m.tournamentId))) : data;
    console.log(`[FILTER] ${sport} filtered: ${filtered.length} from ${data.length}`);
    renderSport(sport, limitMatchesForDisplay(filtered, currentDate), container, isPastDate(currentDate));
  }
  
  try {
    removeInlineNews();
    if (container) {
      const leagues = container.querySelectorAll('.league');
      const lastLeague = leagues.length ? leagues[leagues.length - 1] : null;
      insertNewsAfterLeague(lastLeague, container);
    }
  } catch (e) {
    console.warn('failed to insert news after filtering', e);
  }
}

function removeInlineNews() {
  try {
    const clones = Array.from(document.querySelectorAll('.news--inline'));
    clones.forEach(n => n.remove());
    const original = document.getElementById('newsContainer');
    if (original) {
      original.style.display = '';
      original.dataset.visible = 'true';
    }
  } catch (e) {
    console.warn('removeInlineNews error', e);
  }
}

function insertNewsAfterLeague(leagueEl, container) {
  try {
    const newsEl = document.getElementById('newsContainer');
    if (!newsEl) return;

    // Keep a single news block and move it under the active sport block.
    removeInlineNews();

    const targetContainer = container || leagueEl?.closest('.league') || null;
    const targetId = targetContainer?.id || '';

    // On initial page load keep news under football only.
    if (!hasExplicitSportSelection && targetId && targetId !== 'footballLeagues') {
      newsEl.style.display = '';
      newsEl.dataset.visible = 'true';
      return;
    }

    if (targetContainer && targetContainer.parentNode) {
      targetContainer.parentNode.insertBefore(newsEl, targetContainer.nextSibling);
    }

    newsEl.style.display = '';
    newsEl.dataset.visible = 'true';
  } catch (e) {
    console.warn('insertNewsAfterLeague error', e);
  }
}

function initFilters() {
  console.log('[INIT] initFilters called');
  const resultsBtn = document.querySelector('.filter__results');
  const countryList = document.getElementById('filterCountryList');
  const leagueList = document.getElementById('filterLeagueList');
  
  if (!resultsBtn) {
    console.warn('[INIT] .filter__results button not found');
    return;
  }
  
  refreshSportList();
  
  if (countryList) {
    countryList.addEventListener('change', () => {
      const sport = getSelectedSport();
      filterLeaguesBySelectedCountries(sport);
      updateResultsCount();
    });
  }
  
  if (leagueList) {
    leagueList.addEventListener('change', () => {
      updateResultsCount();
    });
  }
  
  resultsBtn.addEventListener('click', () => {
    applyFilters();
  });

  document.addEventListener('lang:changed', () => {
    refreshSportList();
    updateResultsCount();
  });
  
  updateResultsCount();
  console.log('[INIT] initFilters completed');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSidebarFilterData(sport) {
  const data = Array.isArray(lastFetchedData[sport]) ? lastFetchedData[sport] : [];
  const countries = new Set();
  const leagues = new Map();

  data.forEach((event) => {
    const country = event.matchInfoObject?.locationCountry || '';
    const leagueId = String(event.tournamentId || '');
    const leagueName = event.tournamentNameLocalization || SPORT_NAMES[sport] || 'League';

    if (country) countries.add(country);
    if (!leagueId) return;

    if (!leagues.has(leagueId)) {
      leagues.set(leagueId, {
        id: leagueId,
        name: leagueName,
        country: country || ''
      });
    }
  });

  return {
    data,
    countries: Array.from(countries).sort((a, b) => a.localeCompare(b)),
    leagues: Array.from(leagues.values()).sort((a, b) => a.name.localeCompare(b.name))
  };
}

function renderSidebarCountries(sport, countries) {
  const countryList = document.getElementById('sidebarCountryList');
  if (!countryList) return;

  if (!sport) {
    countryList.innerHTML = '';
    return;
  }

  const allActive = sidebarState.country ? '' : ' sidebar__nav-link--active';
  const allCountriesText = getI18nText('sidebar.allCountries', 'All countries');
  const allRow = `<li><a href="#" class="sidebar-country sidebar__nav-link${allActive}" data-country="">${escapeHtml(allCountriesText)}</a></li>`;
  const rows = countries.map((country) => {
    const active = sidebarState.country === country ? ' sidebar__nav-link--active' : '';
    return `<li><a href="#" class="sidebar-country sidebar__nav-link${active}" data-country="${escapeHtml(country)}">${escapeHtml(country)}</a></li>`;
  }).join('');

  countryList.innerHTML = allRow + rows;
}

function renderSidebarLeagues(sport, leagues) {
  const leagueList = document.getElementById('sidebarLeagueList');
  if (!leagueList) return;

  if (!sport) {
    leagueList.innerHTML = '';
    return;
  }

  const filteredLeagues = sidebarState.country
    ? leagues.filter((l) => (l.country || '') === sidebarState.country)
    : leagues;

  const allLeaguesText = getI18nText('sidebar.allLeagues', 'All leagues');
  const allActive = sidebarState.leagueId ? '' : ' sidebar__nav-link--active';
  const allRow = `<li><a href="#" class="sidebar-league sidebar__nav-link${allActive}" data-league-id="">${escapeHtml(allLeaguesText)}</a></li>`;

  if (filteredLeagues.length === 0) {
    const noLeaguesText = getI18nText('filters.noLeagues', 'No leagues');
    leagueList.innerHTML = `${allRow}<li><span class="sidebar__empty">${escapeHtml(noLeaguesText)}</span></li>`;
    return;
  }

  const rows = filteredLeagues.map((league) => {
    const active = sidebarState.leagueId === league.id ? ' sidebar__nav-link--active' : '';
    const label = league.country ? `${league.name} - ${league.country}` : league.name;
    return `<li><a href="#" class="sidebar-league sidebar__nav-link${active}" data-league-id="${escapeHtml(league.id)}">${escapeHtml(label)}</a></li>`;
  }).join('');

  leagueList.innerHTML = allRow + rows;
}

function renderSidebarTeams(sport, data) {
  const teamList = document.getElementById('sidebarTeamList');
  if (!teamList) return;

  if (!sport) {
    teamList.innerHTML = '';
    return;
  }

  const teams = new Map();
  data.forEach((event) => {
    const tournamentId = String(event.tournamentId || '');
    const country = event.matchInfoObject?.locationCountry || '';
    if (!tournamentId) return;
    if (sidebarState.leagueId && tournamentId !== sidebarState.leagueId) return;
    if (sidebarState.country && country !== sidebarState.country) return;

    const home = event.opponent1NameLocalization || '';
    const away = event.opponent2NameLocalization || '';
    if (home) teams.set(`${tournamentId}::${home}`, { leagueId: tournamentId, name: home });
    if (away) teams.set(`${tournamentId}::${away}`, { leagueId: tournamentId, name: away });
  });

  const sortedTeams = Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (!sortedTeams.length) {
    const noTeamsText = getI18nText('filters.noTeams', 'No teams');
    teamList.innerHTML = `<li><span class="sidebar__empty">${escapeHtml(noTeamsText)}</span></li>`;
    return;
  }

  teamList.innerHTML = sortedTeams.map((team) => {
    const safeTeam = escapeHtml(team.name);
    const safeLeagueId = escapeHtml(team.leagueId);
    return `<li><a href="#" class="sidebar-team sidebar__nav-link" data-team="${safeTeam}" data-league-id="${safeLeagueId}">${safeTeam}</a></li>`;
  }).join('');
}

function syncMainFiltersFromSidebar() {
  if (!sidebarState.sport) return;

  const sportRadio = document.querySelector(`input[name="filterSport"][value="${sidebarState.sport}"]`);
  if (sportRadio) sportRadio.checked = true;

  populateFilterOptionsForSport(sidebarState.sport);

  const countryBlock = document.getElementById('filterCountryBlock');
  const leagueBlock = document.getElementById('filterLeagueBlock');
  if (countryBlock) countryBlock.style.display = (sidebarState.sport === 'football') ? 'flex' : 'none';
  if (leagueBlock) leagueBlock.style.display = 'flex';

  const countryChecks = Array.from(document.querySelectorAll('#filterCountryList input[type="checkbox"]'));
  countryChecks.forEach((cb) => {
    cb.checked = sidebarState.country ? cb.value === sidebarState.country : false;
  });

  filterLeaguesBySelectedCountries(sidebarState.sport);

  const leagueChecks = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]'));
  leagueChecks.forEach((cb) => {
    cb.checked = sidebarState.leagueId ? cb.value === sidebarState.leagueId : false;
  });

  updateResultsCount();
}

function syncSidebarFromMainFilters() {
  const sport = getSelectedSport() || '';
  const selectedCountries = Array.from(document.querySelectorAll('#filterCountryList input[type="checkbox"]:checked')).map((i) => i.value);
  const selectedLeagues = Array.from(document.querySelectorAll('#filterLeagueList input[type="checkbox"]:checked')).map((i) => i.value);

  sidebarState.sport = sport;
  sidebarState.country = selectedCountries.length === 1 ? selectedCountries[0] : '';
  sidebarState.leagueId = selectedLeagues.length === 1 ? selectedLeagues[0] : '';

  document.querySelectorAll('.sidebar-team.sidebar__nav-link--active').forEach((el) => {
    el.classList.remove('sidebar__nav-link--active');
  });

  rebuildSidebarFilters();
}

function rebuildSidebarFilters() {
  const sport = sidebarState.sport;
  if (!sport) {
    renderSidebarCountries('', []);
    renderSidebarLeagues('', []);
    renderSidebarTeams('', []);
    updateSidebarNavItemStateClasses();
    return;
  }

  const { data, countries, leagues } = getSidebarFilterData(sport);

  if (sidebarState.country && !countries.includes(sidebarState.country)) {
    sidebarState.country = '';
  }

  const visibleLeagues = sidebarState.country
    ? leagues.filter((l) => (l.country || '') === sidebarState.country)
    : leagues;

  if (sidebarState.leagueId && !visibleLeagues.some((l) => l.id === sidebarState.leagueId)) {
    sidebarState.leagueId = '';
  }

  renderSidebarCountries(sport, countries);
  renderSidebarLeagues(sport, leagues);
  renderSidebarTeams(sport, data);
  updateSidebarNavItemStateClasses();
}

function updateSidebarNavItemStateClasses() {
  if (typeof window.updateSidebarNavDisabled === 'function') {
    window.updateSidebarNavDisabled();
  }
  const lockFiltersForPastDate = isPastDate(currentDate);
  const sidebarItems = Array.from(document.querySelectorAll('.sidebar .sidebar__nav-item'));
  sidebarItems.forEach((item) => {
    const innerNav = item.querySelector('.sidebar__nav-nav');
    if (!innerNav) return;

    const isFilterSection = ['sidebarCountryList', 'sidebarLeagueList', 'sidebarTeamList'].includes(innerNav.id);
    if (lockFiltersForPastDate && isFilterSection) {
      item.classList.add('sidebar__nav-item--disabled');
      item.classList.remove('sidebar__nav-item--active');
      innerNav.classList.remove('sidebar__nav-nav--active');
      const link = item.querySelector('.sidebar__nav-link');
      if (link) link.setAttribute('aria-disabled', 'true');
      return;
    }

    const hasContent = innerNav.children.length > 0;
    if (hasContent) {
      item.classList.remove('sidebar__nav-item--disabled');
      item.classList.add('sidebar__nav-item--active');
      innerNav.classList.add('sidebar__nav-nav--active');
      const link = item.querySelector('.sidebar__nav-link');
      if (link) link.removeAttribute('aria-disabled');
    } else {
      item.classList.add('sidebar__nav-item--disabled');
      item.classList.remove('sidebar__nav-item--active');
      innerNav.classList.remove('sidebar__nav-nav--active');
      const link = item.querySelector('.sidebar__nav-link');
      if (link) link.setAttribute('aria-disabled', 'true');
    }
  });
}

function hasSportResultsData(sport) {
  return Array.isArray(lastFetchedData[sport]) && lastFetchedData[sport].length > 0;
}

function refreshSidebarSportLinksVisibility() {
  const sportLinks = document.querySelectorAll('.sidebar-sport[data-sport]');
  if (!sportLinks.length) return;

  sportLinks.forEach((link) => {
    const sport = link.dataset.sport;
    const li = link.closest('li');
    const visible = hasSportResultsData(sport);

    if (li) {
      li.style.display = visible ? '' : 'none';
    } else {
      link.style.display = visible ? '' : 'none';
    }

    if (!visible && sidebarState.sport === sport) {
      sidebarState.sport = '';
      sidebarState.country = '';
      sidebarState.leagueId = '';
    }
  });
}


function refreshSidebarOnDataUpdate(sport) {
  refreshSidebarSportLinksVisibility();
  if (sidebarState.sport !== sport) return;
  rebuildSidebarFilters();
}

function disableSidebarFilters(disabled = true) {
  const countryItem = document.querySelector('.sidebar__nav-item:has(#sidebarCountryList)');
  const leagueItem = document.querySelector('.sidebar__nav-item:has(#sidebarLeagueList)');
  const teamItem = document.querySelector('.sidebar__nav-item:has(#sidebarTeamList)');

  const items = [countryItem, leagueItem, teamItem].filter(Boolean);
  
  items.forEach(item => {
    const innerNav = item.querySelector('.sidebar__nav-nav');
    if (disabled) {
      item.classList.add('sidebar__nav-item--disabled');
      item.classList.remove('sidebar__nav-item--active');
      if (innerNav) innerNav.classList.remove('sidebar__nav-nav--active');
    } else {
      item.classList.remove('sidebar__nav-item--disabled');
    }
  });
}
function openLeagueForSelectedSidebarTeam() {
  if (!sidebarState.sport) return;

  const container = document.getElementById(`${sidebarState.sport}Leagues`);
  if (!container) return;

  let leagueEl = null;
  if (sidebarState.leagueId) {
    leagueEl = Array.from(container.querySelectorAll('.league')).find((league) => {
      return String(league.dataset.leagueId || '') === String(sidebarState.leagueId);
    }) || null;
  }

  if (!leagueEl) {
    const teamLink = document.querySelector('.sidebar-team.sidebar__nav-link--active') || document.querySelector('.sidebar-team');
    const teamName = teamLink?.dataset?.team || '';
    if (teamName) {
      leagueEl = Array.from(container.querySelectorAll('.league')).find((league) => {
        return Array.from(league.querySelectorAll('.match__team span')).some((span) => span.textContent?.trim() === teamName);
      }) || null;
    }
  }

  if (!leagueEl) return;

  leagueEl.classList.add('league--open');
  const toggle = leagueEl.querySelector('.league__toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  leagueEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initSidebar() {
  console.log('[INIT] initSidebar called');
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) {
    console.warn('[INIT] .sidebar not found');
    return;
  }
  
  sidebar.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    
    if (a.classList.contains('sidebar-sport') && a.dataset.sport) {
      e.preventDefault();
      hasExplicitSportSelection = true;
      const sport = a.dataset.sport;
      sidebarState.sport = sport;
      sidebarState.country = '';
      sidebarState.leagueId = '';

      rebuildSidebarFilters();
      syncMainFiltersFromSidebar();
      applyFilters(false);
      return;
    }

    if (a.classList.contains('sidebar-country')) {
      e.preventDefault();
      hasExplicitSportSelection = true;
      sidebarState.country = a.dataset.country || '';
      sidebarState.leagueId = '';

      rebuildSidebarFilters();
      syncMainFiltersFromSidebar();
      applyFilters(false);
      return;
    }

    if (a.classList.contains('sidebar-league')) {
      e.preventDefault();
      hasExplicitSportSelection = true;
      sidebarState.leagueId = a.dataset.leagueId || '';

      rebuildSidebarFilters();
      syncMainFiltersFromSidebar();
      applyFilters(false);
      openLeagueForSelectedSidebarTeam();
      return;
    }

    if (a.classList.contains('sidebar-team')) {
      e.preventDefault();
      hasExplicitSportSelection = true;
      if (a.dataset.leagueId) {
        sidebarState.leagueId = a.dataset.leagueId;
      }
      syncMainFiltersFromSidebar();
      applyFilters(false);
      sidebar.querySelectorAll('.sidebar-team.sidebar__nav-link--active').forEach((el) => {
        if (el !== a) el.classList.remove('sidebar__nav-link--active');
      });
      a.classList.add('sidebar__nav-link--active');
      openLeagueForSelectedSidebarTeam();
      return;
    }
  });
  
  // Добавляем динамические виды спорта в сайдбар (которых нет в HTML)
  addDynamicSportsToSidebar();
  refreshSidebarSportLinksVisibility();
  document.addEventListener('lang:changed', () => {
    if (sidebarState.sport) rebuildSidebarFilters();
  });
  
  console.log('[INIT] initSidebar completed');
}

// Добавляет ссылку на вид спорта в сайдбар если её ещё нет
function getSidebarSportIconSvg(slug) {
  switch (slug) {
    case 'tennis':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13.4999 11.2499C14.2956 11.2499 15.0586 11.5659 15.6212 12.1285C16.1839 12.6912 16.4999 13.4542 16.4999 14.2499C16.4999 15.0455 16.1839 15.8086 15.6212 16.3712C15.0586 16.9338 14.2956 17.2499 13.4999 17.2499C12.7043 17.2499 11.9412 16.9338 11.3786 16.3712C10.816 15.8086 10.4999 15.0455 10.4999 14.2499C10.4999 13.4542 10.816 12.6912 11.3786 12.1285C11.9412 11.5659 12.7043 11.2499 13.4999 11.2499ZM13.4999 12.7499C13.1021 12.7499 12.7206 12.9079 12.4393 13.1892C12.158 13.4705 11.9999 13.852 11.9999 14.2499C11.9999 14.6477 12.158 15.0292 12.4393 15.3105C12.7206 15.5918 13.1021 15.7499 13.4999 15.7499C13.8977 15.7499 14.2793 15.5918 14.5606 15.3105C14.8419 15.0292 14.9999 14.6477 14.9999 14.2499C14.9999 13.852 14.8419 13.4705 14.5606 13.1892C14.2793 12.9079 13.8977 12.7499 13.4999 12.7499ZM4.53742 10.9049C4.53742 10.9049 5.59492 9.83986 5.60242 7.72486C5.33242 6.08236 5.97742 4.15486 7.45492 2.68486C9.65242 0.487363 12.8549 0.127363 14.6249 1.87486C16.3724 3.64486 16.0124 6.84736 13.8149 9.04486C12.3449 10.5224 10.4174 11.1674 8.77492 10.8974C6.65992 10.9049 5.59492 11.9624 5.59492 11.9624L2.41492 15.1424L1.35742 14.0849L4.53742 10.9049ZM13.5524 2.94736C12.3749 1.77736 10.1249 2.12986 8.51242 3.74986C6.90742 5.35486 6.54742 7.61236 7.71742 8.78236C8.89492 9.95236 11.1449 9.59236 12.7499 7.98736C14.3699 6.37486 14.7224 4.12486 13.5524 2.94736Z" fill="#525252"/></svg>`;
    case 'basketball':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M8.81241 17.0623C13.058 17.0623 16.4998 13.6205 16.4998 9.37491C16.4998 5.12927 13.058 1.6875 8.81241 1.6875C4.56677 1.6875 1.125 5.12927 1.125 9.37491C1.125 13.6205 4.56677 17.0623 8.81241 17.0623Z" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.2478 14.8096C14.2478 14.8096 12.7087 10.8288 9.74758 7.97242C6.78647 5.11602 2.41504 5.10938 2.41504 5.10938" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.4016 10.9637C12.264 9.10045 14.4406 7.96105 16.313 7.7001" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'football':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16.5 9C16.5 13.1422 13.1422 16.5 9 16.5C4.85775 16.5 1.5 13.1422 1.5 9C1.5 4.85775 4.85775 1.5 9 1.5C13.1422 1.5 16.5 4.85775 16.5 9Z" stroke="#525252"/><path d="M9 6.75V3.75M11.25 8.25L14.25 7.125M10.5 11.25L12 13.5M7.5 10.875L6 12.75M6.75 8.625L3.75 7.875" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'volleyball':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 17.0625C13.2457 17.0625 16.6875 13.6207 16.6875 9.375C16.6875 5.12934 13.2457 1.6875 9 1.6875C4.75434 1.6875 1.3125 5.12934 1.3125 9.375C1.3125 13.6207 4.75434 17.0625 9 17.0625Z" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 1.6875C11.85 4.05 13.65 7.2 13.95 9.75" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.55 5.1C6.15 5.25 9.45 7.35 11.25 10.5" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'cricket':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.1077 5.72116L13.4037 2.0171C12.9663 1.57969 12.257 1.57969 11.8195 2.0171L4.26727 9.56233C3.82986 9.99974 3.82986 10.709 4.26727 11.1465L5.72133 12.6076L2.41664 15.9123C2.31109 16.0178 2.2518 16.161 2.2518 16.3102C2.2518 16.4595 2.31109 16.6026 2.41664 16.7082C2.52219 16.8137 2.66534 16.873 2.81461 16.873C2.96388 16.873 3.10703 16.8137 3.21258 16.7082L6.51727 13.4035L7.97133 14.8576C8.40874 15.295 9.11801 15.295 9.55542 14.8576L17.1077 7.31233C17.5451 6.87492 17.5451 6.16566 17.1077 5.72824V5.72116Z" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'hockey':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13.5 1.5L11.3362 11.7787C11.2612 12.1275 10.9575 12.375 10.6013 12.375H3.375C2.7525 12.375 2.25 12.8775 2.25 13.5V14.0812C2.25 15.3862 3.35625 16.4175 4.66125 16.3237L11.0587 15.8663C12.051 15.7965 12.8888 15.1095 13.0988 14.085L15.75 1.5H13.5Z" stroke="#525252" stroke-miterlimit="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.625 6C7.28185 6 8.625 5.49637 8.625 4.875C8.625 4.25363 7.28185 3.75 5.625 3.75C3.96815 3.75 2.625 4.25363 2.625 4.875C2.625 5.49637 3.96815 6 5.625 6Z" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'esports':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="8" rx="2" stroke="#525252"/><path d="M6 9H8M7 8V10M11.5 8.5H11.51M13 9.5H13.01" stroke="#525252" stroke-linecap="round"/></svg>`;
    case 'handball':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.25" stroke="#525252" stroke-width="1.5"/><path d="M5.4 6.1L9 4.8L12.6 6.1L13.5 9.7L11.1 12.5H6.9L4.5 9.7L5.4 6.1Z" stroke="#525252" stroke-linejoin="round"/><path d="M9 4.8V12.5M5.7 8.2H12.3" stroke="#525252" stroke-linecap="round"/></svg>`;
    case 'baseball':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.25" stroke="#525252" stroke-width="1.5"/><path d="M5.2 4.9C6.9 6.2 7.8 7.5 7.8 9C7.8 10.5 6.9 11.8 5.2 13.1" stroke="#525252" stroke-linecap="round"/><path d="M12.8 4.9C11.1 6.2 10.2 7.5 10.2 9C10.2 10.5 11.1 11.8 12.8 13.1" stroke="#525252" stroke-linecap="round"/></svg>`;
    case 'badminton':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11.9 3.1L14.9 6.1L10 11L7 8L11.9 3.1Z" stroke="#525252" stroke-linejoin="round"/><path d="M6.4 8.6L2.8 12.2" stroke="#525252" stroke-linecap="round"/><path d="M2.2 12.8L3.8 14.4L7.2 11" stroke="#525252" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'table-tennis':
    case 'table_tennis':
    case 'ping-pong':
    case 'ping_pong':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="12.5" cy="5.5" r="2.75" stroke="#525252" stroke-width="1.5"/><path d="M6.2 8.3L10.1 12.2" stroke="#525252" stroke-linecap="round"/><path d="M4.1 10.4L7.9 14.2" stroke="#525252" stroke-linecap="round"/><path d="M3.2 14.8L5.1 12.9" stroke="#525252" stroke-linecap="round"/></svg>`;
    case 'mma':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9.2C4 6.4 6 4.3 9 4.3C12 4.3 14 6.4 14 9.2V12.8C14 13.6 13.3 14.3 12.5 14.3H5.5C4.7 14.3 4 13.6 4 12.8V9.2Z" stroke="#525252"/><path d="M6.2 8.6H8.1M9.9 8.6H11.8M8.1 10.8H9.9" stroke="#525252" stroke-linecap="round"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.3125" stroke="#525252" stroke-width="1.5"/><path d="M9 3.75V14.25M3.75 9H14.25" stroke="#525252" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
}

function addDynamicSportsToSidebar() {
  const sportNavList = document.querySelector('.sidebar__nav .sidebar__nav-nav');
  if (!sportNavList) return;

  const existingSlugs = new Set(
    Array.from(sportNavList.querySelectorAll('a[data-sport]')).map(a => a.dataset.sport)
  );

  SPORTS.forEach(slug => {
    if (existingSlugs.has(slug)) return;
    const name = SPORT_NAMES[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1));
    const iconSvg = getSidebarSportIconSvg(slug);
    const li = document.createElement('li');
    li.innerHTML = `<a href="#${slug}" data-sport="${slug}" class="sidebar-sport">${iconSvg}<span data-i18n="sidebar.${slug}">${escapeHtml(name)}</span></a>`;
    sportNavList.appendChild(li);
    console.log(`[SIDEBAR] Added dynamic sport link: ${slug}`);
  });
}

// Загрузка всех матчей при старте
async function loadMatches() {
  showMatchesLoader();
  try {
  console.log('=== НАЧАЛО ЗАГРУЗКИ ВСЕХ СПОРТОВ ===');
  
  // Получаем все доступные даты (включая завершенные)
  await fetchAllAvailableDates();
  
  // Загружаем матчи для всех видов спорта при старте страницы
  const initialSports = [...SPORTS];
  for (const sport of initialSports) {
    console.log(`\n--- Загрузка ${sport} (ID: ${SPORT_IDS[sport]}) ---`);
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      if (isPastDate(currentDate)) {
        console.log(`[${sport.toUpperCase()}] Date is past, loading results`);
        await loadSportResults(sport);
      } else {
        console.log(`[${sport.toUpperCase()}] Date is today or future, loading upcoming matches`);
        await loadSportMatches(sport);
      }
    } catch (e) {
      console.error(`❌ Failed to load ${sport}:`, e);
    }
  }
  
  console.log('\n=== ЗАГРУЗКА ВСЕХ СПОРТОВ ЗАВЕРШЕНА ===');
  updateResultsCount();
  
  // ФИНАЛЬНАЯ ПРОВЕРКА: все ли контейнеры заполнены?
  SPORTS.forEach(sport => {
    const container = document.getElementById(`${sport}Leagues`);
    if (container) {
      console.log(`[CHECK] ${sport}: children=${container.children.length}, innerHTML.length=${container.innerHTML.length}, display=${container.style.display}`);
      if (container.children.length === 0) {
        console.warn(`[CHECK] ⚠️ ${sport} container is EMPTY after loadMatches!`);
      }
    } else {
      console.error(`[CHECK] ❌ Container #${sport}Leagues NOT FOUND`);
    }
  });
  } finally {
    hideMatchesLoader();
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== DOM CONTENT LOADED ===');
  ensureMatchesLoader();
  updateMatchesLoaderText();
  document.addEventListener('lang:changed', updateMatchesLoaderText);
  
  // Загружаем список видов спорта из API (может добавить новые)
  await fetchAndInitSports();
  
  // Инициализируем контейнеры ПОСЛЕ получения списка спортов
  initializeContainers();
  
  SPORTS.forEach(sport => {
    const el = document.getElementById(`${sport}Leagues`);
    console.log(`Container #${sport}Leagues: ${el ? 'FOUND' : 'NOT FOUND'}`);
  });
  
  loadMatches();
  
  try { initFilters(); } catch (e) { console.warn('initFilters failed', e); }
  try { initSidebar(); } catch (e) { console.warn('initSidebar failed', e); }
});

// Ensure original news container is present
document.addEventListener('DOMContentLoaded', function() {
  console.log('[NEWS] Checking news container');
  try {
    const newsEl = document.getElementById('newsContainer');
    const footballEl = document.getElementById('footballLeagues');
    console.log('[NEWS] newsEl:', newsEl);
    console.log('[NEWS] footballEl:', footballEl);
    
    if (newsEl && footballEl && footballEl.parentNode) {
      document.querySelectorAll('.news--inline').forEach(n => n.remove());
      if (!footballEl.nextElementSibling?.classList?.contains('news')) {
        footballEl.parentNode.insertBefore(newsEl, footballEl.nextSibling);
        console.log('[NEWS] News container placed after football');
      }
      newsEl.style.display = '';
    } 
  } catch (e) {
    console.warn('initial news placement failed', e);
  }
});