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

// API keys
const API_KEY = process.env.API_KEY || '76b6f309a4d1ff9512ec99c2dd0ad8e5';
const CRICKET_KEY = process.env.CRICKET_API_KEY || 'eebe5ade-a481-477d-8f02-440685b4cd53';
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
    {
      headers:{ Authorization:`Bearer ${token}` },
      timeout: 12000,
    }
  )

  sportsCache = response.data.items || []

  return sportsCache
}

async function getSportId(name) {
  const sports = await getSports()
  const sport = sports.find(s => s.name.toLowerCase().includes(name.toLowerCase()))
  return sport ? sport.id : null
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

app.get("/api/events", async(req,res)=>{
  try{
    const token = await getToken()
    const sportId = req.query.sportId
    const { gtStart, ltStart } = req.query

    const params = {
      ref: REF,
      sportIds: sportId,
      lng: "en",
      partnerLink: 'refpa58144.com/L?tag=d_4980367m_1599c_',
    }
    if (gtStart) params.gtStart = Number(gtStart)
    if (ltStart) params.ltStart = Number(ltStart)
    if (req.query.count) params.count = Number(req.query.count)

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params,
        headers:{
          Authorization:`Bearer ${token}`
        },
        timeout: 25000,
      }
    )

    res.json(response.data)

  }catch(e){
    console.log("MATCHES ERROR:", e.response?.data || e.message)
    res.status(500).json({error:"events error"})
  }
})

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
    const token = await getToken()
    const sportId = req.query.sportId

    if (!sportId) {
      return res.json({ items: [] })
    }

    // Временной диапазон — максимум 2 дня
    const now = Math.floor(Date.now() / 1000)
    const dateFrom = now - 24 * 3600 // последние 24 часа
    const dateTo = now

    // сначала запрашиваем турниры, в которых есть результаты для спорта
    const tournamentsResp = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/tournaments",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ref: REF,
          sportId,
          DateFrom: dateFrom,
          DateTo: dateTo
        }
      }
    )

    const tournamentsData = tournamentsResp.data || {}
    const list = tournamentsData.items || []

    if (list.length === 0) {
      // ничего нет – возвращаем пустой результат без ошибок
      return res.json({ items: [] })
    }

    // убираем из списка неопределённые / пустые идентификаторы
    const tournamentIdsList = list
      .map(t => t.tournamentId)
      .filter(id => id !== undefined && id !== null && id !== "")

    if (tournamentIdsList.length === 0) {
      console.warn("RESULT EVENTS: tournaments returned but no valid IDs", list)
      return res.json({ items: [] })
    }

    const tournamentIds = tournamentIdsList.join(",")
    console.log("FOUND TOURNAMENTS:", tournamentIds)

    const params = {
      ref: REF,
      dateFrom,
      dateTo,
      tournamentIds,
      lng: "en"
    }

    console.log("RESULT EVENTS PARAMS:", params)

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/result/api/v1/sportevents",
      {
        headers: { Authorization: `Bearer ${token}` },
        params
      }
    )

    console.log("RESULT EVENTS RESPONSE:", response.data)
    res.json(response.data)

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

// --- Синхронизация кастомных новостей из Google Sheets ---
const CUSTOM_NEWS_SHEET_ID = process.env.CUSTOM_NEWS_SHEET_ID || '1TIrKdVNGt5NDs6gkR9nJgcUiIkDrW8uTG8UUXwSd4LE';
const CUSTOM_NEWS_SHEET_GID = process.env.CUSTOM_NEWS_SHEET_GID || '0';
const CUSTOM_NEWS_COUNTRY = (process.env.CUSTOM_NEWS_COUNTRY || 'Oman').toLowerCase();
const CUSTOM_NEWS_MAX_ITEMS = Number(process.env.CUSTOM_NEWS_MAX_ITEMS || 8);
const CUSTOM_NEWS_DEFAULT_IMAGE_URL = process.env.CUSTOM_NEWS_DEFAULT_IMAGE_URL || '/images/news-image.webp';
const CUSTOM_NEWS_LANG_COLUMN_INDEX = Math.max(0, Number(process.env.CUSTOM_NEWS_LANG_COLUMN || 6) - 1);
const CUSTOM_NEWS_TARGET_LANGS = (process.env.CUSTOM_NEWS_LANGS || 'en,sa,india,pakistan,bangladesh')
  .split(',').map(x => x.trim()).filter(Boolean);
