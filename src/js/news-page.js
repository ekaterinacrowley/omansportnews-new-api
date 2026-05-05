// Загружает и отображает новости по выбранной теме для страницы /news.
// Вызов: клик по теме -> fetch /news?q=ТЕМА

// topics будет загружаться из `src/i18n/translations.json` на основе текущего языка
let topics = [];
let currentActiveLang = null;

function getCurrentLang() {
  const lang = document.body.getAttribute('data-lang') || localStorage.getItem('siteLang') || 'en';
  console.log('getCurrentLang returned:', lang);
  return lang;
}

async function loadTopicsFromTranslations() {
  const STORAGE_KEY = 'siteLang';
  const lang = document.body.getAttribute('data-lang') || localStorage.getItem(STORAGE_KEY) || 'en';

  // Попробуем несколько путей (корень, относительный)
  const candidates = [
    '/i18n/translations.json',
    window.location.pathname.replace(/[^/]*$/, '') + 'i18n/translations.json',
    'i18n/translations.json',
    './i18n/translations.json'
  ];

  let translations = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      translations = await res.json();
      break;
    } catch (e) {
      // try next
    }
  }

  if (translations && translations[lang] && Array.isArray(translations[lang]['news.topics'])) {
    topics = translations[lang]['news.topics'];
  } else if (translations && translations['en'] && Array.isArray(translations['en']['news.topics'])) {
    topics = translations['en']['news.topics'];
  } else {
    // Fallback — английский набор
    topics = ['All', 'Football', 'Cricket', 'eSports', 'Basketball', 'Volleyball', 'Tennis', 'MMA', 'Highlights', 'Trending'];
  }
}

const topicsContainer = document.getElementById('newsTopics');
const newsContainer = document.getElementById('newsContainer');

// Для страницы новостей снимаем ограничение на количество
const MAX_NEWS_ITEMS = Infinity; // Без ограничения

// Константы для кеширования
const CACHE_DURATION_NEWS = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const CACHE_KEYS_NEWS = {
  NEWS_ALL: 'news_all',
  NEWS_FOOTBALL: 'news_football',
  NEWS_CRICKET: 'news_cricket',
  NEWS_ESPORTS: 'news_esports',
  NEWS_BASKETBALL: 'news_basketball',
  NEWS_VOLLEYBALL: 'news_volleyball',
  NEWS_TENNIS: 'news_tennis',
  NEWS_MMA: 'news_mma',
  NEWS_HIGHLIGHTS: 'news_highlights',
  NEWS_TRENDING: 'news_trending'
};

// Уникальная ссылка и target для всех кастомных новостей
const CUSTOM_NEWS_LINK = 'https://reffpa.com/L?tag=d_5453931m_1599c_&site=5453931&ad=1599';
const CUSTOM_NEWS_TARGET = '_blank';
let customNewsStore = null;

