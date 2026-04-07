import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

const app = express();
const PORT = process.env.PORT || 5000;


const NEWS_KEY = process.env.NEWS_API_KEY || "9455fa9a233f46f290770aa1018c93e6";

const REF = process.env.REF || "282";
const CLIENT_ID = process.env.CLIENT_ID || "partners-911cc01e4efa0d3b45a6ffbb059870d8";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "kMA3FPllT%H7pFl7%H*lj7vnNthASLnVPb&g91JD9UmC3fDtdQLi7g9rvXjQjHv0";

let TOKEN = null
let TOKEN_EXPIRE = 0

async function getToken(){
  if(TOKEN && Date.now() < TOKEN_EXPIRE) return TOKEN

  const res = await axios.post(
    "https://cpservm.com/gateway/token",
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )

  TOKEN = res.data.access_token
  TOKEN_EXPIRE = Date.now() + (res.data.expires_in * 1000)

  return TOKEN
}

let sportsCache = null

async function getSports() {
  if (sportsCache) return sportsCache

  const token = await getToken()

  const response = await axios.get(
    `https://cpservm.com/gateway/marketing/datafeed/directories/api/v2/sports?ref=${REF}`,
    {
      headers:{ Authorization:`Bearer ${token}` },
      timeout: 12000,
    }
  )

  sportsCache = response.data.items || []

  return sportsCache
}

const SPORT_ID_OVERRIDES = {
  football: 1,
  basketball: 3,
  volleyball: 6,
  cricket: 4,
};

async function getSportId(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();

  // Используем заранее известные ID, если API не возвращает нужный sport в списке
  if (SPORT_ID_OVERRIDES[key]) {
    return SPORT_ID_OVERRIDES[key];
  }

  const sports = await getSports();
  if (!Array.isArray(sports)) return null;

  // Сначала пробуем точное соответствие
  const exactMatch = sports.find(s => String(s.name).toLowerCase() === key);
  if (exactMatch) return exactMatch.id;

  // Затем пробуем частичное соответствие
  const partialMatch = sports.find(s => String(s.name).toLowerCase().includes(key));
  if (partialMatch) return partialMatch.id;

  // И наконец — начало строки
  const startsWithMatch = sports.find(s => String(s.name).toLowerCase().startsWith(key));
  if (startsWithMatch) return startsWithMatch.id;

  return null;
}

// CORS
app.use(cors());

// --- Футбол ---
app.get("/matches/football", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date обязателен" });

  try {
    const sportId = await getSportId('football')
    if (!sportId) return res.status(404).json({ error: "Football sport not found" })

    const token = await getToken()

    const gtStart = Math.floor(new Date(date).getTime() / 1000)
    const ltStart = gtStart + 24*3600

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params: {
          ref: REF,
          sportIds: sportId,
          lng: "en",
          gtStart,
          ltStart
        },
        headers:{
          Authorization:`Bearer ${token}`
        }
      }
    )

    const items = response.data.items || []
    const leaguesMap = {}
    items.forEach(event => {
      const leagueId = event.tournamentId
      if (!leaguesMap[leagueId]) {
        leaguesMap[leagueId] = {
          league: {
            id: leagueId,
            name: event.tournamentName,
            logo: null
          },
          fixtures: []
        }
      }
      leaguesMap[leagueId].fixtures.push({
        fixture: {
          id: event.id,
          date: new Date(event.startTime * 1000).toISOString(),
          status: { long: 'Not Started' }
        },
        teams: {
          home: { name: event.homeTeamName },
          away: { name: event.awayTeamName }
        },
        goals: { home: null, away: null }
      })
    })

    res.json({ response: Object.values(leaguesMap) })

  } catch (err) {
    console.error("Football proxy error:", err);
    res.status(500).json({ error: "Football proxy error" });
  }
});

