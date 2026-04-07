const footballContainer = document.getElementById('footballLeagues');
const cricketContainer = document.getElementById('cricketLeagues');
const basketballContainer = document.getElementById('basketballLeagues');
const esportsContainer = document.getElementById('esportsLeagues');
const volleyballContainer = document.getElementById('volleyballLeagues');

// Определяем язык на основе атрибута lang HTML
const lng = document.documentElement.lang === 'ru' ? 'ru' : 'en';

// Храним текущие даты для каждого вида спорта
let currentDates = {
  football: formatDate(new Date()),
  cricket: formatDate(new Date()),
  basketball: formatDate(new Date()),
  esports: formatDate(new Date()),
  volleyball: formatDate(new Date())
};

// Константы для кеширования
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const CACHE_KEYS = {
  FOOTBALL: 'football_matches',
  CRICKET: 'cricket_matches', 
  BASKETBALL: 'basketball_matches',
  ESPORTS: 'esports_matches',
  VOLLEYBALL: 'volleyball_matches',
  SPORTS: 'sports_list'
};

const REQUEST_TIMEOUTS = {
  PICKER: 12000,
  NORMAL: 20000,
  HEAVY: 30000
};

const AFFILIATE_LINK = 'https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599';

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

function parseScorePair(item) {
  const score = item.score || item.scoreLine || null;
  let opponent1Score = item.opponent1Score ?? item.homeScore ?? null;
  let opponent2Score = item.opponent2Score ?? item.awayScore ?? null;

  if (opponent1Score == null && item.fullScore && typeof item.fullScore === 'object') {
    opponent1Score = item.fullScore.sc1 ?? null;
  }
  if (opponent2Score == null && item.fullScore && typeof item.fullScore === 'object') {
    opponent2Score = item.fullScore.sc2 ?? null;
  }
  if (opponent1Score == null && item.curScore && typeof item.curScore === 'object') {
    opponent1Score = item.curScore.sc1 ?? null;
  }
  if (opponent2Score == null && item.curScore && typeof item.curScore === 'object') {
    opponent2Score = item.curScore.sc2 ?? null;
  }

  if (opponent1Score == null && opponent2Score == null && score && typeof score === 'string') {
    const parts = score.split(' ')[0].split(':');
    if (parts.length === 2) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
        opponent1Score = p1;
        opponent2Score = p2;
      }
    }
  }

  return { opponent1Score, opponent2Score };
}

function isLiveMatch(item) {
  const status = String(item?.status || '').toLowerCase();
  if (status === 'live' || status === 'in_progress') return true;

  const gameStatus = Number(item?.gameStatus);
  if (Number.isFinite(gameStatus)) {
    return gameStatus !== 1 && gameStatus !== 4 && gameStatus !== 32;
  }

  return false;
}

function formatLiveClock(seconds) {
  const sec = Number(seconds);
  if (!Number.isFinite(sec) || sec < 0) return 'LIVE';

  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

function buildLiveTimeContent(item) {
  const { opponent1Score, opponent2Score } = parseScorePair(item);
  const liveClock = formatLiveClock(item?.timeSec);
  const scoreLine = `${opponent1Score ?? 0} - ${opponent2Score ?? 0}`;
  return `<strong>${liveClock} | ${scoreLine}</strong><span class="watch">Watch</span>`;
}

let sportsCache = null;
const sportIdCache = {}; 


const SPORT_ID_OVERRIDES = {
  football: 1,
  basketball: 3,
  volleyball: 6,
  cricket: 66,
  esports: 40,
};

function normalizeSportName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getSports() {
  if (sportsCache) return sportsCache;
  
  try {
    const data = await fetchWithCache('/api/sports', CACHE_KEYS.SPORTS, {
      timeout: REQUEST_TIMEOUTS.PICKER,
      retries: 1,
      retryDelay: 600,
      quiet: true
    });
    sportsCache = data.items || [];
    return sportsCache;
  } catch (error) {
    console.warn('Failed to fetch sports from API, using empty list', error);
    sportsCache = [];
    return sportsCache;
  }
}

async function getSportId(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  const normalizedKey = normalizeSportName(key);

  if (SPORT_ID_OVERRIDES[key]) {
    console.log(`Using override for ${name}: ID ${SPORT_ID_OVERRIDES[key]}`);
    return SPORT_ID_OVERRIDES[key];
  }
  
  // Проверяем кеш
  if (sportIdCache[key]) {
    console.log(`Using cached sport ID for ${name}: ${sportIdCache[key]}`);
    return sportIdCache[key];
  }

  // Сначала пробуем получить из API
  try {
    const sports = await getSports();
    if (Array.isArray(sports) && sports.length > 0) {
      const normalizedMatch = sports.find(s => normalizeSportName(s.name) === normalizedKey);
      if (normalizedMatch) {
        console.log(`Found normalized match for ${name} in API: ID ${normalizedMatch.id} (name: ${normalizedMatch.name})`);
        sportIdCache[key] = normalizedMatch.id;
        return normalizedMatch.id;
      }

      // Ищем точное совпадение
      const exactMatch = sports.find(s => String(s.name).toLowerCase() === key);
      if (exactMatch) {
        console.log(`Found exact match for ${name} in API: ID ${exactMatch.id}`);
        sportIdCache[key] = exactMatch.id;
        return exactMatch.id;
      }

      // Ищем частичное совпадение
      const partialMatch = sports.find(s => String(s.name).toLowerCase().includes(key));
      if (partialMatch) {
        console.log(`Found partial match for ${name} in API: ID ${partialMatch.id} (name: ${partialMatch.name})`);
        sportIdCache[key] = partialMatch.id;
        return partialMatch.id;
      }

      // Ищем совпадение по началу строки
      const startsWithMatch = sports.find(s => String(s.name).toLowerCase().startsWith(key));
      if (startsWithMatch) {
        console.log(`Found startsWith match for ${name} in API: ID ${startsWithMatch.id}`);
        sportIdCache[key] = startsWithMatch.id;
        return startsWithMatch.id;
      }
    }
  } catch (error) {
    console.warn(`Error fetching sports from API for ${name}, using fallback`, error);
  }

  // Если не нашли в API или API не ответил, используем запасные значения
  console.log(`Using fallback ID for ${name}: ${SPORT_ID_OVERRIDES[name] || SPORT_ID_OVERRIDES[key]}`);
  
  // Важно: сохраняем по тому же ключу, по которому ищем
  const fallbackId = SPORT_ID_OVERRIDES[name] || SPORT_ID_OVERRIDES[key];
  sportIdCache[key] = fallbackId;
  return fallbackId;
}

// Global loading overlay manager
let globalLoadingOverlay = null;
let loadingCounter = 0;

// Функция для показа Lottie анимации при загрузке (попап с оверлеем)
function showLoadingAnimation(container) {
  if (!container || typeof lottie === 'undefined') return;
  
  loadingCounter++;
  
  // Если оверлей уже существует, просто увеличиваем счетчик
  if (globalLoadingOverlay) return;
  
  try {
    // Создаем оверлей с попапом
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'global-loading-overlay';
    
    const popover = document.createElement('div');
    popover.className = 'loading-popover';
    
    const animContainer = document.createElement('div');
    animContainer.className = 'loading-popover__animation';
    animContainer.id = 'global-lottie-anim';
    
    const text = document.createElement('p');
    text.className = 'loading-popover__text';
    text.textContent = '';
    
    popover.appendChild(animContainer);
    popover.appendChild(text);
    overlay.appendChild(popover);
    document.body.appendChild(overlay);
    
    globalLoadingOverlay = overlay;
    
    // Загружаем Lottie анимацию
    if (!window.globalLottieInstance) {
      window.globalLottieInstance = lottie.loadAnimation({
        container: animContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'images/BallSport.json'
      });
    }
    
  } catch (e) {
    console.warn('Lottie animation error:', e);
  }
}

// Функция для скрытия загрузочного попапа
function hideLoadingAnimation(container) {
  if (!container) return;
  
  loadingCounter--;
  
  // Скрываем оверлей только когда все загрузки завершены
  if (loadingCounter <= 0 && globalLoadingOverlay) {
    loadingCounter = 0;
    globalLoadingOverlay.style.animation = 'fadeOut 0.3s ease-in-out forwards';
    setTimeout(() => {
      if (globalLoadingOverlay) {
        globalLoadingOverlay.remove();
        globalLoadingOverlay = null;
      }
      if (window.globalLottieInstance) {
        window.globalLottieInstance.destroy();
        window.globalLottieInstance = null;
      }
    }, 300);
  }
}

// Выносим formatDate наружу, чтобы она была доступна везде
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Функция для получения фиксированных дат
function getFixedDates() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayBeforeYesterday = new Date(today);
  dayBeforeYesterday.setDate(today.getDate() - 2);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  return {
    today: formatDate(today),
    yesterday: formatDate(yesterday),
    dayBeforeYesterday: formatDate(dayBeforeYesterday),
    tomorrow: formatDate(tomorrow)
  };
}