async function fetchJsonByCandidates(filename) {
  const cacheBust = Math.floor(Date.now() / (60 * 60 * 1000));
  const candidates = [];
  const newsScript = Array.from(document.scripts).find(s => s.src && s.src.includes('news-page.js'));
  if (newsScript) {
    const scriptBase = newsScript.src.replace(/\/[^/]*$/, '/');
    candidates.push(scriptBase + `i18n/${filename}`);
    candidates.push(scriptBase.replace(/\/js\/$/, '/') + `i18n/${filename}`);
  }

  candidates.push(window.location.origin + `/i18n/${filename}`);
  candidates.push(window.location.pathname.replace(/[^/]*$/, '') + `i18n/${filename}`);
  candidates.push(`i18n/${filename}`);
  candidates.push(`./i18n/${filename}`);

  console.log('Trying to load', filename, 'from candidates:', candidates);

  for (const url of candidates) {
    try {
      console.log('Trying URL:', url);
      const separator = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${separator}v=${cacheBust}`, { cache: 'no-store' });
      if (!res.ok) {
        console.log('URL failed with status:', res.status, url);
        continue;
      }
      console.log('Successfully loaded from:', url);
      return await res.json();
    } catch (e) {
      console.log('Error fetching from', url, ':', e.message);
      // try next
    }
  }

  console.log('Failed to load', filename, 'from all candidates');
  return null;
}

function normalizeCustomNewsItem(item) {
  return {
    title: item.title || '',
    description: item.description || '',
    imageUrl: item.imageUrl || '/images/news-image.webp',
    url: CUSTOM_NEWS_LINK,
    target: CUSTOM_NEWS_TARGET,
    isCustom: true
  };
}

async function getCustomNews(lang) {
  console.log('getCustomNews called with lang:', lang);
  if (!customNewsStore) {
    console.log('Loading custom news store...');
    customNewsStore = await fetchJsonByCandidates('custom-news.json') || {};
    console.log('Custom news store loaded:', customNewsStore);
  }

  const rawItems = customNewsStore[lang] || customNewsStore['en'] || [];
  console.log('Raw items for lang', lang, ':', rawItems);
  if (!Array.isArray(rawItems)) return [];
  const normalized = rawItems.map(normalizeCustomNewsItem);
  console.log('Normalized custom news:', normalized);
  return normalized;
}

function getDayOfWeekIndices() {
  // 0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота
  const dayOfWeek = new Date().getDay();
  console.log('Current day of week:', dayOfWeek);
  
  // Возвращаем индексы (0-based) двух новостей для текущего дня
  // Воскресенье (0): 7 и 1 -> индексы 6 и 0
  // Понедельник (1): 1 и 2 -> индексы 0 и 1
  // Вторник (2): 2 и 3 -> индексы 1 и 2
  // Среда (3): 3 и 4 -> индексы 2 и 3
  // Четверг (4): 4 и 5 -> индексы 3 и 4
  // Пятница (5): 5 и 6 -> индексы 4 и 5
  // Суббота (6): 6 и 7 -> индексы 5 и 6
  
  if (dayOfWeek === 0) {
    return [6, 0]; // Воскресенье: 7 и 1
  }
  return [dayOfWeek - 1, dayOfWeek]; // Остальные дни
}

function selectNewsForToday(customArticles) {
  if (!Array.isArray(customArticles) || customArticles.length < 7) {
    console.log('Not enough custom articles, expected 7, got', customArticles?.length || 0);
    return customArticles.slice(0, 2); // Возвращаем первые 2, если их меньше
  }
  
  const [idx1, idx2] = getDayOfWeekIndices();
  const selected = [customArticles[idx1], customArticles[idx2]];
  console.log('Selected news for today at indices', idx1, idx2, ':', selected.map(a => a.title));
  return selected;
}

function mergeCustomNews(articles, customArticles) {
  console.log('mergeCustomNews called with articles:', articles?.length || 0, 'custom:', customArticles?.length || 0);
  if (!Array.isArray(customArticles) || customArticles.length === 0) {
    console.log('No custom articles to merge');
    return articles;
  }
  if (!Array.isArray(articles)) articles = [];
  if (articles.some(a => a.isCustom)) {
    console.log('Articles already contain custom news');
    return articles;
  }

  // Выбираем только 2 новости для текущего дня
  const selectedCustom = selectNewsForToday(customArticles);
  const reservedPositions = [1, 6]; // вставляем на 2-ю и 7-ю позиции (0-based индексы)
  const toInsert = selectedCustom.slice(0, reservedPositions.length);
  console.log('Will insert custom articles at positions:', reservedPositions, 'items:', toInsert.length);
  if (articles.length === 0) {
    const result = toInsert.slice(0, MAX_NEWS_ITEMS);
    console.log('No regular articles, returning custom only:', result.length);
    return result;
  }

  const result = [];
  let originalIndex = 0;
  let customIndex = 0;

  for (let i = 0; i < MAX_NEWS_ITEMS; i++) {
    if (reservedPositions.includes(i) && customIndex < toInsert.length) {
      result.push(toInsert[customIndex++]);
      continue;
    }

    if (originalIndex < articles.length) {
      result.push(articles[originalIndex++]);
      continue;
    }

    if (customIndex < toInsert.length) {
      result.push(toInsert[customIndex++]);
      continue;
    }

    break;
  }

  console.log('Final merged result length:', result.length);
  return result;
}

// Функции для работы с кешем
function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Проверяем, не устарели ли данные
    if (now - timestamp > CACHE_DURATION_NEWS) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

function setCachedData(key, data) {
  try {
    const cacheItem = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Универсальная функция для запросов с кешированием
async function fetchNewsWithCache(url, cacheKey, options = {}) {
  const { quiet = false } = options;
  // Пытаемся получить данные из кеша
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log(`Using cached news for ${cacheKey}`);
    return cachedData;
  }

  // Если данных в кеше нет или они устарели, делаем запрос
  console.log(`Fetching fresh news for ${cacheKey}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Сохраняем в кеш
    setCachedData(cacheKey, data);

    return data;
  } catch (error) {
    if (!quiet) {
      console.error(`Error fetching news for ${cacheKey}:`, error);
    }
    throw error;
  }
}

function createTopicButtons() {
  if (!topicsContainer) return;
  // очистим контейнер (на случай повторного вызова)
  topicsContainer.innerHTML = '';
  topics.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t;
    btn.className = 'news__topic';
    btn.addEventListener('click', () => {
      Array.from(topicsContainer.children).forEach(b => b.className = 'news__topic');
      btn.className = 'news__topic news__topic--selected';
      loadNews(t);
    });
    topicsContainer.appendChild(btn);
  });
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderArticles(articles) {
  console.log('renderArticles called with', articles?.length || 0, 'articles');
  const customCount = articles?.filter(a => a.isCustom).length || 0;
  console.log('Custom articles in render:', customCount);
  newsContainer.innerHTML = '';
  if (!articles || articles.length === 0) {
    newsContainer.innerHTML = '<p>No news</p>';
    return;
  }

  // Для страницы новостей не ограничиваем количество
  const limitedArticles = articles.slice(0, MAX_NEWS_ITEMS);
  console.log('Limited to', limitedArticles.length, 'articles');

  const wrapper = document.createElement('div');
  wrapper.className = 'news__list';

  limitedArticles.forEach((a, index) => {
    const card = document.createElement('article');
    card.className = 'news__item';

    // Добавляем специальный класс для кастомной новости
    if (a.isCustom) {
      card.classList.add('news__item--custom');
      console.log('Rendering custom article at position', index, ':', a.title);
    }

    const imageContainer = document.createElement('div');
    imageContainer.className = 'news__image';

    const img = document.createElement('img');
    const imageUrl = a.imageUrl && String(a.imageUrl).trim() ? a.imageUrl : '';
    img.src = imageUrl;
    img.alt = a.title || '';
    img.onerror = () => {
      img.src = '';
    };

    const info = document.createElement('div');
    info.className = 'news__content';

    const title = document.createElement('a');
    title.href = a.url || '#';
    title.textContent = a.title || 'Без заголовка';
    title.className = 'news__title';
    title.target = a.target || '_blank';

    const preview = document.createElement('p');
    preview.textContent = (a.description || '').slice(0, 240);
    preview.className = 'news__text';

    imageContainer.appendChild(img);

    info.appendChild(title);
    info.appendChild(preview);

    card.appendChild(imageContainer);
    card.appendChild(info);
    wrapper.appendChild(card);
  });

  newsContainer.appendChild(wrapper);
}