// --- Крикет ---
app.get("/matches/cricket", async (req, res) => {
  try {
    const sportId = await getSportId('cricket')
    if (!sportId) return res.status(404).json({ error: "Cricket sport not found" })

    const token = await getToken()

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params: {
          ref: REF,
          sportIds: sportId,
          lng: "en"
        },
        headers:{
          Authorization:`Bearer ${token}`
        }
      }
    )

    const items = response.data.items || []
    const matches = items.map(match => ({
      id: match.id,
      name: `${match.homeTeamName} vs ${match.awayTeamName}`,
      venue: match.venueName || 'Unknown',
      status: 'Not Started',
      teams: [match.homeTeamName, match.awayTeamName],
      date: new Date(match.startTime * 1000).toISOString(),
      dateOnly: new Date(match.startTime * 1000).toISOString().split('T')[0],
      teamInfo: [
        { name: match.homeTeamName, img: null },
        { name: match.awayTeamName, img: null }
      ],
      score: null
    }))

    res.json({ data: matches })

  } catch (err) {
    console.error("Cricket proxy error:", err);
    res.status(500).json({ error: "Cricket proxy error" });
  }
});

// --- Баскетбол ---

app.get("/matches/basketball", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date обязателен" });

  try {
    const sportId = await getSportId('basketball')
    if (!sportId) return res.status(404).json({ error: "Basketball sport not found" })

    const token = await getToken()

    const gtStart = Math.floor(new Date(date).getTime() / 1000)
    const ltStart = gtStart + 24*3600

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params: {
          ref: REF,
          sportIds: sportId,
          lng: "en",
          gtStart,
          ltStart
        },
        headers:{
          Authorization:`Bearer ${token}`
        }
      }
    )

    const items = response.data.items || []
    const leaguesMap = {}
    items.forEach(match => {
      const leagueId = match.tournamentId
      if (!leaguesMap[leagueId]) {
        leaguesMap[leagueId] = {
          league: {
            id: leagueId,
            name: match.tournamentName,
            logo: null
          },
          matches: []
        }
      }
      leaguesMap[leagueId].matches.push({
        id: match.id,
        date: new Date(match.startTime * 1000).toISOString(),
        status: { long: 'Not Started' },
        teams: [match.homeTeamName, match.awayTeamName],
        teamInfo: [
          { name: match.homeTeamName, img: null },
          { name: match.awayTeamName, img: null }
        ]
      })
    })

    res.json({ data: Object.values(leaguesMap) })

  } catch (err) {
    console.error("Basketball proxy error:", err);
    res.status(500).json({ error: "Basketball proxy error" });
  }
});

// добавлен маршрут для волейбола (аналогично баскетболу)
app.get("/matches/volleyball", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date обязателен" });

  try {
    const sportId = await getSportId('volleyball')
    if (!sportId) return res.status(404).json({ error: "Volleyball sport not found" })

    const token = await getToken()

    const gtStart = Math.floor(new Date(date).getTime() / 1000)
    const ltStart = gtStart + 24*3600

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params: {
          ref: REF,
          sportIds: sportId,
          lng: "en",
          gtStart,
          ltStart
        },
        headers:{
          Authorization:`Bearer ${token}`
        }
      }
    )

    const items = response.data.items || []
    const leaguesMap = {}
    items.forEach(match => {
      const leagueId = match.tournamentId
      if (!leaguesMap[leagueId]) {
        leaguesMap[leagueId] = {
          league: {
            id: leagueId,
            name: match.tournamentName,
            logo: null
          },
          matches: []
        }
      }
      leaguesMap[leagueId].matches.push({
        id: match.id,
        date: new Date(match.startTime * 1000).toISOString(),
        status: { long: 'Not Started' },
        teams: [match.homeTeamName, match.awayTeamName],
        teamInfo: [
          { name: match.homeTeamName, img: null },
          { name: match.awayTeamName, img: null }
        ]
      })
    })

    res.json({ data: Object.values(leaguesMap) })

  } catch (err) {
    console.error("Volleyball proxy error:", err);
    res.status(500).json({ error: "Volleyball proxy error" });
  }
});

