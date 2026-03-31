import express from "express"
import axios from "axios"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import cors from "cors"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// CORS
app.use(cors())
app.use(express.json())

// API keys
const NEWS_KEY = process.env.NEWS_API_KEY || "c02d46f899cd4da09505aa2a8d9da8dd";

// cpservm API keys
const REF = process.env.REF
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

// Token management for cpservm API
let TOKEN = null
let TOKEN_EXPIRE = 0

async function getToken() {
  if (TOKEN && Date.now() < TOKEN_EXPIRE) return TOKEN

  try {
    const res = await axios.post(
      "https://cpservm.com/gateway/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      { 
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000
      }
    )

    TOKEN = res.data.access_token
    TOKEN_EXPIRE = Date.now() + (res.data.expires_in * 1000)
    
    console.log("[TOKEN] Token obtained")
    return TOKEN
  } catch (e) {
    console.error("[TOKEN] Error:", e.message)
    throw e
  }
}

// ============== МОКОВЫЕ ДАННЫЕ (FALLBACK) ==============

const mockEvents = {
  1: [ // Football
    {
      sportEventId: 1,
      tournamentId: 101,
      tournamentNameLocalization: "Premier League",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "England" },
      opponent1NameLocalization: "Manchester United",
      opponent2NameLocalization: "Liverpool",
      startDate: Math.floor(Date.now() / 1000) + 3600,
      period: 0,
      waitingLive: false,
      imageOpponent1: ["manutd.png"],
      imageOpponent2: ["liverpool.png"]
    }
  ],
  2: [ // Basketball
    {
      sportEventId: 101,
      tournamentId: 201,
      tournamentNameLocalization: "NBA",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "USA" },
      opponent1NameLocalization: "LA Lakers",
      opponent2NameLocalization: "Golden State Warriors",
      startDate: Math.floor(Date.now() / 1000) + 5400,
      period: 0,
      waitingLive: false,
      imageOpponent1: ["lakers.png"],
      imageOpponent2: ["warriors.png"]
    }
  ],
  3: [ // Hockey
    {
      sportEventId: 201,
      tournamentId: 301,
      tournamentNameLocalization: "NHL",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "USA" },
      opponent1NameLocalization: "New York Rangers",
      opponent2NameLocalization: "Boston Bruins",
      startDate: Math.floor(Date.now() / 1000) + 12600,
      period: 0,
      waitingLive: false,
      imageOpponent1: ["rangers.png"],
      imageOpponent2: ["bruins.png"]
    }
  ],
  4: [ // Cricket
    {
      sportEventId: 301,
      tournamentId: 401,
      tournamentNameLocalization: "IPL",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "India" },
      opponent1NameLocalization: "Mumbai Indians",
      opponent2NameLocalization: "Chennai Super Kings",
      startDate: Math.floor(Date.now() / 1000) + 16200,
      period: 0,
      waitingLive: false,
      imageOpponent1: ["mi.png"],
      imageOpponent2: ["csk.png"]
    }
  ],
  5: [ // Volleyball
    {
      sportEventId: 401,
      tournamentId: 501,
      tournamentNameLocalization: "Volleyball World League",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "World" },
      opponent1NameLocalization: "Brazil",
      opponent2NameLocalization: "Poland",
      startDate: Math.floor(Date.now() / 1000) + 19800,
      period: 0,
      waitingLive: false,
      imageOpponent1: ["brazil.png"],
      imageOpponent2: ["poland.png"]
    }
  ]
}

const mockResults = {
  1: [ // Football results
    {
      sportEventId: 1001,
      tournamentId: 101,
      tournamentNameLocalization: "Premier League",
      tournamentImage: null,
      matchInfoObject: { locationCountry: "England" },
      opponent1NameLocalization: "Tottenham",
      opponent2NameLocalization: "Aston Villa",
      startDate: Math.floor(Date.now() / 1000) - 86400,
      homeScore: 2,
      awayScore: 1,
      imageOpponent1: ["tottenham.png"],
      imageOpponent2: ["astonvilla.png"]
    }
  ]
}