async function loadAllNews() {
  if (!newsContainer) return;
  const lang = getCurrentLang();
  newsContainer.innerHTML = '<p>Loading all news...</p>';

  // Пытаемся получить все новости из кеша
  const allCacheKey = `news_all_${lang}`;
  const cachedAllNews = getCachedData(allCacheKey);
  if (cachedAllNews) {
    console.log('Using cached all news');
    // Даже из кеша добавляем кастомные новости, если их нет
    const customArticles = await getCustomNews(lang);
    const finalCachedArticles = mergeCustomNews(cachedAllNews, customArticles);
    renderArticles(finalCachedArticles);
    return;
  }

  try {
    // Загружаем новости по всем спортивным темам
    const sportTopics = ['Football', 'Cricket', 'eSports', 'Basketball', 'Volleyball', 'Tennis', 'MMA', 'Highlights', 'Trending'];
    // На проде параллельный штурм 9 запросами часто ловит rate-limit/504.
    // Идем последовательно, чтобы снизить нагрузку и повысить стабильность.
    const allResults = [];
    for (const topic of sportTopics) {
      try {
        const data = await fetchNewsWithCache(
          `/news?q=${encodeURIComponent(topic)}&lang=${encodeURIComponent(lang)}`,
          `news_${lang}_${topic.toLowerCase().replace(/\s+/g, '_')}`,
          { quiet: true }
        );
        console.log(`API response for ${topic}:`, data);
        allResults.push(data.articles || []);
      } catch (err) {
        allResults.push([]);
      }
    }

    // Объединяем все новости в один массив
    let allArticles = allResults.flat();

    // Удаляем дубликаты по URL
    const uniqueArticles = [];
    const seenUrls = new Set();

    allArticles.forEach(article => {
      if (article.url && !seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        uniqueArticles.push(article);
      }
    });

    // Перемешиваем новости
    const shuffledArticles = shuffleArray(uniqueArticles);

    // Добавляем кастомные новости из отдельного документа
    const customArticles = await getCustomNews(lang);
    const finalArticles = mergeCustomNews(shuffledArticles, customArticles);

    // Кешируем объединенный результат
    setCachedData(allCacheKey, finalArticles);

    // Отображаем перемешанные новости
    renderArticles(finalArticles);

  } catch (err) {
    console.error('Error loading all news:', err);
    newsContainer.innerHTML = '<p>Error loading news</p>';
  }
}