// Новости по теме
app.get("/news", async (req, res) => {
  try {
    const topic = req.query.q || "Football";
    // Map site lang codes to NewsAPI supported language codes
    const LANG_MAP = { en: 'en', sa: 'ar', india: 'en', bangladesh: 'en', pakistan: 'en' };
    const GEO_MAP = {
      en: { gl: 'US', ceid: 'US:en' },
      ar: { gl: 'SA', ceid: 'SA:ar' }
    };
    const language = LANG_MAP[req.query.lang] || 'en';
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=${language}&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_KEY}`;

    const fetchGoogleNewsFallback = async () => {
      const geo = GEO_MAP[language] || GEO_MAP.en;
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=${language}&gl=${geo.gl}&ceid=${geo.ceid}`;
      const rssResponse = await axios.get(rssUrl, { timeout: 7000, responseType: 'text' });
      const rssText = String(rssResponse.data || '');

      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(rssText)) !== null && items.length < 20) {
        const chunk = match[1];
        const take = (tag) => {
          const m = chunk.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
          return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        };

        const title = take('title');
        const link = take('link');
        const description = take('description').replace(/<[^>]+>/g, '').trim();
        const publishedAt = take('pubDate');
        if (!title || !link) continue;

        items.push({
          title,
          description,
          url: link,
          imageUrl: null,
          publishedAt
        });
      }

      return items;
    };

    const response = await axios.get(url, { timeout: 7000 });

    // NewsAPI can return non-ok payload with 200 status (e.g. rate limit or invalid key)
    if (response.data?.status && response.data.status !== 'ok') {
      console.warn("NewsAPI non-ok response:", {
        status: response.data.status,
        code: response.data.code,
        message: response.data.message,
        topic,
        language,
      });
      const fallbackArticles = await fetchGoogleNewsFallback();
      return res.json({ articles: fallbackArticles });
    }

    const sourceArticles = Array.isArray(response.data?.articles) ? response.data.articles : [];
    let articles = sourceArticles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt
    }));
    res.json({ articles });
  } catch (err) {
    console.warn("News proxy fallback:", {
      topic: req.query.q || "Football",
      lang: req.query.lang || 'en',
      status: err.response?.status,
      message: err.message,
    });

    try {
      const topic = req.query.q || "Football";
      const LANG_MAP = { en: 'en', sa: 'ar', india: 'en', bangladesh: 'en', pakistan: 'en' };
      const GEO_MAP = {
        en: { gl: 'US', ceid: 'US:en' },
        ar: { gl: 'SA', ceid: 'SA:ar' }
      };
      const language = LANG_MAP[req.query.lang] || 'en';
      const geo = GEO_MAP[language] || GEO_MAP.en;
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=${language}&gl=${geo.gl}&ceid=${geo.ceid}`;
      const rssResponse = await axios.get(rssUrl, { timeout: 7000, responseType: 'text' });
      const rssText = String(rssResponse.data || '');

      const articles = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(rssText)) !== null && articles.length < 20) {
        const chunk = match[1];
        const take = (tag) => {
          const m = chunk.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
          return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        };

        const title = take('title');
        const link = take('link');
        const description = take('description').replace(/<[^>]+>/g, '').trim();
        const publishedAt = take('pubDate');
        if (!title || !link) continue;

        articles.push({
          title,
          description,
          url: link,
          imageUrl: null,
          publishedAt
        });
      }

      return res.json({ articles });
    } catch (rssErr) {
      console.warn("Google News RSS fallback failed:", {
        status: rssErr.response?.status,
        message: rssErr.message,
      });
      // Keep endpoint stable for UI: avoid 500/504 storms on third-party failures.
      return res.json({ articles: [] });
    }
  }
});

// Новый маршрут для всех популярных запросов
app.get("/popular/all", (req, res) => {
  res.json({
    sport: [
      "Football",
      "Cricket ",
      "eSports ",
      "Basketball",
      "Volleyball",
      "Tennis",
      "MMA",
      "Highlights",
      "Motorsport",
      "Rugby",
      "Baseball",
      "Golf",
      "Hockey",
      "American Football",
      "Cycling",
      "Snooker",
      "Darts",
      "Winter Sports"
    ],
  });
});

app.get("/api/sports", async (req,res)=>{
  try{
    const items = await getSports()
    res.json({ items })

  }catch(e){
    console.log("SPORTS ERROR:", e.response?.data || e.message)
    if (Array.isArray(sportsCache) && sportsCache.length) {
      return res.json({ items: sportsCache })
    }
    res.status(500).json({ error:"sports error" })
  }
})

app.get("/api/events", async (req, res) => {
  try {
    const token = await getToken();

    const sportId = req.query.sportId || req.query.sportIds;
    const { gtStart, ltStart } = req.query;

    const params = {
      ref: REF,
      sportIds: sportId,
      lng: req.query.lng || "en",
      partnerLink: 'https://reffpa.com/L?tag=d_5453931m_1599c_&site=5453931&ad=1599',
    };
    if (gtStart) params.gtStart = Number(gtStart);
    if (ltStart) params.ltStart = Number(ltStart);
    if (req.query.count) params.count = Number(req.query.count);

    const requestConfig = {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 25000,
    };

    const [prematchResult, liveResult] = await Promise.allSettled([
      axios.get(
        "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
        requestConfig
      ),
      axios.get(
        "https://cpservm.com/gateway/marketing/datafeed/live/api/v2/sportevents",
        requestConfig
      ),
    ]);

    const prematchItems = prematchResult.status === "fulfilled"
      ? (prematchResult.value.data.items || [])
      : [];
    const liveItems = liveResult.status === "fulfilled"
      ? (liveResult.value.data.items || [])
      : [];

    if (!prematchItems.length && !liveItems.length) {
      if (prematchResult.status === "rejected" && liveResult.status === "rejected") {
        throw prematchResult.reason;
      }
      return res.json({ count: 0, items: [] });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const statusFromGameStatus = (gameStatus) => {
      const code = Number(gameStatus);
      if (!Number.isFinite(code)) return null;
      if (code === 1) return "finished";
      if (code === 4) return "canceled";
      if (code === 32) return "interrupted";
      return "live";
    };

    const normalizeItem = (item) => {
      const fullScore = (item && typeof item.fullScore === "object") ? item.fullScore : null;
      const curScore = (item && typeof item.curScore === "object") ? item.curScore : null;
      const status =
        statusFromGameStatus(item.gameStatus)
        || (typeof item.status === "string" ? item.status : null)
        || (item.startDate && item.startDate <= nowSec ? "in_progress" : "scheduled");

      return {
        ...item,
        status,
        opponent1Score: item.opponent1Score ?? fullScore?.sc1 ?? curScore?.sc1 ?? null,
        opponent2Score: item.opponent2Score ?? fullScore?.sc2 ?? curScore?.sc2 ?? null,
      };
    };

    const eventKey = (item) => {
      const baseId = item.mainConstSportEventId || item.constSportEventId || item.sportEventId;
      return String(baseId || "") + "_" + String(item.period ?? 0);
    };

    const mergedMap = new Map();
    prematchItems.forEach((item) => mergedMap.set(eventKey(item), normalizeItem(item)));
    liveItems.forEach((item) => mergedMap.set(eventKey(item), normalizeItem(item)));

    const items = Array.from(mergedMap.values()).sort((a, b) => (a.startDate || 0) - (b.startDate || 0));

    res.json({
      count: items.length,
      items,
    });
  } catch (e) {
    console.log("MATCHES ERROR:", e.response?.data || e.message);
    const sportId = String(req.query.sportId || req.query.sportIds || '');
    if (sportId === '40') {
      return res.json({ items: [] });
    }
    res.status(500).json({ error: "events error" });
  }
});

// /api/results?sportId=X&dateFrom=unixSec&dateTo=unixSec
// Two-step: 1) get tournaments with results for the period, 2) get sportevents with scores
app.get("/api/results", async (req, res) => {
  try {
    const token = await getToken();
    const sportId = req.query.sportId;
    const dateFrom = Number(req.query.dateFrom);
    const dateTo   = Number(req.query.dateTo);
    const lng      = req.query.lng || "en";

    if (!sportId || !dateFrom || !dateTo) {
      return res.status(400).json({ error: "sportId, dateFrom, dateTo are required" });
    }

    // Step A — tournaments that have results in this date range
    const tournamentsRes = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/tournaments",
      {
        params: { ref: REF, sportId, dateFrom, dateTo, lng },
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const tournaments = tournamentsRes.data.items || [];
    if (!tournaments.length) {
      return res.json({ items: [] });
    }

    const tournamentIds = tournaments.map(t => t.tournamentId).join(",");

    // Step B — sport events with scores for those tournaments
    const eventsRes = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/sportevents",
      {
        params: { ref: REF, tournamentIds, dateFrom, dateTo, lng },
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // Attach tournament info (name, image) to each event
    const tournamentMap = {};
    tournaments.forEach(t => { tournamentMap[t.tournamentId] = t; });

    const items = (eventsRes.data.items || []).map(ev => {
      // Result API events may have constSportEventId linking to a tournament
      // We match via the tournament list or leave as-is
      const tid = ev.tournamentId;
      const t = tid ? tournamentMap[tid] : null;
      return {
        ...ev,
        tournamentNameLocalization: ev.tournamentNameLocalization || (t && t.tournamentNameLocalization) || "Unknown",
        tournamentImage: ev.tournamentImage || (t && t.tournamentImage ? [t.tournamentImage] : null)
      };
    });

    res.json({ items });

  } catch (e) {
    console.error("RESULTS ERROR:", e.response?.data || e.message);
    const sid = String(req.query.sportId || '');
    if (sid === '40' || sid === '66') {
      return res.json({ items: [] });
    }
    res.status(500).json({ error: "results error", details: e.response?.data || e.message });
  }
});

app.get("/api/results-sports", async (req, res) => {
  try {

    const token = await getToken()

    const now = Math.floor(Date.now() / 1000)

    const params = {
      ref: REF,
      DateFrom: now - 3600 * 24,
      DateTo: now,
      lng: "en"
    }

    console.log("RESULT SPORTS PARAMS:", params)

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/sports",
      {
        params,
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    console.log("RESULT SPORTS:", response.data)

    res.json(response.data)

  } catch (e) {

    console.log(
      "RESULT SPORTS ERROR:",
      e.response?.data || e.message
    )

    res.status(500).json({
      error: "result sports error",
      details: e.response?.data
    })

  }
})

// endpoint: /api/results-events?sportId=...
app.get("/api/results-events", async (req, res) => {
  try {
    const token = await getToken();

    const sportId = req.query.sportId || req.query.sportIds;
    const { dateFrom, dateTo } = req.query;

    const params = {
      ref: REF,
      sportIds: sportId,
      lng: "en",
    };
    if (dateFrom) params.gtStart = Number(dateFrom);
    if (dateTo) params.ltStart = Number(dateTo);

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.json(response.data);

  } catch (e) {
    console.error("RESULT EVENTS ERROR:", e.response?.data || e.message)
    res.status(500).json({ error: "result events error", details: e.response?.data || e.message })
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

// Статика
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Первый и единственный запуск сервера (оставить этот)
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  if (process.argv.includes('--open')) {
    exec('$BROWSER http://localhost:5000');
  }
});
