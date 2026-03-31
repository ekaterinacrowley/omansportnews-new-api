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

const REF = process.env.REF
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

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
    { headers:{ Authorization:`Bearer ${token}` } }
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


// Эндпоинт для таблицы (standings) — прокси для api-football (v3)
app.get('/standings/football', async (req, res) => {
  const league = req.query.league;
  const season = req.query.season;

  if (!league || !season) {
    return res.status(400).json({ error: 'league и season обязательны' });
  }

  try {
    const url = `https://v3.football.api-sports.io/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': API_KEY, // Замените на свой API ключ
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log(`[DEBUG] Standings API status: ${response.status}`);
    console.log(`[DEBUG] Standings API body (full response):`, text); // Выводим весь ответ

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Remote API error', status: response.status, raw: text });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON from standings API', e);
      return res.status(502).json({ error: 'Invalid JSON from standings API', raw: text });
    }

    // Выводим весь разобранный объект
    console.log(`[DEBUG] Parsed response data:`, data);

    const result = {
      league: (data?.response?.[0]?.league) || null,
      season: season,
      standings: []
    };

    const rawStandings = (Array.isArray(data.response) ? data.response.flatMap(r => {
      if (r?.league?.standings && Array.isArray(r.league.standings)) return r.league.standings.flat();
      if (r?.standings && Array.isArray(r.standings)) return r.standings.flat();
      return [];
    }) : []);

    result.standings = rawStandings.map(item => ({
      rank: item.rank ?? item.position ?? null,
      team: item.team?.name ?? item.team?.short ?? item.name ?? null,
      teamId: item.team?.id ?? null,
      logo: item.team?.logo ?? null,
      points: item.points ?? item.pts ?? null,
      form: item.form ?? null,
      all: item.all ?? item.matches ?? null
    }));

    res.json(result);
  } catch (err) {
    console.error('Standings proxy error:', err.stack || err);
    res.status(500).json({ error: 'Standings proxy error', message: err.message || String(err) });
  }
});

// Новости по теме
app.get("/news", async (req, res) => {
  try {
    const topic = req.query.q || "Football";
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&apiKey=${NEWS_KEY}`;
    const response = await axios.get(url);

    let articles = response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt
    }));
    res.json({ articles });
  } catch (err) {
    console.error("News proxy error:", err);
    res.status(500).json({ error: "News proxy error" });
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
    const token = await getToken()

    const response = await axios.get(
      `https://cpservm.com/gateway/marketing/datafeed/directories/api/v2/sports?ref=${REF}`,
      { headers:{ Authorization:`Bearer ${token}` } }
    )

    res.json(response.data)

  }catch(e){
    console.log("SPORTS ERROR:", e.response?.data || e.message)
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
    };
    if (gtStart) params.gtStart = Number(gtStart);
    if (ltStart) params.ltStart = Number(ltStart);
    if (req.query.count) params.count = Number(req.query.count);

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 25000,
      }
    );

    res.json(response.data);
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
    if (String(req.query.sportId || '') === '40') {
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