async function loadNews(q = 'All') {
  if (!newsContainer) return;
  if (q === 'All') {
    await loadAllNews();
    return;
  }
  const lang = getCurrentLang();
  newsContainer.innerHTML = '<p>Loading news...</p>';
  try {
    const cacheKey = `news_${lang}_${q.toLowerCase().replace(/\s+/g, '_')}`;
    const data = await fetchNewsWithCache(
      `/news?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`,
      cacheKey
    );
    
    console.log('Full API response for topic', q, ':', data);

    // Даже из кеша добавляем кастомные новости, если их нет
    const customArticles = await getCustomNews(lang);
    const articles = mergeCustomNews(data.articles || [], customArticles);
    console.log('Final articles for topic', q, ':', articles.length);

    renderArticles(articles);
  } catch (err) {
    console.error('Error loading news:', err);
    newsContainer.innerHTML = '<p>Error</p>';
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  currentActiveLang = getCurrentLang();
  await loadTopicsFromTranslations();
  createTopicButtons();

  // Тест загрузки кастомных новостей
  console.log('Testing custom news loading...');
  const testCustom = await getCustomNews(currentActiveLang);
  console.log('Test custom news result:', testCustom);

  // имитируем клик по первой теме (All)
  const firstBtn = topicsContainer.querySelector('button');
  if (firstBtn) {
    firstBtn.click();
  } else {
    loadNews('All');
  }
});

// Функция для принудительного обновления кеша новостей
function clearNewsCache() {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('news_')) localStorage.removeItem(k);
  });
  console.log('News cache cleared');
  location.reload();
}

// Добавляем глобальную функцию для очистки кеша
window.clearNewsCache = clearNewsCache;

// При смене языка — обновляем темы и новости
document.addEventListener('langChanged', async (e) => {
  const newLang = (e.detail && e.detail.lang) || getCurrentLang();
  if (newLang === currentActiveLang) return; // язык не изменился — пропускаем
  currentActiveLang = newLang;
  // Очищаем новостной кеш чтобы подгрузить статьи на новом языке
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('news_')) localStorage.removeItem(k);
  });
  await loadTopicsFromTranslations();
  createTopicButtons();
  const firstBtn = topicsContainer && topicsContainer.querySelector('button');
  if (firstBtn) firstBtn.click();
  else loadNews('All');
});