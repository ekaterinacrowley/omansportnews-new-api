const footballContainer = document.getElementById('footballLeagues');
const cricketContainer = document.getElementById('cricketLeagues');
const basketballContainer = document.getElementById('basketballLeagues');
const volleyballContainer = document.getElementById('volleyballLeagues');

// Определяем язык на основе атрибута lang HTML
const lng = document.documentElement.lang === 'ru' ? 'ru' : 'en';

// Храним текущие даты для каждого вида спорта
let currentDates = {
  football: formatDate(new Date()),
  cricket: formatDate(new Date()),
  basketball: formatDate(new Date()),
  volleyball: formatDate(new Date())
};

// Константы для кеширования
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const CACHE_KEYS = {
  FOOTBALL: 'football_matches',
  CRICKET: 'cricket_matches', 
  BASKETBALL: 'basketball_matches',
  VOLLEYBALL: 'volleyball_matches',
  STANDINGS: 'football_standings',
  SPORTS: 'sports_list'
};

let sportsCache = null;
const sportIdCache = {}; 


const SPORT_ID_OVERRIDES = {
  football: 1,
  basketball: 3,
  volleyball: 6,
  cricket: 66,
};

async function getSports() {
  if (sportsCache) return sportsCache;
  
  try {
    const data = await fetchWithCache('/api/sports', CACHE_KEYS.SPORTS, { timeout: 5000 });
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
    text.textContent = 'Загружаем данные...';
    
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
async function getAvailableDatesForSport(sportId, rangeDays = { past: 7, future: 7 }) {
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
    const data = await fetchWithCache(`/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=${lng}`, `availableDates_${sportId}_${gtStart}_${ltStart}`, { timeout: 5000 });
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
    // Сортируем так, чтобы сегодня был первым
    const todayIdx = sorted.indexOf(todayIso);
    if (todayIdx > 0) {
      const ordered = sorted.slice(todayIdx).concat(sorted.slice(0, todayIdx));
      availableDatesCache[sportId] = ordered;
    } else {
      availableDatesCache[sportId] = sorted;
    }
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

  // Упорядочиваем: сегодня -> будущее -> прошлое
  const todayIso = fixedDates.today;
  dateKeys = [...new Set(dateKeys)];
  dateKeys.sort();
  const todayIdx = dateKeys.indexOf(todayIso);
  if (todayIdx > 0) {
    dateKeys = dateKeys.slice(todayIdx).concat(dateKeys.slice(0, todayIdx));
  }

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
  const { timeout = 10000 } = options; // таймаут по умолчанию 10 секунд

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

    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${url} after ${timeout}ms`);
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

async function loadMatches() {
  try {
    await Promise.allSettled([
      loadFootballMatches(currentDates.football),
      loadCricketMatches(currentDates.cricket), 
      loadBasketballMatches(currentDates.basketball),
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

    const url = isPastDate
      ? `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`
      : `/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=${lng}`;

    const cacheKey = isPastDate
      ? `${CACHE_KEYS.FOOTBALL}_results_${dateToLoad}`
      : `${CACHE_KEYS.FOOTBALL}_${dateToLoad}`;

    console.log("Football dateToLoad:", dateToLoad, "gtStart:", gtStart, "ltStart:", ltStart, "url:", url);

    const data = await fetchWithCache(url, cacheKey, { timeout: 15000 });
    hideLoadingAnimation(footballContainer);
    console.log("Football API response:", data);

    const items = Array.isArray(data.items) ? data.items : [];

    if (!items.length) {
      console.log("No matches found for", dateToLoad);
      footballContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }

    const mapped = items.map(item => {
      const score = item.score || item.scoreLine || null;
      let opponent1Score = item.homeScore || item.opponent1Score || null;
      let opponent2Score = item.awayScore || item.opponent2Score || null;
      if (!opponent1Score && !opponent2Score && score && typeof score === 'string') {
        const parts = score.split(' ')[0].split(':');
        if (parts.length === 2) {
          opponent1Score = parseInt(parts[0], 10);
          opponent2Score = parseInt(parts[1], 10);
        }
      }

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

    renderFootball(mapped);
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

function renderFootball(matches) {
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
    if (!leaguesMap[leagueId]) leaguesMap[leagueId] = { league: { name: event.tournamentNameLocalization || 'Unknown League', logo: '/images/default-league.png' }, events: [] };
    leaguesMap[leagueId].events.push(event);
  });

  const filteredLeagues = Object.keys(leaguesMap).length;

  if (filteredLeagues < 3) {
    const additionalMatches = matches.filter(event => {
      const leagueId = event.tournamentId || 'unknown';
      return !leaguesMap[leagueId];
    }).slice(0, 3 - filteredLeagues);
    filtered = [...filtered, ...additionalMatches];
  }

  filtered.forEach(event => {
    const leagueId = event.tournamentId || 'unknown';
    if (!leaguesMap[leagueId]) leaguesMap[leagueId] = { league: { name: event.tournamentNameLocalization || 'Unknown League', logo: '/images/default-league.png' }, events: [] };
    leaguesMap[leagueId].events.push(event);
  });

  // Сортировка лиг по имени
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
    leagueEl.innerHTML = `<div class="league__header"><div class="league__logo"><img src="${league.logo}" alt="${league.name}"></div><h2>${league.name}</h2></div>`;
    
    // Сортировка матчей по времени
    events.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    
    events.forEach(event => {
      const startTime = event.startDate || Date.now() / 1000;
      const matchDate = new Date(startTime * 1000);
      const isLive = event.status === 'in_progress' || event.status === 'live';
      let displayTime;
      if (isLive) {
        displayTime = `<span class="live">LIVE</span><strong>${event.opponent1Score ?? 0} - ${event.opponent2Score ?? 0}</strong><span class="watch">Watch</span>`;
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
      const homeImg = homeTeamName !== 'Unknown' ? `/api/img/${homeTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
      const awayImg = awayTeamName !== 'Unknown' ? `/api/img/${awayTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
      
      matchEl.innerHTML = `<div class="team"><div class="team__logo"><img src="${homeImg}" alt="${homeTeamName}"></div><span>${homeTeamName}</span></div><a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="time">${displayTime}</a><div class="team team--2"><span>${awayTeamName}</span><div class="team__logo"><img src="${awayImg}" alt="${awayTeamName}"></div></div>`;
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
  text.textContent = 'Загружаем завтрашние матчи...';
  
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
      const startTime = match.startTime || Date.now() / 1000;
      const matchDate = new Date(startTime * 1000);
      const formattedDate = matchDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      const homeTeamName = match.homeTeamName || 'Unknown';
      const awayTeamName = match.awayTeamName || 'Unknown';
      const homeImg = homeTeamName !== 'Unknown' ? `/api/img/${homeTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
      const awayImg = awayTeamName !== 'Unknown' ? `/api/img/${awayTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
      
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      const lang = (document.body && document.body.getAttribute('data-lang')) || localStorage.getItem('siteLang') || 'en';

      slide.innerHTML = `
        <div class="slide">
          <div class="slide__content">
            <div class="slide__teams">
              <div class="slide__team">
                <img src="${homeImg}" alt="${homeTeamName}">
              </div>
              <div class="slide__match">
                <div class="slide__match-title">${homeTeamName} vs ${awayTeamName}</div>
                <div class="slide__match-date">${formattedDate}</div>
                <div class="slide__match-scores">
                  <span>2.35</span>
                  <span>3.10</span>
                  <span>2.80</span>
                </div>
              </div>
              <div class="slide__team">
                <img src="${awayImg}" alt="${awayTeamName}">
              </div>
            </div>
            <div class="slide__mobile">
              <div>${homeTeamName}</div> 
              <span>${formattedDate}</span> 
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
              <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="slide__btn slide__btn--1">${tSlider('slider.watchPlay', lang)}</a>
              <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="slide__btn slide__btn--2">${tSlider('slider.remind', lang)}</a>
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

    const data = await fetchWithCache(`/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`, `${CACHE_KEYS.CRICKET}_${dateToLoad}`, { timeout: 15000 });
    hideLoadingAnimation(cricketContainer);
    console.log("Cricket API response:", data);
    
    if (!data.items || data.items.length === 0) {
      console.log("No cricket matches found for", dateToLoad);
      cricketContainer.innerHTML = `<p>No matches for ${formatDateDisplay(dateToLoad)}</p>`;
      return;
    }
    
    console.log(`Found ${data.items.length} cricket matches, rendering`);
    renderCricket(data.items, dateToLoad);
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

function renderCricket(matches, selectedDate) {
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
      const leagueLogo = '/images/default-league.png';

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
      leagueEl.innerHTML = `
        <div class="league__header">
          <div class="league__logo"><img src="${leagueBlock.league.logo}" alt="${leagueBlock.league.name}"></div>
          <h2>${leagueBlock.league.name}</h2>
        </div>
      `;

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
        const homeImg = homeTeamName !== 'Unknown' ? `/api/img/${homeTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
        const awayImg = awayTeamName !== 'Unknown' ? `/api/img/${awayTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';

        matchEl.innerHTML = `
          <div class="match__cricket">
            <div class="team">
              <div class="team__logo"><img src="${homeImg}" alt="${homeTeamName}"></div>
              <span>${homeTeamName}</span>
            </div>
            <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="time"><strong>${displayDate}</strong><span class="watch">Watch</span></a>
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

    const data = await fetchWithCache(`/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`, `${CACHE_KEYS.BASKETBALL}_${dateToLoad}`, { timeout: 15000 });
    hideLoadingAnimation(basketballContainer);
    console.log("Basketball API response:", data);
    if (Array.isArray(data.items) && data.items.length) {
      console.log("Basketball sample match:", data.items[0]);
    }

    const matches = Array.isArray(data.items) ? data.items.slice(0, 9) : [];
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
        leaguesMap[leagueId] = {
          league: { name: match.tournamentNameLocalization || 'Unknown League', logo: '/images/default-league.png' },
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
      leagueEl.innerHTML = `
        <div class="league__header">
          <div class="league__logo"><img src="${league.logo}" alt="${league.name}"></div>
          <h2>${league.name}</h2>
        </div>
      `;

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
        const homeImg = homeTeamName !== 'Unknown' ? `/api/img/${homeTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
        const awayImg = awayTeamName !== 'Unknown' ? `/api/img/${awayTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
        
        matchEl.innerHTML = `
          <div class="team">
            <div class="team__logo"><img src="${homeImg}" alt="${homeTeamName}"></div>
            <span>${homeTeamName}</span>
          </div>
          <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="time">${displayTime}<span class="watch">Watch</span></a>
          <div class="team team--2">
            <span>${awayTeamName}</span>
            <div class="team__logo"><img src="${awayImg}" alt="${awayTeamName}"></div>
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

    const data = await fetchWithCache(`/api/events?sportId=${sportId}&gtStart=${gtStart}&ltStart=${ltStart}&lng=en`, `${CACHE_KEYS.VOLLEYBALL}_${dateToLoad}`, { timeout: 15000 });
    hideLoadingAnimation(volleyballContainer);
    console.log("Volleyball API response:", data);
    if (Array.isArray(data.items) && data.items.length) {
      console.log("Volleyball sample match:", data.items[0]);
    }

    const matches = Array.isArray(data.items) ? data.items.slice(0, 9) : [];
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
        leaguesMap[leagueId] = {
          league: { name: match.tournamentNameLocalization || 'Unknown League', logo: '/images/default-league.png' },
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
      leagueEl.innerHTML = `
        <div class="league__header">
          <div class="league__logo"><img src="${league.logo}" alt="${league.name}"></div>
          <h2>${league.name}</h2>
        </div>
      `;

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
        const homeImg = homeTeamName !== 'Unknown' ? `/api/img/${homeTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
        const awayImg = awayTeamName !== 'Unknown' ? `/api/img/${awayTeamName.replace(/\s+/g, '').toLowerCase()}.png` : '/images/default-team.png';
        
        matchEl.innerHTML = `
          <div class="team">
            <div class="team__logo"><img src="${homeImg}" alt="${homeTeamName}"></div>
            <span>${homeTeamName}</span>
          </div>
          <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="time">${displayTime}<span class="watch">Watch</span></a>
          <div class="team team--2">
            <span>${awayTeamName}</span>
            <div class="team__logo"><img src="${awayImg}" alt="${awayTeamName}"></div>
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

// Функция загрузки и отображения таблицы
async function loadStandings(league = 39, season = 2023, containerId = 'leagueTable') {
   const container = document.getElementById(containerId);
   if (!container) return;
   container.innerHTML = '<p>Loading...</p>';

   try {
     const data = await fetchWithCache(
       `/api/results-sports?leagueId=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
       `${CACHE_KEYS.STANDINGS}_${league}_${season}`,
       { timeout: 15000 }
     );
     
     console.log('Standings response:', data);

     if (!data.items || data.items.length === 0) {
       container.innerHTML = '<p>No standings data available</p>';
       return;
     }

     // Создаём таблицу
     const table = document.createElement('div');
     table.className = 'tab__content';

     const thead = document.createElement('div');
     thead.className = 'tab__head';
     thead.innerHTML = `
         <div class="tab__club">
            <div>#</div>
            <div>Club</div>
         </div>
          <div class="tab__digits">
            <div>W</div>
            <div>D</div>
            <div>L</div>
            <div>Poin</div>
         </div>
         <div>Last Match</div>
     `;
     table.appendChild(thead);

     const tbody = document.createElement('div');
     tbody.className = 'tab__body';

     // Создаём контейнер для логотипов в отдельном месте
     const logosContainer = document.getElementById('teamsLogos');
     if (logosContainer) {
       logosContainer.innerHTML = ''; // Очищаем контейнер перед добавлением
       
       // Заполняем логотипы
       data.items.forEach(row => {
         const teamName = row.teamName || row.team || '';
         if (teamName) {
           const logoElement = document.createElement('div');
           logoElement.className = 'teams__item';
           logoElement.innerHTML = `
             <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank"><img src="/api/img/${teamName.replace(/\s+/g, '').toLowerCase()}.png" 
                  alt="${teamName}" 
                  title="${teamName}"></a>
           `;
           logosContainer.appendChild(logoElement);
         }
       });
     }

     data.items.forEach(row => {
       // Попытка достать подробную статистику
       const win = row.wins ?? row.win ?? '';
       const draw = row.draws ?? row.draw ?? '';
       const lose = row.losses ?? row.lose ?? '';
       const points = row.points ?? row.pts ?? '';
       const form = row.form ?? '';

       // Преобразуем форму в цветные span'ы
       let formHTML = '';
       if (form) {
         formHTML = form.split('').map(char => {
           let className = '';
           switch(char) {
             case 'W':
               className = 'win';
               break;
             case 'D':
               className = 'draw';
               break;
             case 'L': 
               className = 'lose';
               break;
             default:
               className = '';
           }
           return `<span class="form-badge ${className}">${char}</span>`;
         }).join('');
       }

       const tr = document.createElement('div');
       tr.className = "tab__row";
       tr.innerHTML = `
         <div class="tab__club">
         <div>${row.position ?? row.rank ?? ''}</div>
         <div class="tab__team">
           <div class="tab__team-name">${row.teamName ?? row.team ?? ''}</div>
         </div> 
         </div>
         <div class="tab__digits">
            <div>${win}</div>
            <div>${draw}</div>
            <div>${lose}</div>
            <div>${points}</div>
         </div>
         <div class="tab__form">${formHTML}</div>
       `;
       tbody.appendChild(tr);
     });

     table.appendChild(tbody);

     container.innerHTML = '';
     const header = document.createElement('div');
     header.className = 'tab__header';
     
     header.innerHTML = `
       <div class="tab__league">Standings — ${season}</div>
       <a href="https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599" target="_blank" class="tab__link">View All</a>
     `;
     
     container.appendChild(header);
     container.appendChild(table);

   } catch (err) {
     console.error('Error loading standings:', err);
     container.innerHTML = '<p>Error loading standings. Please try again later.</p>';
   }
}

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

// Загружаем турнирную таблицу с обработкой ошибок
document.addEventListener('DOMContentLoaded', function() {
  // Загружаем таблицу с задержкой, чтобы не перегружать API
  setTimeout(() => {
    loadStandings(39, 2023).catch(err => {
      console.warn('Failed to load standings:', err);
    });
  }, 1000);
});

// Добавляем глобальные функции для отладки
window.clearCache = clearCache;
window.debugSportIds = debugSportIds;