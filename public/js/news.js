// Загружает и отображает новости по выбранной теме.
// Вызов: клик по теме -> fetch /news?q=ТЕМА

// topics будет загружаться из `src/i18n/translations.json` на основе текущего языка
let topics = [];
let currentActiveLang = null;

function getCurrentLang() {
  return document.body.getAttribute('data-lang') || localStorage.getItem('siteLang') || 'en';
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

// Константа для ограничения количества новостей
const MAX_NEWS_ITEMS = 8;

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

// Кастомная новость
const customNews = {
  title: "Lions look to dominate the playoffs",
  description: "The victory over the Bills put the Lions in a comfortable position to make the playoffs",
  url: "https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599",
  target: "_blank",
  imageUrl: "images/news-image.webp",
  isCustom: true
};

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
async function fetchNewsWithCache(url, cacheKey) {
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
    console.error(`Error fetching news for ${cacheKey}:`, error);
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
  newsContainer.innerHTML = '';
  if (!articles || articles.length === 0) {
    newsContainer.innerHTML = '<p>No news</p>';
    return;
  }

  // Ограничиваем количество новостей до MAX_NEWS_ITEMS
  let limitedArticles = articles.slice(0, MAX_NEWS_ITEMS);
  
  // Добавляем кастомную новость на вторую позицию (если есть как минимум 2 новости)
  if (limitedArticles.length >= 2 && !limitedArticles.some(article => article.isCustom)) {
    limitedArticles = [
      limitedArticles[0],
      customNews,
      ...limitedArticles.slice(1, MAX_NEWS_ITEMS - 1)
    ];
  }
  
  const wrapper = document.createElement('div');
  wrapper.className = 'news__list';

  limitedArticles.forEach((a, index) => {
    const card = document.createElement('article');
    card.className = 'news__item';
    
    // Добавляем специальный класс для кастомной новости
    if (a.isCustom) {
      card.classList.add('news__item--custom');
    }

    const imageContainer = document.createElement('div');
    imageContainer.className = 'news__image';

    const img = document.createElement('img');
    img.src = a.imageUrl || 'https://via.placeholder.com/120x80?text=no+image';
    img.alt = a.title || '';

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
  newsContainer.innerHTML = '<p>Загрузка всех новостей...</p>';
  
  // Пытаемся получить все новости из кеша
  const allCacheKey = `news_all_${lang}`;
  const cachedAllNews = getCachedData(allCacheKey);
  if (cachedAllNews) {
    console.log('Using cached all news');
    renderArticles(cachedAllNews);
    return;
  }
  
  try {
    // Загружаем новости по всем спортивным темам
    const sportTopics = ['Football', 'Cricket', 'eSports', 'Basketball', 'Volleyball', 'Tennis', 'MMA', 'Highlights', 'Trending'];
    const allPromises = sportTopics.map(topic => 
      fetchNewsWithCache(
        `/news?q=${encodeURIComponent(topic)}&lang=${encodeURIComponent(lang)}`,
        `news_${lang}_${topic.toLowerCase().replace(/\s+/g, '_')}`
      )
        .then(data => data.articles || [])
        .catch(err => {
          console.error(`Error loading news for ${topic}:`, err);
          return []; // Возвращаем пустой массив в случае ошибки
        })
    );

    // Ждем завершения всех запросов
    const allResults = await Promise.all(allPromises);
    
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
    
    // Кешируем объединенный результат
    setCachedData(allCacheKey, shuffledArticles);
    
    // Отображаем перемешанные новости
    renderArticles(shuffledArticles);
    
  } catch (err) {
    console.error('Error loading all news:', err);
    newsContainer.innerHTML = '<p>Ошибка при загрузке новостей</p>';
  }
}

async function loadNews(q = 'All') {
  if (!newsContainer) return;
  if (q === 'All') {
    await loadAllNews();
    return;
  }
  const lang = getCurrentLang();
  newsContainer.innerHTML = '<p>Загрузка новостей...</p>';
  try {
    const cacheKey = `news_${lang}_${q.toLowerCase().replace(/\s+/g, '_')}`;
    const data = await fetchNewsWithCache(
      `/news?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`,
      cacheKey
    );
    
    // Для отдельных тем тоже добавляем кастомную новость
    let articles = data.articles || [];
    if (articles.length >= 2 && !articles.some(article => article.isCustom)) {
      articles = [
        articles[0],
        customNews,
        ...articles.slice(1, MAX_NEWS_ITEMS - 1)
      ];
    }
    
    renderArticles(articles);
  } catch (err) {
    console.error('Error loading news:', err);
    newsContainer.innerHTML = '<p>Ошибка при получении новостей</p>';
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  currentActiveLang = getCurrentLang();
  await loadTopicsFromTranslations();
  createTopicButtons();
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
  Object.values(CACHE_KEYS_NEWS).forEach(key => {
    localStorage.removeItem(key);
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