const CUSTOM_NEWS_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${CUSTOM_NEWS_SHEET_ID}/export?format=csv&gid=${CUSTOM_NEWS_SHEET_GID}`;
const CUSTOM_NEWS_SYNC_INTERVAL = 7 * 24 * 60 * 60 * 1000;

function parseCustomNewsCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
      continue;
    }
    if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') { field += ch; }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeCustomNewsLang(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'en' || v === 'english') return 'en';
  if (v === 'sa' || v === 'arabic' || v === 'ar' || v === 'saudi') return 'sa';
  if (v === 'india' || v === 'hindi' || v === 'hi' || v === 'in') return 'india';
  if (v === 'pakistan' || v === 'urdu' || v === 'ur' || v === 'pk') return 'pakistan';
  if (v === 'bangladesh' || v === 'bangla' || v === 'bn' || v === 'bd') return 'bangladesh';
  return '';
}

async function syncCustomNews() {
  try {
    const res = await fetch(CUSTOM_NEWS_EXPORT_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csvText = await res.text();
    const rows = parseCustomNewsCsv(csvText);
    if (!rows.length) throw new Error('Empty CSV');

    let startIndex = 0;
    if (String(rows[0]?.[0] || '').trim().toLowerCase() === 'headline' ||
        String(rows[0]?.[0] || '').trim().toLowerCase() === 'title') startIndex = 1;

    const commonItems = [];
    const byLang = {};
    for (const lang of CUSTOM_NEWS_TARGET_LANGS) byLang[lang] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const r = rows[i] || [];
      const title = String(r[0] || '').trim();
      const description = String(r[1] || '').trim();
      const imageUrl = String(r[2] || '').trim();
      const country = String(r[3] || '').trim().toLowerCase();
      const langRaw = String(r[CUSTOM_NEWS_LANG_COLUMN_INDEX] || '').trim();
      if (!title || !description || country !== CUSTOM_NEWS_COUNTRY) continue;
      const item = { title, description, imageUrl: imageUrl || CUSTOM_NEWS_DEFAULT_IMAGE_URL };
      const lang = normalizeCustomNewsLang(langRaw);
      if (!lang) { commonItems.push(item); continue; }
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push(item);
    }

    const output = {};
    const enFallback = byLang.en?.length ? byLang.en : commonItems;
    for (const lang of CUSTOM_NEWS_TARGET_LANGS) {
      const langItems = byLang[lang]?.length ? byLang[lang] : commonItems;
      output[lang] = (langItems.length ? langItems : enFallback).slice(0, CUSTOM_NEWS_MAX_ITEMS);
    }

    const total = Object.values(output).reduce((acc, arr) => acc + arr.length, 0);
    if (total === 0) throw new Error(`No rows for country '${CUSTOM_NEWS_COUNTRY}'`);

    const { readFile, writeFile } = await import('node:fs/promises');
    const jsonPath = new URL('./i18n/custom-news.json', import.meta.url).pathname;
    const json = `${JSON.stringify(output, null, 2)}\n`;

    let prev = '';
    try { prev = await readFile(jsonPath, 'utf8'); } catch {}
    await writeFile(jsonPath, json, 'utf8');

    if (json !== prev) {
      console.log('[custom-news] Новости обновлены из Google Sheets.');
    } else {
      console.log('[custom-news] Новости не изменились.');
    }
  } catch (err) {
    console.error('[custom-news] Ошибка синхронизации:', err.message || err);
  }
}

syncCustomNews();
setInterval(syncCustomNews, CUSTOM_NEWS_SYNC_INTERVAL);

// Первый и единственный запуск сервера (оставить этот)
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  if (process.argv.includes('--open')) {
    exec('$BROWSER http://localhost:5000');
  }
});