// ============== API МАРШРУТЫ ==============

// Тестовый эндпоинт
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", timestamp: Date.now() })
})

// /news (и /api/news) - новости
async function handleNewsRequest(req, res) {
  const topic = String(req.query.q || "sport").trim() || "sport";
  const rawLang = String(req.query.lang || 'en').trim().toLowerCase();
  const newsApiSupportedLangs = new Set(['ar', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'no', 'pt', 'ru', 'sv', 'ud', 'zh']);
  const langMap = {
    sa: 'ar',
    pakistan: 'ar',
    india: 'en',
    bangladesh: 'en'
  };
  const mappedLang = langMap[rawLang] || rawLang;
  const safeLang = newsApiSupportedLangs.has(mappedLang) ? mappedLang : 'en';
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=${encodeURIComponent(safeLang)}&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_KEY}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const articles = (response.data?.articles || []).map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt
    }));

    return res.json({ articles });
  } catch (e) {
    console.error('[NEWS] Error:', e.response?.data || e.message);
    return res.status(200).json({ articles: [] });
  }
}

app.get('/news', handleNewsRequest);
app.get('/api/news', handleNewsRequest);

// /api/events - предстоящие матчи
app.get("/api/events", async (req, res) => {
  const sportId = req.query.sportId
  const { gtStart, ltStart } = req.query
  
  console.log(`[EVENTS] sportId=${sportId}, gtStart=${gtStart}, ltStart=${ltStart}`)
  
  if (!sportId) {
    return res.status(400).json({ error: "sportId is required" })
  }

  try {
    const token = await getToken()
    
    const params = {
      ref: REF,
      sportIds: sportId,
      lng: "en"
    }
    if (gtStart) params.gtStart = Number(gtStart)
    if (ltStart) params.ltStart = Number(ltStart)

    console.log("[EVENTS] Fetching from cpservm...")
    
    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    )

    if (response.data?.items?.length > 0) {
      console.log(`[EVENTS] Got ${response.data.items.length} events from API`)
      return res.json(response.data)
    }
  } catch (e) {
    console.log("[EVENTS] API error, using mock:", e.message)
  }
  
  const events = mockEvents[sportId] || []
  console.log(`[EVENTS] Using mock data: ${events.length} events`)
  res.json({ items: events, meta: { mock: true } })
})