// Форматирует дату для отображения (например: "16.03.2026")
function formatDateDisplay(dateStr) {
  // Парсим в YYYY-MM-DD, чтобы избежать смещения из-за часового пояса
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dt = new Date(year, month, day);
  if (isNaN(dt)) return dateStr;
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Возвращает массив доступных дат матча (YYYY-MM-DD) по API
const availableDatesCache = {};
async function getAvailableDatesForSport(sportId, rangeDays = { past: 3, future: 3 }) {
  if (!sportId) return [];
  if (availableDatesCache[sportId]) return availableDatesCache[sportId];

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - rangeDays.past);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + rangeDays.future);
  endDate.setHours(23, 59, 59, 999);

  const gtStart = Math.floor(startDate.getTime() / 1000);
  const ltStart = Math.floor(endDate.getTime() / 1000);

  try {
    const data = await fetchWithCache(
      `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&count=250&lng=${lng}`,
      `availableDates_${sportId}_${gtStart}_${ltStart}`,
      { timeout: REQUEST_TIMEOUTS.PICKER, retries: 1 }
    );
    if (!data || !Array.isArray(data.items)) return [];

    const dates = new Set();
    data.items.forEach(item => {
      const startTime = item.startDate;
      if (!startTime) return;
      const date = new Date(startTime * 1000);
      if (isNaN(date)) return;
      const iso = date.toISOString().split('T')[0];
      dates.add(iso);
    });


    const fixedDates = getFixedDates();
    const todayIso = fixedDates.today;
    dates.add(fixedDates.today);
    dates.add(fixedDates.yesterday);
    dates.add(fixedDates.dayBeforeYesterday);

    const sorted = Array.from(dates).sort();
    availableDatesCache[sportId] = sorted;
    return availableDatesCache[sportId];
  } catch (error) {
    console.warn('Cannot load available dates for sport', sportId, error);
    // Возвращаем фиксированные даты в случае ошибки
    const fixedDates = getFixedDates();
    return [fixedDates.today, fixedDates.tomorrow, fixedDates.yesterday, fixedDates.dayBeforeYesterday];
  }
}

// Рендерит date-picker, используя список доступных дат или фиксированные даты
function buildDatePicker(pickerEl, sportKey, loadFn, availableDates = null) {
  if (!pickerEl) return;

  const fixedDates = getFixedDates();
  const i18nLabels = {
    'date.dayBeforeYesterday': 'Day before yesterday',
    'date.yesterday': 'Yesterday',
    'date.today': 'Today',
    'date.tomorrow': 'Tomorrow'
  };

  // Сохраняем метки, если они заданы через data-i18n (для поддержки локализации)
  pickerEl.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) i18nLabels[key] = el.textContent.trim();
  });

  // Очистка контейнера перед рендером
  pickerEl.innerHTML = '';

  // Определяем даты для кнопок
  let dateKeys = availableDates;
  if (!dateKeys || !dateKeys.length) {
    dateKeys = [
      fixedDates.today,
      fixedDates.tomorrow,
      fixedDates.yesterday,
      fixedDates.dayBeforeYesterday
    ];
  }

  // Упорядочиваем по возрастанию (прошлое → сегодня → будущее)
  const todayIso = fixedDates.today;
  dateKeys = [...new Set(dateKeys)];
  dateKeys.sort();

  dateKeys.forEach(dateStr => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.date = dateStr;

    // Если дата совпадает с одним из известных, используем метку из i18n (Today, Yesterday, ...)
    let label = dateStr;
    if (dateStr === fixedDates.today) label = i18nLabels['date.today'] || 'Today';
    else if (dateStr === fixedDates.yesterday) label = i18nLabels['date.yesterday'] || 'Yesterday';
    else if (dateStr === fixedDates.dayBeforeYesterday) label = i18nLabels['date.dayBeforeYesterday'] || 'Day before yesterday';
    else if (dateStr === fixedDates.tomorrow) label = i18nLabels['date.tomorrow'] || 'Tomorrow';

    const formatted = formatDateDisplay(dateStr);
    btn.textContent = formatted;

    if (currentDates[sportKey] === dateStr) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      pickerEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentDates[sportKey] = dateStr;
      loadFn(dateStr);
    });

    pickerEl.appendChild(btn);
  });
}

// Асинхронно получает даты, доступные в API, и строит date-picker
async function buildDatePickerForSport(pickerEl, sportKey, loadFn) {
  if (!pickerEl) return;
  
  try {
    const sportId = await getSportId(sportKey);
    console.log(`Building date picker for ${sportKey} with sportId:`, sportId);
    
    if (sportId) {
      const dates = await getAvailableDatesForSport(sportId);
      buildDatePicker(pickerEl, sportKey, loadFn, dates);
    } else {
      // Если sportId не получен, используем фиксированные даты
      console.warn(`No sportId for ${sportKey}, using fixed dates`);
      buildDatePicker(pickerEl, sportKey, loadFn, null);
    }
  } catch (error) {
    console.warn(`Error building date picker for ${sportKey}:`, error);
    // В случае ошибки используем фиксированные даты
    buildDatePicker(pickerEl, sportKey, loadFn, null);
  }
}

