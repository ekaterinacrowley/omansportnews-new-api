import express from "express"
import axios from "axios"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const app = express()
const PORT = 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.static(path.join(__dirname,"public")))

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

app.get("/api/events", async(req,res)=>{
  try{

    const token = await getToken()
    const sportId = req.query.sportId
    const { gtStart, ltStart } = req.query

    const params = {
      ref: REF,
      sportIds: sportId,
      lng: "en"
    }
    if (gtStart) params.gtStart = Number(gtStart)
    if (ltStart) params.ltStart = Number(ltStart)

    const response = await axios.get(
      "https://cpservm.com/gateway/marketing/datafeed/prematch/api/v2/sportevents",
      {
        params,
        headers:{
          Authorization:`Bearer ${token}`
        }
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



// helper to stream an image from the marketing service or redirect to S3
// images are stored in a private S3 bucket; cpservm.com is a CNAME that simply
// returns a PermanentRedirect error telling clients to use the proper endpoint.
//
// The ideal solution is for the provider to supply pre‑signed URLs, but until
// then we can either redirect the browser to the suggested host or act as a
// proxy and let the client see the S3 error (usually 403).
app.get('/api/img/:name', async (req, res) => {
  const { name } = req.params;
  if (!name) return res.status(400).send('name required');


  const s3url = `https://s3.amazonaws.com/downloads/${encodeURIComponent(name)}`;

  try {
    const url = `https://cpservm.com/downloads/${encodeURIComponent(name)}`;
    const r = await axios.get(url, {
      responseType: 'stream',
      maxRedirects: 0,
      validateStatus: (st) => st < 600
    });

    if (r.status === 200) {
      res.setHeader('Content-Type', r.headers['content-type'] || 'application/octet-stream');
      return r.data.pipe(res);
    }

    if (r.status === 301 && r.data) {
      let body = '';
      for await (const chunk of r.data) body += chunk;
      const m = body.match(/<Endpoint>([^<]+)<\/Endpoint>/);
      if (m) {
        const endpoint = m[1];
        const redirectUrl = `https://${endpoint}/downloads/${encodeURIComponent(name)}`;
        return res.redirect(302, redirectUrl);
      }
    }

    // if cpservm gave some other status (529 etc), just redirect straight to S3
    console.warn('IMAGE PROXY non-redirect status', r.status);
    return res.redirect(302, s3url);
  } catch (err) {
    console.error('IMAGE PROXY FAIL:', err.message);
    // upstream hiccup (529 etc) – still redirect, letting browser see 403
    return res.redirect(302, s3url);
  }
});

app.listen(PORT,()=>console.log(`Server started on ${PORT}`))