// /api/results-events - результаты
app.get("/api/results-events", async (req, res) => {
  const sportId = req.query.sportId
  let dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom) : null
  let dateTo = req.query.dateTo ? parseInt(req.query.dateTo) : null
  
  console.log(`[RESULTS] sportId=${sportId}, dateFrom=${dateFrom}, dateTo=${dateTo}`)
  
  if (!sportId) {
    return res.json({ items: [] })
  }

  try {
    const token = await getToken()
    const now = Math.floor(Date.now() / 1000)
    
    // Устанавливаем даты в правильном диапазоне
    // API требует интервал от 1 минуты до 2 дней (172800 секунд)
    if (!dateFrom || !dateTo) {
      // По умолчанию последние 24 часа
      dateFrom = now - (24 * 3600)
      dateTo = now
    }
    
    // Проверяем интервал
    const diffSeconds = dateTo - dateFrom
    
    if (diffSeconds < 60) {
      console.log(`[RESULTS] Interval too small (${diffSeconds}s), adjusting to 1 hour`)
      dateFrom = dateTo - 3600
    }
    
    if (diffSeconds > 172800) { // 2 дня = 172800 секунд
      console.log(`[RESULTS] Interval too large (${diffSeconds}s), limiting to 2 days`)
      dateFrom = dateTo - 172800
    }
    
    // Убеждаемся, что даты не в будущем
    if (dateTo > now) {
      console.log(`[RESULTS] dateTo in future, setting to now`)
      dateTo = now
      dateFrom = now - 172800
    }
    
    console.log(`[RESULTS] Using date range: ${dateFrom} to ${dateTo} (${(dateTo - dateFrom) / 3600} hours)`)

    // Шаг 1: Получаем турниры для данного вида спорта
    const tournamentsResp = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/tournaments",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ref: REF,
          sportId: sportId,
          DateFrom: dateFrom,
          DateTo: dateTo,
          lng: "en"
        },
        timeout: 15000
      }
    )

    const tournamentsList = tournamentsResp.data?.items || []
    console.log(`[RESULTS] Found ${tournamentsList.length} tournaments`)

    if (tournamentsList.length === 0) {
      console.log("[RESULTS] No tournaments found, using mock")
      const results = mockResults[sportId] || []
      return res.json({ items: results, meta: { mock: true } })
    }

    // Шаг 2: Получаем ID турниров
    const tournamentIds = tournamentsList
      .map(t => t.tournamentId)
      .filter(id => id)
      .join(",")

    console.log(`[RESULTS] Tournament IDs: ${tournamentIds}`)

    // Шаг 3: Получаем события по турнирам
    const eventsResp = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/sportevents",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ref: REF,
          dateFrom: dateFrom,
          dateTo: dateTo,
          tournamentIds: tournamentIds,
          lng: "en"
        },
        timeout: 15000
      }
    )

    const events = eventsResp.data?.items || []
    console.log(`[RESULTS] Got ${events.length} events from API`)
    
    if (events.length === 0) {
      console.log("[RESULTS] No events found, using mock")
      const results = mockResults[sportId] || []
      return res.json({ items: results, meta: { mock: true } })
    }
    
    res.json(eventsResp.data)

  } catch (e) {
    console.error("[RESULTS] Error:", e.message)
    if (e.response?.data) {
      console.error("[RESULTS] API response:", JSON.stringify(e.response.data))
    }
    // Fallback to mock
    const results = mockResults[sportId] || []
    console.log(`[RESULTS] Using mock data: ${results.length} results`)
    res.json({ items: results, meta: { mock: true } })
  }
})

// /api/sports - список видов спорта с результатами
app.get("/api/sports", async (req, res) => {
  try {
    const token = await getToken()
    const now = Math.floor(Date.now() / 1000)
    const twoDaysAgo = now - (48 * 3600)
    
    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/sports",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ref: REF,
          dateFrom: twoDaysAgo,
          dateTo: now,
          lng: "en"
        },
        timeout: 10000
      }
    )
    res.json(response.data)
  } catch (e) {
    console.log("[SPORTS] Error, using mock:", e.message)
    res.json({
      items: [
        { id: 1, name: "Football" },
        { id: 2, name: "Basketball" },
        { id: 3, name: "Hockey" },
        { id: 4, name: "Cricket" },
        { id: 5, name: "Volleyball" }
      ]
    })
  }
})

// Прокси для изображений
app.get('/api/img/:type/:image', async (req, res) => {
  const { type, image } = req.params;
  
  let folderPath;
  if (type === 'tournament') {
    folderPath = 'logo-champ';
  } else if (type === 'opponent') {
    folderPath = 'logo_teams';
  } else {
    return res.status(400).send('Invalid type');
  }

  const url = `https://nimblecd.com/sfiles/${folderPath}/${image}`;

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 10000,
      validateStatus: (status) => status < 400
    });

    if (response.status === 200) {
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return response.data.pipe(res);
    }
  } catch (err) {
    console.log('[IMAGE] Failed:', err.message);
  }
  
  // Прозрачный пиксель как fallback
  const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.send(transparentPixel);
});

// ============== СТАТИКА ==============
app.use(express.static(path.join(__dirname, "dist")));

// ============== SPA FALLBACK ==============
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   - /api/test`);
  console.log(`   - /api/events`);
  console.log(`   - /api/results-events`);
  console.log(`   - /api/sports`);
});