// NOTE: Caching is disabled for now to ensure fresh data is always fetched.
// The helper function keeps the same signature for compatibility.
async function fetchWithCache(url, cacheKey, options = {}) {
  const {
    timeout = REQUEST_TIMEOUTS.NORMAL,
    retries = 0,
    retryDelay = 400,
    quiet = false
  } = options;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const isTimeout = error.name === 'AbortError';
      if (isTimeout && !quiet) {
        console.error(`Request timeout for ${url} after ${timeout}ms (attempt ${attempt + 1}/${retries + 1})`);
      } else if (!isTimeout && !quiet) {
        console.error(`Error fetching ${url} (attempt ${attempt + 1}/${retries + 1}):`, error);
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  if (lastError && lastError.name === 'AbortError') {
    throw new Error(`Request timeout after ${timeout}ms`);
  }
  throw lastError;
}

async function loadMatches() {
  try {
    await Promise.allSettled([
      loadFootballMatches(currentDates.football),
      loadCricketMatches(currentDates.cricket), 
      loadBasketballMatches(currentDates.basketball),
      loadEsportsMatches(currentDates.esports),
      loadVolleyballMatches(currentDates.volleyball)
    ]);
  } catch (error) {
    console.warn('Some matches failed to load:', error);
  }
}

// --- Футбол ---
const allowedFootballKeywords = [
  'Premier League', 'Saudi Pro League', 'English Premier League', 'sudan', 'UEFA Champions League', 'oman',
];

async function loadFootballMatches(dateStr) {
  if (!footballContainer) return;
  // Если передана дата как строка, используем её, если объект Date - форматируем
  const dateToLoad = typeof dateStr === 'string' ? dateStr : formatDate(dateStr);
  const todayIso = formatDate(new Date());
  const isPastDate = dateToLoad < todayIso;

  showLoadingAnimation(footballContainer);
  try {
    const sportId = await getSportId('football');
    console.log("Football sportId:", sportId);
    if (!sportId) {
      hideLoadingAnimation(footballContainer);
      footballContainer.innerHTML = `<p>Football not available</p>`;
      return;
    }

    const dayStart = new Date(dateToLoad);
    dayStart.setHours(0, 0, 0, 0);
    const gtStart = Math.floor(dayStart.getTime() / 1000);
    const ltStart = Math.floor((dayStart.getTime() + 24 * 60 * 60 * 1000) / 1000);

    console.log("Football dateToLoad:", dateToLoad, "gtStart:", gtStart, "ltStart:", ltStart);

    // For past dates try the Result API first (real scores + images);
    // fall back to Prematch if Result API is unavailable.
    let rawItems = [];
    if (isPastDate) {
      try {
        const resultData = await fetchWithCache(
          `/api/results?sportId=${sportId}&dateFrom=${gtStart}&dateTo=${ltStart}&lng=en`,
          `${CACHE_KEYS.FOOTBALL}_results_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = (resultData.items || []).filter(item => item.type === 1 || item.type == null);
      } catch (resultErr) {
        console.warn('Result API unavailable for football, falling back to prematch:', resultErr.message);
        const fallbackData = await fetchWithCache(
          `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
          `${CACHE_KEYS.FOOTBALL}_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = fallbackData.items || [];
      }
    } else {
      const data = await fetchWithCache(
        `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=${lng}`,
        `${CACHE_KEYS.FOOTBALL}_${dateToLoad}`,
        { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
      );
      rawItems = data.items || [];
    }

    hideLoadingAnimation(footballContainer);
    console.log("Football API response: items count =", rawItems.length);

    if (!rawItems.length) {
      console.log("No matches found for", dateToLoad);
      footballContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }

    const mapped = rawItems.map(item => {
      const { opponent1Score, opponent2Score } = parseScorePair(item);
      return {
        ...item,
        tournamentId: item.tournamentId || item.constSportEventId || item.sportEventId || 'unknown',
        tournamentNameLocalization: item.tournamentNameLocalization || item.tournamentName || 'Unknown League',
        startDate: item.startDate || item.date || 0,
        status: isPastDate ? 'finished' : item.status || 'scheduled',
        opponent1Score,
        opponent2Score
      };
    });

    renderFootball(mapped, { isPastDate });
  } catch (e) {
    hideLoadingAnimation(footballContainer);
    footballContainer.innerHTML = "<p>Error loading football matches. Please try again later.</p>";
    console.error("Football load error:", e);
  }
}

function isAllowedFootball(event) {
  const leagueName = (event.tournamentNameLocalization || '');
  const leagueCountry = (event.countryNameLocalization || '');
  const home = (event.opponent1NameLocalization || '');
  const away = (event.opponent2NameLocalization || '');

  const hay = [leagueName, leagueCountry, home, away].join(' ').toLowerCase();
  const ok = allowedFootballKeywords.some(k => hay.includes(k));
  return ok;
}

function renderFootball(matches, options = {}) {
  const { isPastDate = false } = options;
  console.log("renderFootball called with", matches.length, "matches");
  footballContainer.innerHTML = "";

  let filtered = matches.filter(isAllowedFootball);

  if (!filtered.length) {
    console.log('[DEBUG] No matches found, adding top 3 leagues');
    const firstThreeMatches = matches.slice(0, 3);
    filtered = [...firstThreeMatches];
  }

  const leaguesMap = {};
  filtered.forEach(event => {
    const leagueId = event.tournamentId || 'unknown';
    if (!leaguesMap[leagueId]) {
      const rawLogo = Array.isArray(event.tournamentImage) ? event.tournamentImage[0] : event.tournamentImage;
      leaguesMap[leagueId] = { league: { name: event.tournamentNameLocalization || 'Unknown League', logo: getTournamentLogo(rawLogo) }, events: [] };
    }
    leaguesMap[leagueId].events.push(event);
  });

  // Sort leagues alphabetically
  const sortedLeagues = Object.keys(leaguesMap).sort((a, b) => {
    const nameA = leaguesMap[a].league.name.toLowerCase();
    const nameB = leaguesMap[b].league.name.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  console.log("Rendering", sortedLeagues.length, "leagues");

  for (const leagueId of sortedLeagues) {
    const { league, events } = leaguesMap[leagueId];
    const leagueEl = document.createElement('div');
    leagueEl.className = 'league';
    if (!isPastDate) {
      leagueEl.innerHTML = `<div class="league__header"><div class="league__logo">${league.logo ? `<img src="${league.logo}" alt="${league.name}" onerror="this.style.display='none'">` : ''}</div><h2>${league.name}</h2></div>`;
    }
    
    // Сортировка матчей по времени
    events.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    
    events.forEach(event => {
      const startTime = event.startDate || Date.now() / 1000;
      const matchDate = new Date(startTime * 1000);
      const isLive = isLiveMatch(event);
      let displayTime;
      if (isLive) {
        displayTime = buildLiveTimeContent(event);
      } else if (event.status === 'finished') {
        displayTime = `<strong>${event.opponent1Score ?? 0} - ${event.opponent2Score ?? 0}</strong><span class="hightlights">Hightlights</span>`;
      } else {
        displayTime = `<strong>${matchDate.toLocaleString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit'
        }).replace(',', '')}</strong><span class="watch">Watch</span>`;
      }

      const matchEl = document.createElement('a');
      matchEl.className = 'match';
      matchEl.href = '#';
      if (isLive) matchEl.classList.add('live');
      
      const homeTeamName = event.opponent1NameLocalization || 'Unknown';
      const awayTeamName = event.opponent2NameLocalization || 'Unknown';
      const homeImg = getTeamLogo(event.imageOpponent1);
      const awayImg = getTeamLogo(event.imageOpponent2);
      
      matchEl.innerHTML = `<div class="team"><div class="team__logo">${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}</div><span>${homeTeamName}</span></div><a href="${event.link || AFFILIATE_LINK}" target="_blank" class="time">${displayTime}</a><div class="team team--2"><span>${awayTeamName}</span><div class="team__logo">${awayImg ? `<img src="${awayImg}" alt="${awayTeamName}" onerror="this.style.display='none'">` : ''}</div></div>`;
      leagueEl.appendChild(matchEl);
    });
    footballContainer.appendChild(leagueEl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Рисуем кнопки дат (вместо фиксированных prev/today/next) и затем загружаем матчи
  const footballPicker = document.getElementById('footballDatePicker');
  buildDatePickerForSport(footballPicker, 'football', loadFootballMatches).catch(e => console.warn('Date picker build failed (football):', e));

  const cricketPicker = document.getElementById('cricketDatePicker');
  buildDatePickerForSport(cricketPicker, 'cricket', loadCricketMatches).catch(e => console.warn('Date picker build failed (cricket):', e));

  const basketballPicker = document.getElementById('basketballDatePicker');
  buildDatePickerForSport(basketballPicker, 'basketball', loadBasketballMatches).catch(e => console.warn('Date picker build failed (basketball):', e));

  const esportsPicker = document.getElementById('esportsDatePicker');
  buildDatePickerForSport(esportsPicker, 'esports', loadEsportsMatches).catch(e => console.warn('Date picker build failed (esports):', e));

  const volleyballPicker = document.getElementById('volleyballDatePicker');
  buildDatePickerForSport(volleyballPicker, 'volleyball', loadVolleyballMatches).catch(e => console.warn('Date picker build failed (volleyball):', e));

  // Инициализация всех видов спорта
  loadMatches();
  
  // Отладка ID видов спорта (с задержкой)
  setTimeout(debugSportIds, 2000);
});

// translations for slider labels (loaded dynamically)
let _sliderTranslations = null;

async function loadSliderTranslations() {
  if (_sliderTranslations) return _sliderTranslations;

  // candidate URLs to find translations.json
  const candidates = [
    '/i18n/translations.json',
    'i18n/translations.json',
    './i18n/translations.json',
    window.location.pathname.replace(/[^/]*$/, '') + 'i18n/translations.json'
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      _sliderTranslations = json;
      console.info('slider translations loaded from', url);
      return _sliderTranslations;
    } catch (e) {
      // continue
    }
  }

  // fallback to empty
  _sliderTranslations = {};
  console.warn('slider translations not loaded from any candidate path');
  return _sliderTranslations;
}

function tSlider(key, lang) {
  lang = lang || (document.body && document.body.getAttribute('data-lang')) || localStorage.getItem('siteLang') || 'en';
  if (!_sliderTranslations) return key; // not loaded yet
  // nested lookup like translations[lang][key]
  try {
    if (_sliderTranslations[lang] && _sliderTranslations[lang][key]) return _sliderTranslations[lang][key];
    if (_sliderTranslations['en'] && _sliderTranslations['en'][key]) return _sliderTranslations['en'][key];
  } catch (e) {}
  return key;
}

function updateExistingSliderTranslations(lang) {
  if (!lang) lang = (document.body && document.body.getAttribute('data-lang')) || localStorage.getItem('siteLang') || 'en';
  // update timer labels
  document.querySelectorAll('.slide__timer').forEach(timer => {
    const daysLabel = timer.querySelector('.days span');
    const hoursLabel = timer.querySelector('.hours span');
    const minsLabel = timer.querySelector('.minutes span');
    const secsLabel = timer.querySelector('.seconds span');
    if (daysLabel) daysLabel.textContent = tSlider('slider.days', lang);
    if (hoursLabel) hoursLabel.textContent = tSlider('slider.hours', lang);
    if (minsLabel) minsLabel.textContent = tSlider('slider.minutes', lang);
    if (secsLabel) secsLabel.textContent = tSlider('slider.seconds', lang);
  });

  // update buttons
  document.querySelectorAll('.slide__btn--1').forEach(btn => btn.textContent = tSlider('slider.watchPlay', lang));
  document.querySelectorAll('.slide__btn--2').forEach(btn => btn.textContent = tSlider('slider.remind', lang));
}

// Watch for language changes on body[data-lang] and update dynamic slider texts
if (typeof MutationObserver !== 'undefined') {
  const bodyObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'attributes' && m.attributeName === 'data-lang') {
        const lang = document.body.getAttribute('data-lang');
        // if translations already loaded — update immediately, otherwise we'll update after load
        updateExistingSliderTranslations(lang);
      }
    });
  });
  bodyObserver.observe(document.body, { attributes: true });
}

async function createTomorrowSwiperSlides() {
  const swiperWrapper = document.getElementById('macthSlider');
  
  if (!swiperWrapper) {
    console.warn('Swiper wrapper #macthSlider not found');
    return;
  }

  // Создаем оверлей с попапом для загрузки
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = 'slider-loading-overlay';
  
  const popover = document.createElement('div');
  popover.className = 'loading-popover';
  
  const animContainer = document.createElement('div');
  animContainer.className = 'loading-popover__animation';
  animContainer.id = 'slider-lottie-' + Math.random();
  
  const text = document.createElement('p');
  text.className = 'loading-popover__text';
  text.textContent = 'Loading...';
  
  popover.appendChild(animContainer);
  popover.appendChild(text);
  overlay.appendChild(popover);
  document.body.appendChild(overlay);
  
  // Загружаем Lottie анимацию
  lottie.loadAnimation({
    container: animContainer,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'images/BallSport.json'
  });

  // Получаем завтрашнюю дату
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  // Ensure slider translations are loaded before rendering slides
  await loadSliderTranslations();

  try {
    // Загружаем футбольные матчи на завтра
    const sportId = await getSportId('football');
    if (!sportId) {
      swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="slide"><div class="slide__content"><div class="no-matches">Football not available</div></div></div></div>';
      return;
    }

    const gtStart = Math.floor(tomorrow.getTime() / 1000);
    const ltStart = Math.floor((tomorrow.getTime() + 24 * 60 * 60 * 1000) / 1000);

    const response = await fetch(`/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=${lng}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Проверяем, что ответ содержит JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response, got ${contentType}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="slide"><div class="slide__content"><div class="no-matches">No matches for tomorrow</div></div></div></div>';
      return;
    }

    // Берем первые 4 матча на завтра
    const tomorrowMatches = data.items.slice(0, 4);
    
    // Очищаем слайды перед добавлением новых
    swiperWrapper.innerHTML = '';

    tomorrowMatches.forEach(match => {
      const startTime = match.startDate || (Date.now() / 1000 + 86400);
      const matchDate = new Date(startTime * 1000);
      const formattedDate = matchDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const formattedTime = matchDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const homeTeamName = match.opponent1NameLocalization || 'Unknown';
      const awayTeamName = match.opponent2NameLocalization || 'Unknown';
      const homeImg = getTeamLogo(match.imageOpponent1) || '';
      const awayImg = getTeamLogo(match.imageOpponent2) || '';
      
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      const lang = (document.body && document.body.getAttribute('data-lang')) || localStorage.getItem('siteLang') || 'en';

      slide.innerHTML = `
        <div class="slide">
          <div class="slide__content">
            <div class="slide__teams">
              <div class="slide__team">
                ${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}
              </div>
              <div class="slide__match">
                <div class="slide__match-title">${homeTeamName} vs ${awayTeamName}</div>
                <div class="slide__match-date">${formattedDate}</div>
                <div class="slide__match-time">${formattedTime}</div>
              </div>
              <div class="slide__team">
                ${awayImg ? `<img src="${awayImg}" alt="${awayTeamName}" onerror="this.style.display='none'">` : ''}
              </div>
            </div>
            <div class="slide__mobile">
              <div>${homeTeamName}</div> 
              <span>${formattedDate} ${formattedTime}</span> 
              <div>${awayTeamName}</div>
            </div>
            <div class="slide__timer" data-date="${matchDate.toISOString()}">
                <div class="days">
                <div>00</div>
                <span>${tSlider('slider.days', lang)}</span>
              </div>
              <span class="border">:</span>
              <div class="hours">
                <div>00</div>
                <span>${tSlider('slider.hours', lang)}</span>
              </div>
              <span class="border">:</span>
              <div class="minutes">
                <div>00</div>
                <span>${tSlider('slider.minutes', lang)}</span>
              </div>
              <span class="border">:</span>
              <div class="seconds">
                <div>00</div>
                <span>${tSlider('slider.seconds', lang)}</span>
              </div> 
            </div>
            <div class="slide__controls">
              <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="slide__btn slide__btn--1">${tSlider('slider.watchPlay', lang)}</a>
              <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="slide__btn slide__btn--2">${tSlider('slider.remind', lang)}</a>
            </div>
          </div>
        </div>
      `;
      swiperWrapper.appendChild(slide);
    });

    // Инициализируем свайпер
    initializeSwiper();
    
    // Запускаем таймеры
    setTimeout(startCountdownUpdates, 100);
    // Подставляем переводы в уже созданные слайды (на случай, если язык был выбран до загрузки)
    updateExistingSliderTranslations();

  } catch (error) {
    console.error('Error loading matches:', error);
    swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="slide"><div class="slide__content"><div class="error">Error loading matches. Please try again later.</div></div></div></div>';
  } finally {
    // Скрываем оверлей загрузки
    setTimeout(() => {
      const loadingOverlay = document.getElementById('slider-loading-overlay');
      if (loadingOverlay && loadingOverlay.parentNode) {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.pointerEvents = 'none';
        setTimeout(() => loadingOverlay.remove(), 300);
      }
    }, 100);
  }
}

// Функция для инициализации свайпера
function initializeSwiper() {
  const swiperWrapper = document.getElementById('macthSlider');
  if (!swiperWrapper) return;

  // Если свайпер уже инициализирован, уничтожаем его
  if (window.footballSwiper) {
    window.footballSwiper.destroy();
  }

  if (typeof Swiper !== 'undefined') {
    window.footballSwiper = new Swiper('.swiper-container', {
      loop: true,  
      centeredSlides: true, 
      slidesPerView: 'auto',  
      slidesToScroll: 1, 
      spaceBetween: 0,  
      pagination: {
        el: '.swiper-pagination',
        type: 'bullets',
        clickable: true,
      },
    });
    
    console.log('Swiper initialized successfully');
  } else {
    console.warn('Swiper library not loaded');
  }
}

// Функция для обновления таймеров обратного отсчета
function updateCountdowns() {
  const timers = document.querySelectorAll('.slide__timer[data-date]');
  
  timers.forEach(timer => {
    const dateAttr = timer.getAttribute('data-date');
    
    // Проверяем, что атрибут существует и не пустой
    if (!dateAttr) {
      console.warn('Timer element missing data-date attribute');
      return;
    }
    
    try {
      const targetDate = new Date(dateAttr).getTime();
      const now = new Date().getTime();
      const distance = targetDate - now;
      
      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        const daysEl = timer.querySelector('.days div');
        const hoursEl = timer.querySelector('.hours div');
        const minutesEl = timer.querySelector('.minutes div');
        const secondsEl = timer.querySelector('.seconds div');
        
        if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
      } else {
        // Матч уже начался или завершился
        timer.innerHTML = '<div class="match-started">Match Started</div>';
      }
    } catch (error) {
      console.error('Error updating countdown timer:', error);
      timer.innerHTML = '<div class="match-error">Date Error</div>';
    }
  });
}

// Запускаем обновление таймеров только если есть элементы
function startCountdownUpdates() {
  const timers = document.querySelectorAll('.slide__timer[data-date]');
  if (timers.length > 0) {
    setInterval(updateCountdowns, 1000);
    updateCountdowns(); // Первоначальное обновление
  }
}

// Загружаем слайдер с завтрашними матчами при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  // Ждем немного перед загрузкой слайдера
  setTimeout(createTomorrowSwiperSlides, 500);
});

// --- Крикет ---
async function loadCricketMatches(dateStr) {
  if (!cricketContainer) return;
  // Если передана дата как строка, используем её, если объект Date - форматируем
  const dateToLoad = typeof dateStr === 'string' ? dateStr : formatDate(dateStr);
  
  console.log("=== loadCricketMatches START ===");
  console.log("Received date parameter:", dateStr);
  console.log("Date to load:", dateToLoad);
  
  showLoadingAnimation(cricketContainer);
  try {
    const sportId = await getSportId('cricket');
    console.log("Cricket sportId:", sportId);
    if (!sportId) {
      hideLoadingAnimation(cricketContainer);
      cricketContainer.innerHTML = "<p>Cricket not available</p>";
      return;
    }

    const gtStart = Math.floor(new Date(dateToLoad).getTime() / 1000);
    const ltStart = Math.floor((new Date(dateToLoad).getTime() + 24 * 60 * 60 * 1000) / 1000);
    const todayIso = formatDate(new Date());
    const isPastDate = dateToLoad < todayIso;

    let items;
    if (isPastDate) {
      try {
        const resultData = await fetchWithCache(
          `/api/results?sportId=${sportId}&dateFrom=${gtStart}&dateTo=${ltStart}&lng=en`,
          `${CACHE_KEYS.CRICKET}_results_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 0, quiet: true }
        );
        items = (resultData.items || [])
          .filter(item => item.type === 1 || item.type == null)
          .map(item => {
            const { opponent1Score, opponent2Score } = parseScorePair(item);
            return { ...item, status: 'finished', opponent1Score, opponent2Score };
          });
      } catch (resultErr) {
        console.warn('Result API unavailable for cricket, falling back to prematch:', resultErr.message);
        const fallbackData = await fetchWithCache(
          `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
          `${CACHE_KEYS.CRICKET}_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        items = fallbackData.items || [];
      }
    } else {
      const data = await fetchWithCache(
        `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
        `${CACHE_KEYS.CRICKET}_${dateToLoad}`,
        { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
      );
      items = data.items || [];
    }
    hideLoadingAnimation(cricketContainer);
    console.log("Cricket API response:", items);
    
    if (!items.length) {
      console.log("No cricket matches found for", dateToLoad);
      cricketContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }
    
    console.log(`Found ${items.length} cricket matches, rendering`);
    renderCricket(items, dateToLoad, { isPastDate });
  } catch (e) {
    hideLoadingAnimation(cricketContainer);
    console.error("Error loading cricket matches:", e);
    cricketContainer.innerHTML = "<p>Error loading cricket matches. Please try again later.</p>";
  }
  console.log("=== loadCricketMatches END ===");
}

function sortAndGroupMatches(matches) {
  // console.log("sortAndGroupMatches called with:", matches);
  
  // Преобразуем дату в формате timestamp в строку вида "YYYY-MM-DD"
  matches.forEach(match => {
    const dateString = match.startTime;
    if (!dateString) {
      console.warn("Missing startTime for match:", match);
      match.dateOnly = "unknown";
      return;
    }
    const matchDate = new Date(dateString * 1000);
    if (isNaN(matchDate.getTime())) {
      console.warn("Invalid startTime:", dateString, "for match:", match);
      match.dateOnly = "invalid";
      return;
    }
    // Преобразуем в строку "YYYY-MM-DD"
    match.dateOnly = matchDate.toISOString().split('T')[0];
    // console.log(`Match date: ${dateString} -> ${match.dateOnly}`);
  });

  const validMatches = matches.filter(match => 
    match.dateOnly && match.dateOnly !== "unknown" && match.dateOnly !== "invalid"
  );
  
  // console.log("Valid matches:", validMatches.length, "out of", matches.length);

  validMatches.sort((a, b) => a.dateOnly.localeCompare(b.dateOnly));

  const groupedMatches = validMatches.reduce((acc, match) => {
    if (!acc[match.dateOnly]) {
      acc[match.dateOnly] = [];
    }
    acc[match.dateOnly].push(match);
    return acc;
  }, {});

  console.log("Grouped matches result:", groupedMatches);
  return groupedMatches;
}

function renderCricket(matches, selectedDate, options = {}) {
  const { isPastDate = false } = options;
  cricketContainer.innerHTML = "";

  try {
    // Normalize and filter matches by selected date
    const processed = matches.map(match => {
      const timestamp = match.startDate || null;
      const matchDate = timestamp ? new Date(timestamp * 1000) : null;
      const dateOnly = matchDate ? formatDate(matchDate) : null;
      return {
        ...match,
        __matchDate: matchDate,
        __dateOnly: dateOnly
      };
    });

    const matchesForDate = processed.filter(m => m.__dateOnly === selectedDate);
    if (!matchesForDate.length) {
      cricketContainer.innerHTML = `<p>No matches for ${formatDateDisplay(selectedDate)}</p>`;
      return;
    }

    const leaguesMap = {};
    matchesForDate.forEach(match => {
      const leagueId = match.tournamentId || 'unknown';
      const leagueName = match.tournamentNameLocalization || 'Cricket';
      const rawLogo = Array.isArray(match.tournamentImage) ? match.tournamentImage[0] : match.tournamentImage;
      const leagueLogo = getTournamentLogo(rawLogo);

      if (!leaguesMap[leagueId]) {
        leaguesMap[leagueId] = {
          league: { id: leagueId, name: leagueName, logo: leagueLogo },
          matches: []
        };
      }
      leaguesMap[leagueId].matches.push(match);
    });

    const leagues = Object.values(leaguesMap).sort((a, b) => a.league.name.localeCompare(b.league.name));

    leagues.forEach(leagueBlock => {
      const leagueEl = document.createElement('div');
      leagueEl.className = 'league';
      if (!isPastDate) {
        leagueEl.innerHTML = `
          <div class="league__header">
            <div class="league__logo">${leagueBlock.league.logo ? `<img src="${leagueBlock.league.logo}" alt="${leagueBlock.league.name}" onerror="this.style.display='none'">` : ''}</div>
            <h2>${leagueBlock.league.name}</h2>
          </div>
        `;
      }

      const sortedMatches = leagueBlock.matches.slice().sort((a, b) => {
        const aTime = a.__matchDate ? a.__matchDate.getTime() : 0;
        const bTime = b.__matchDate ? b.__matchDate.getTime() : 0;
        return aTime - bTime;
      });

      sortedMatches.forEach(match => {
        const matchEl = document.createElement('a');
        matchEl.className = 'match match--cricket';
        matchEl.href = '#';

        // Форматируем дату в формат "14 Nov 15:00"
        let displayDate = 'Дата не указана';
        if (match.__matchDate) {
          displayDate = match.__matchDate.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(',', '');
        }

        const homeTeamName = match.opponent1NameLocalization || 'Unknown';
        const awayTeamName = match.opponent2NameLocalization || 'Unknown';
        const homeImg = getTeamLogo(match.imageOpponent1);
        const awayImg = getTeamLogo(match.imageOpponent2);

        let timeContent;
        if (isLiveMatch(match)) {
          timeContent = buildLiveTimeContent(match);
        } else if (match.status === 'finished') {
          const rawScore = match.score || match.scoreLine || null;
          if (match.opponent1Score != null || match.opponent2Score != null) {
            timeContent = `<strong>${match.opponent1Score ?? 0} - ${match.opponent2Score ?? 0}</strong><span class="hightlights">Highlights</span>`;
          } else if (rawScore) {
            timeContent = `<strong>${rawScore}</strong><span class="hightlights">Highlights</span>`;
          } else {
            timeContent = `<strong>${displayDate}</strong><span class="hightlights">Highlights</span>`;
          }
        } else {
          timeContent = `<strong>${displayDate}</strong><span class="watch">Watch</span>`;
        }

        matchEl.innerHTML = `
          <div class="match__cricket">
            <div class="team">
              <div class="team__logo">${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}</div>
              <span>${homeTeamName}</span>
            </div>
            <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="time">${timeContent}</a>
            <div class="team team--2">
              <span>${awayTeamName}</span>
              <div class="team__logo"><img src="${awayImg}" alt="${awayTeamName}"></div>
            </div>
          </div>
          <div class="match-status">${match.status || 'Scheduled'}</div>
        `;

        leagueEl.appendChild(matchEl);
      });

      cricketContainer.appendChild(leagueEl);
    });
  } catch (error) {
    console.error("Error in renderCricket:", error);
    cricketContainer.innerHTML = "<p>Error rendering cricket matches</p>";
  }
}

// --- Баскетбол ---
async function loadBasketballMatches(dateStr) {
  if (!basketballContainer) return;
  // Если передана дата как строка, используем её, если объект Date - форматируем
  const dateToLoad = typeof dateStr === 'string' ? dateStr : formatDate(dateStr);
  console.log("Basketball load date:", dateToLoad);
  
  showLoadingAnimation(basketballContainer);
  try {
    const sportId = await getSportId('basketball');
    console.log("Basketball sportId:", sportId);
    if (!sportId) {
      hideLoadingAnimation(basketballContainer);
      basketballContainer.innerHTML = "<p>Basketball not available</p>";
      return;
    }

    const gtStart = Math.floor(new Date(dateToLoad).getTime() / 1000);
    const ltStart = Math.floor((new Date(dateToLoad).getTime() + 24 * 60 * 60 * 1000) / 1000);
    const todayIso = formatDate(new Date());
    const isPastDate = dateToLoad < todayIso;

    let rawItems;
    if (isPastDate) {
      try {
        const resultData = await fetchWithCache(
          `/api/results?sportId=${sportId}&dateFrom=${gtStart}&dateTo=${ltStart}&lng=en`,
          `${CACHE_KEYS.BASKETBALL}_results_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = (resultData.items || [])
          .filter(item => item.type === 1 || item.type == null)
          .map(item => {
            const { opponent1Score, opponent2Score } = parseScorePair(item);
            return { ...item, status: 'finished', opponent1Score, opponent2Score };
          });
      } catch (resultErr) {
        console.warn('Result API unavailable for basketball, falling back to prematch:', resultErr.message);
        const fallbackData = await fetchWithCache(
          `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
          `${CACHE_KEYS.BASKETBALL}_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = fallbackData.items || [];
      }
    } else {
      const data = await fetchWithCache(
        `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
        `${CACHE_KEYS.BASKETBALL}_${dateToLoad}`,
        { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
      );
      rawItems = data.items || [];
    }
    hideLoadingAnimation(basketballContainer);
    console.log("Basketball API response:", rawItems);
    if (rawItems.length) console.log("Basketball sample match:", rawItems[0]);

    const matches = rawItems.slice(0, 9);
    console.log(`Found ${matches.length} basketball matches`);
    if (matches.length === 0) {
      basketballContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }

    basketballContainer.innerHTML = "";

    // Group matches by league
    const leaguesMap = {};
    matches.forEach(match => {
      const leagueId = match.tournamentId || 'unknown';
      if (!leaguesMap[leagueId]) {
        const rawLogo = Array.isArray(match.tournamentImage) ? match.tournamentImage[0] : match.tournamentImage;
        leaguesMap[leagueId] = {
          league: { name: match.tournamentNameLocalization || 'Unknown League', logo: getTournamentLogo(rawLogo) },
          matches: []
        };
      }
      leaguesMap[leagueId].matches.push(match);
    });

    // Sort leagues by name and take first 3
    const leagues = Object.values(leaguesMap)
      .sort((a, b) => a.league.name.localeCompare(b.league.name))
      .slice(0, 3);

    leagues.forEach(leagueBlock => {
      const league = leagueBlock.league;
      const leagueMatches = leagueBlock.matches;

      if (!leagueMatches || leagueMatches.length === 0) return;

      // Sort matches by start time
      const sortedMatches = leagueMatches.slice().sort((a, b) => {
        const aTime = a.startDate || 0;
        const bTime = b.startDate || 0;
        return aTime - bTime;
      });

      const leagueEl = document.createElement('div');
      leagueEl.className = 'league';
      if (!isPastDate) {
        leagueEl.innerHTML = `
          <div class="league__header">
            <div class="league__logo">${league.logo ? `<img src="${league.logo}" alt="${league.name}" onerror="this.style.display='none'">` : ''}</div>
            <h2>${league.name}</h2>
          </div>
        `;
      }

      sortedMatches.forEach(match => {
        const matchEl = document.createElement('a');
        matchEl.className = 'match';
        matchEl.href = '#';
        
        const startTime = match.startDate || Date.now() / 1000;
        const matchDate = new Date(startTime * 1000);
        const displayTime = matchDate.toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '');
        
        const homeTeamName = match.opponent1NameLocalization || 'Unknown';
        const awayTeamName = match.opponent2NameLocalization || 'Unknown';
        const homeImg = getTeamLogo(match.imageOpponent1);
        const awayImg = getTeamLogo(match.imageOpponent2);

        // Show score for finished matches
        let timeContent;
        if (isLiveMatch(match)) {
          timeContent = buildLiveTimeContent(match);
        } else if (match.status === 'finished' && (match.opponent1Score != null || match.opponent2Score != null)) {
          timeContent = `<strong>${match.opponent1Score ?? 0} - ${match.opponent2Score ?? 0}</strong><span class="hightlights">Highlights</span>`;
        } else {
          timeContent = `${displayTime}<span class="watch">Watch</span>`;
        }
        
        matchEl.innerHTML = `
          <div class="team">
            <div class="team__logo">${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}</div>
            <span>${homeTeamName}</span>
          </div>
          <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="time">${timeContent}</a>
          <div class="team team--2">
            <span>${awayTeamName}</span>
            <div class="team__logo">${awayImg ? `<img src="${awayImg}" alt="${awayTeamName}" onerror="this.style.display='none'">` : ''}</div>
          </div>
        `;
        leagueEl.appendChild(matchEl);
      });

      basketballContainer.appendChild(leagueEl);
    });

  } catch (e) {
    hideLoadingAnimation(basketballContainer);
    console.error("Basketball fetch error:", e);
    basketballContainer.innerHTML = "<p>Error loading basketball matches. Please try again later.</p>";
  }
}

// --- Волейбол ---
async function loadVolleyballMatches(dateStr) {
  if (!volleyballContainer) return;
  // Если передана дата как строка, используем её, если объект Date - форматируем
  const dateToLoad = typeof dateStr === 'string' ? dateStr : formatDate(dateStr);
  console.log("Volleyball load date:", dateToLoad);
  
  showLoadingAnimation(volleyballContainer);
  try {
    const sportId = await getSportId('volleyball');
    console.log("Volleyball sportId:", sportId);
    if (!sportId) {
      hideLoadingAnimation(volleyballContainer);
      volleyballContainer.innerHTML = "<p>Volleyball not available</p>";
      return;
    }

    const gtStart = Math.floor(new Date(dateToLoad).getTime() / 1000);
    const ltStart = Math.floor((new Date(dateToLoad).getTime() + 24 * 60 * 60 * 1000) / 1000);
    const todayIso = formatDate(new Date());
    const isPastDate = dateToLoad < todayIso;

    let rawItems;
    if (isPastDate) {
      try {
        const resultData = await fetchWithCache(
          `/api/results?sportId=${sportId}&dateFrom=${gtStart}&dateTo=${ltStart}&lng=en`,
          `${CACHE_KEYS.VOLLEYBALL}_results_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = (resultData.items || [])
          .filter(item => item.type === 1 || item.type == null)
          .map(item => {
            const { opponent1Score, opponent2Score } = parseScorePair(item);
            return { ...item, status: 'finished', opponent1Score, opponent2Score };
          });
      } catch (resultErr) {
        console.warn('Result API unavailable for volleyball, falling back to prematch:', resultErr.message);
        const fallbackData = await fetchWithCache(
          `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
          `${CACHE_KEYS.VOLLEYBALL}_${dateToLoad}`,
          { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
        );
        rawItems = fallbackData.items || [];
      }
    } else {
      const data = await fetchWithCache(
        `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
        `${CACHE_KEYS.VOLLEYBALL}_${dateToLoad}`,
        { timeout: REQUEST_TIMEOUTS.HEAVY, retries: 1 }
      );
      rawItems = data.items || [];
    }
    hideLoadingAnimation(volleyballContainer);
    console.log("Volleyball API response:", rawItems);
    if (rawItems.length) console.log("Volleyball sample match:", rawItems[0]);

    const matches = rawItems.slice(0, 9);
    console.log(`Found ${matches.length} volleyball matches`);
    console.log(`Found ${matches.length} volleyball matches`);
    if (matches.length === 0) {
      volleyballContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }

    volleyballContainer.innerHTML = "";

    // Group matches by league
    const leaguesMap = {};
    matches.forEach(match => {
      const leagueId = match.tournamentId || 'unknown';
      if (!leaguesMap[leagueId]) {
        const rawLogo = Array.isArray(match.tournamentImage) ? match.tournamentImage[0] : match.tournamentImage;
        leaguesMap[leagueId] = {
          league: { name: match.tournamentNameLocalization || 'Unknown League', logo: getTournamentLogo(rawLogo) },
          matches: []
        };
      }
      leaguesMap[leagueId].matches.push(match);
    });

    // Sort leagues by name and take first 3
    const leagues = Object.values(leaguesMap)
      .sort((a, b) => a.league.name.localeCompare(b.league.name))
      .slice(0, 3);

    leagues.forEach(leagueBlock => {
      const league = leagueBlock.league;
      const leagueMatches = leagueBlock.matches;
      if (!leagueMatches || leagueMatches.length === 0) return;

      // Sort matches by start time
      const sortedMatches = leagueMatches.slice().sort((a, b) => {
        const aTime = a.startDate || 0;
        const bTime = b.startDate || 0;
        return aTime - bTime;
      });

      const leagueEl = document.createElement('div');
      leagueEl.className = 'league';
      if (!isPastDate) {
        leagueEl.innerHTML = `
          <div class="league__header">
            <div class="league__logo">${league.logo ? `<img src="${league.logo}" alt="${league.name}" onerror="this.style.display='none'">` : ''}</div>
            <h2>${league.name}</h2>
          </div>
        `;
      }

      sortedMatches.forEach(match => {
        const matchEl = document.createElement('a');
        matchEl.className = 'match';
        matchEl.href = '#';
        
        const startTime = match.startDate || Date.now() / 1000;
        const matchDate = new Date(startTime * 1000);
        const displayTime = matchDate.toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '');
        
        const homeTeamName = match.opponent1NameLocalization || 'Unknown';
        const awayTeamName = match.opponent2NameLocalization || 'Unknown';
        const homeImg = getTeamLogo(match.imageOpponent1);
        const awayImg = getTeamLogo(match.imageOpponent2);

        // Show score for finished matches
        let timeContent;
        if (isLiveMatch(match)) {
          timeContent = buildLiveTimeContent(match);
        } else if (match.status === 'finished' && (match.opponent1Score != null || match.opponent2Score != null)) {
          timeContent = `<strong>${match.opponent1Score ?? 0} - ${match.opponent2Score ?? 0}</strong><span class="hightlights">Highlights</span>`;
        } else {
          timeContent = `${displayTime}<span class="watch">Watch</span>`;
        }
        
        matchEl.innerHTML = `
          <div class="team">
            <div class="team__logo">${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}</div>
            <span>${homeTeamName}</span>
          </div>
          <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="time">${timeContent}</a>
          <div class="team team--2">
            <span>${awayTeamName}</span>
            <div class="team__logo">${awayImg ? `<img src="${awayImg}" alt="${awayTeamName}" onerror="this.style.display='none'">` : ''}</div>
          </div>
        `;
        leagueEl.appendChild(matchEl);
      });

      volleyballContainer.appendChild(leagueEl);
    });

  } catch (e) {
    hideLoadingAnimation(volleyballContainer);
    console.error("Volleyball fetch error:", e);
    volleyballContainer.innerHTML = "<p>Error loading volleyball matches. Please try again later.</p>";
  }
}

// --- eSports ---
async function loadEsportsMatches(dateStr) {
  if (!esportsContainer) return;
  const dateToLoad = typeof dateStr === 'string' ? dateStr : formatDate(dateStr);
  console.log('eSports load date:', dateToLoad);

  showLoadingAnimation(esportsContainer);
  try {
    const sportId = await getSportId('esports');
    console.log('eSports sportId:', sportId);
    if (!sportId) {
      hideLoadingAnimation(esportsContainer);
      esportsContainer.innerHTML = '<p>eSports not available</p>';
      return;
    }

    const gtStart = Math.floor(new Date(dateToLoad).getTime() / 1000);
    const ltStart = Math.floor((new Date(dateToLoad).getTime() + 24 * 60 * 60 * 1000) / 1000);
    const todayIso = formatDate(new Date());
    const isPastDate = dateToLoad < todayIso;

    let rawItems;
    const data = await fetchWithCache(
      `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&count=250&lng=en`,
      `${CACHE_KEYS.ESPORTS}_${dateToLoad}`,
      { timeout: 15000, retries: 0, quiet: true }
    );
    rawItems = data.items || [];

    if (isPastDate) {
      rawItems = rawItems.map(item => {
        const { opponent1Score, opponent2Score } = parseScorePair(item);
        return { ...item, status: 'finished', opponent1Score, opponent2Score };
      });
    }

    hideLoadingAnimation(esportsContainer);
    console.log('eSports API response:', rawItems);
    if (rawItems.length) console.log('eSports sample match:', rawItems[0]);

    const matches = rawItems.slice(0, 9);
    console.log(`Found ${matches.length} esports matches`);
    if (matches.length === 0) {
      esportsContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }

    esportsContainer.innerHTML = '';

    const leaguesMap = {};
    matches.forEach(match => {
      const leagueId = match.tournamentId || 'unknown';
      if (!leaguesMap[leagueId]) {
        const rawLogo = Array.isArray(match.tournamentImage) ? match.tournamentImage[0] : match.tournamentImage;
        leaguesMap[leagueId] = {
          league: { name: match.tournamentNameLocalization || 'Unknown League', logo: getTournamentLogo(rawLogo) },
          matches: []
        };
      }
      leaguesMap[leagueId].matches.push(match);
    });

    const leagues = Object.values(leaguesMap)
      .sort((a, b) => a.league.name.localeCompare(b.league.name))
      .slice(0, 3);

    leagues.forEach(leagueBlock => {
      const league = leagueBlock.league;
      const leagueMatches = leagueBlock.matches;
      if (!leagueMatches || leagueMatches.length === 0) return;

      const sortedMatches = leagueMatches.slice().sort((a, b) => {
        const aTime = a.startDate || 0;
        const bTime = b.startDate || 0;
        return aTime - bTime;
      });

      const leagueEl = document.createElement('div');
      leagueEl.className = 'league';
      if (!isPastDate) {
        leagueEl.innerHTML = `
          <div class="league__header">
            <div class="league__logo">${league.logo ? `<img src="${league.logo}" alt="${league.name}" onerror="this.style.display='none'">` : ''}</div>
            <h2>${league.name}</h2>
          </div>
        `;
      }

      sortedMatches.forEach(match => {
        const matchEl = document.createElement('a');
        matchEl.className = 'match';
        matchEl.href = '#';

        const startTime = match.startDate || Date.now() / 1000;
        const matchDate = new Date(startTime * 1000);
        const displayTime = matchDate.toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '');

        const homeTeamName = match.opponent1NameLocalization || 'Unknown';
        const awayTeamName = match.opponent2NameLocalization || 'Unknown';
        const homeImg = getTeamLogo(match.imageOpponent1);
        const awayImg = getTeamLogo(match.imageOpponent2);

        let timeContent;
        if (isLiveMatch(match)) {
          timeContent = buildLiveTimeContent(match);
        } else if (match.status === 'finished' && (match.opponent1Score != null || match.opponent2Score != null)) {
          timeContent = `<strong>${match.opponent1Score ?? 0} - ${match.opponent2Score ?? 0}</strong><span class="hightlights">Highlights</span>`;
        } else {
          timeContent = `${displayTime}<span class="watch">Watch</span>`;
        }

        matchEl.innerHTML = `
          <div class="team">
            <div class="team__logo">${homeImg ? `<img src="${homeImg}" alt="${homeTeamName}" onerror="this.style.display='none'">` : ''}</div>
            <span>${homeTeamName}</span>
          </div>
          <a href="${match.link || AFFILIATE_LINK}" target="_blank" class="time">${timeContent}</a>
          <div class="team team--2">
            <span>${awayTeamName}</span>
            <div class="team__logo">${awayImg ? `<img src="${awayImg}" alt="${awayTeamName}" onerror="this.style.display='none'">` : ''}</div>
          </div>
        `;
        leagueEl.appendChild(matchEl);
      });

      esportsContainer.appendChild(leagueEl);
    });
  } catch (e) {
    hideLoadingAnimation(esportsContainer);
    console.warn('eSports fetch fallback:', e.message || e);
    esportsContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
  }
}

// Функция загрузки и отображения таблицы


// Функция для принудительного обновления кеша (можно вызвать из консоли)
function clearCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('Cache cleared');
  location.reload();
}

// Функция для отладки ID видов спорта
async function debugSportIds() {
  console.log('=== DEBUG: Sport IDs from API ===');
  try {
    const sports = await getSports();
    console.log('Sports from API:', sports);
    
    const sportsToCheck = ['football', 'cricket', 'basketball', 'volleyball'];
    for (const sport of sportsToCheck) {
      const id = await getSportId(sport);
      console.log(`${sport}: ${id} (${id === SPORT_ID_OVERRIDES[sport] ? 'USING OVERRIDE' : 'FROM API'})`);
    }
  } catch (error) {
    console.error('Error debugging sport IDs:', error);
  }
  console.log('=== END DEBUG ===');
}

// ---------------------------------------------------------------------------
// Teams section: collect unique teams from today's matches across all 4 sports
// and populate #teamsLogos. Topic filter buttons (#teamsTopics) filter by sport.
// ---------------------------------------------------------------------------

// In-memory store for team cards split by sport
const _teamsBySport = { football: [], cricket: [], basketball: [], volleyball: [] };
let _activeTeamSport = 'all';

function renderTeamLogos(filter) {
  const container = document.getElementById('teamsLogos');
  if (!container) return;

  container.innerHTML = '';

  const sportsToShow = (filter && filter !== 'all')
    ? [filter]
    : Object.keys(_teamsBySport);

  sportsToShow.forEach(sport => {
    (_teamsBySport[sport] || []).forEach(team => {
      const item = document.createElement('div');
      item.className = 'teams__item';
      item.dataset.sport = sport;
      item.innerHTML = `
        <img src="${team.logo}" alt="${team.name}" title="${team.name}"
             onerror="this.src='/images/default-team.png'">
      `;

      item.addEventListener('click', () => {
        const redirectUrl = team.link || AFFILIATE_LINK;
        if (typeof window.openRedirectPopup === 'function') {
          window.openRedirectPopup(redirectUrl);
          return;
        }
        window.location.href = redirectUrl;
      });

      container.appendChild(item);
    });
  });

  if (!container.children.length) {
    container.innerHTML = '<p style="padding:16px;opacity:.6">No teams available</p>';
  }
}

function collectTeamsFromMatches(sportKey, items) {
  const seen = new Set();
  const teams = [];
  (items || []).forEach(item => {
    const pairs = [
      { name: item.opponent1NameLocalization, img: Array.isArray(item.imageOpponent1) ? item.imageOpponent1[0] : item.imageOpponent1 },
      { name: item.opponent2NameLocalization, img: Array.isArray(item.imageOpponent2) ? item.imageOpponent2[0] : item.imageOpponent2 },
    ];
    pairs.forEach(({ name, img }) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      teams.push({ name, logo: getTeamLogo(img), link: item.link || AFFILIATE_LINK });
    });
  });
  _teamsBySport[sportKey] = teams;
}

async function loadTeamsLogos() {
  const todayStr = formatDate(new Date());
  const dayStart = new Date(todayStr);
  dayStart.setHours(0, 0, 0, 0);
  const gtStart = Math.floor(dayStart.getTime() / 1000);
  const ltStart = gtStart + 24 * 3600;

  const sportKeys = ['football', 'cricket', 'basketball', 'esports', 'volleyball'];

  await Promise.allSettled(sportKeys.map(async sport => {
    try {
      const sportId = await getSportId(sport);
      if (!sportId) return;
      const data = await fetchWithCache(
        `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`,
        `teams_today_${sport}_${todayStr}`,
        { timeout: REQUEST_TIMEOUTS.NORMAL, retries: 1 }
      );
      if (data && Array.isArray(data.items)) {
        collectTeamsFromMatches(sport, data.items);
      }
    } catch (e) {
      console.warn(`Teams: failed to load ${sport}`, e);
    }
  }));

  renderTeamLogos(_activeTeamSport);

  // Wire up topic filter buttons
  const topicsContainer = document.getElementById('teamsTopics');
  if (topicsContainer) {
    topicsContainer.addEventListener('click', e => {
      const btn = e.target.closest('[data-i18n]');
      if (!btn) return;

      // Map i18n key to sport key
      const keyMap = {
        'teams.topic.football': 'football',
        'teams.topic.cricket': 'cricket',
        'teams.topic.basketball': 'basketball',
        'teams.topic.volleyball': 'volleyball',
        'teams.topic.esports': 'all',
        'teams.topic.tennis': 'all',
        'teams.topic.mma': 'all',
      };
      const i18nKey = btn.getAttribute('data-i18n') || '';
      _activeTeamSport = keyMap[i18nKey] || 'all';

      // Update active class
      topicsContainer.querySelectorAll('[data-i18n]').forEach(b => {
        b.classList.remove('news__topic--selected', 'teams__topic--selected');
      });
      btn.classList.add('news__topic--selected');

      renderTeamLogos(_activeTeamSport);
    });
  }
}

// Загружаем логотипы команд
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    loadTeamsLogos().catch(err => console.warn('Failed to load teams logos:', err));
  }, 1500);
});

// Добавляем глобальные функции для отладки
window.clearCache = clearCache;
window.debugSportIds = debugSportIds;