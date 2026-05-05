const SHEET_ID = process.env.CUSTOM_NEWS_SHEET_ID || '1TIrKdVNGt5NDs6gkR9nJgcUiIkDrW8uTG8UUXwSd4LE';
const SHEET_GID = process.env.CUSTOM_NEWS_SHEET_GID || '0';
const FILTER_COUNTRY = (process.env.CUSTOM_NEWS_COUNTRY || 'Oman').toLowerCase();
const MAX_ITEMS_PER_LANG = Number(process.env.CUSTOM_NEWS_MAX_ITEMS || 8);
const DEFAULT_IMAGE_URL = process.env.CUSTOM_NEWS_DEFAULT_IMAGE_URL || '/images/news-image.webp';
const LANG_COLUMN_1_BASED = Number(process.env.CUSTOM_NEWS_LANG_COLUMN || 6);
const LANG_COLUMN_INDEX = Math.max(0, LANG_COLUMN_1_BASED - 1);
const TARGET_LANGS = (process.env.CUSTOM_NEWS_LANGS || 'en,sa,india,pakistan,bangladesh')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeLang(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'en' || v === 'english') return 'en';
  if (v === 'sa' || v === 'arabic' || v === 'ar' || v === 'saudi') return 'sa';
  if (v === 'india' || v === 'hindi' || v === 'hindu' || v === 'hi' || v === 'in') return 'india';
  if (v === 'pakistan' || v === 'urdu' || v === 'ur' || v === 'pk') return 'pakistan';
  if (v === 'bangladesh' || v === 'bangla' || v === 'bn' || v === 'bd') return 'bangladesh';
  return '';
}

function buildOutput(rows) {
  let startIndex = 0;
  const firstRow = rows[0] || [];
  const firstCell = String(firstRow[0] || '').trim().toLowerCase();
  if (firstCell === 'title' || firstCell === 'headline') {
    startIndex = 1;
  }

  const commonItems = [];
  const byLang = {};

  for (const lang of TARGET_LANGS) {
    byLang[lang] = [];
  }

  for (let i = startIndex; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const title = String(r[0] || '').trim();
    const description = String(r[1] || '').trim();
    const imageUrl = String(r[2] || '').trim();
    const country = String(r[3] || '').trim().toLowerCase();
    const langRaw = String(r[LANG_COLUMN_INDEX] || '').trim();

    if (!title || !description) continue;
    if (country !== FILTER_COUNTRY) continue;

    const hasCustomImage = Boolean(imageUrl);
    const item = {
      title,
      description,
      imageUrl: imageUrl || DEFAULT_IMAGE_URL,
      _hasCustomImage: hasCustomImage
    };
    const lang = normalizeLang(langRaw);

    if (!lang) {
      commonItems.push(item);
      continue;
    }

    if (!byLang[lang]) {
      byLang[lang] = [];
    }
    byLang[lang].push(item);
  }

  const output = {};
  const enFallback = byLang.en && byLang.en.length ? byLang.en : commonItems;

  for (const lang of TARGET_LANGS) {
    const langItems = byLang[lang] && byLang[lang].length ? byLang[lang] : commonItems;
    const source = langItems.length ? langItems : enFallback;

    // Keep row order, but prefer items that already have image URLs from the sheet.
    const prioritized = [...source].sort((a, b) => Number(b._hasCustomImage) - Number(a._hasCustomImage));

    const selected = prioritized
      .slice(0, MAX_ITEMS_PER_LANG)
      .map(({ _hasCustomImage, ...item }) => item);

    output[lang] = selected;
  }

  const total = Object.values(output).reduce((acc, arr) => acc + arr.length, 0);
  if (total === 0) {
    throw new Error(`No rows found for country '${FILTER_COUNTRY}'.`);
  }

  return output;
}

async function main() {
  const res = await fetch(EXPORT_URL, {
    headers: { 'Cache-Control': 'no-cache' }
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Google Sheet: ${res.status} ${res.statusText}. ` +
      'Open sheet access to "Anyone with the link (Viewer)" or publish as CSV.'
    );
  }

  const csvText = await res.text();
  const rows = parseCsv(csvText);
  if (!rows.length) {
    throw new Error('Google Sheet returned an empty CSV.');
  }

  const data = buildOutput(rows);
  const json = `${JSON.stringify(data, null, 2)}\n`;

  const fs = await import('node:fs/promises');
  await fs.writeFile('src/i18n/custom-news.json', json, 'utf8');
  await fs.writeFile('public/i18n/custom-news.json', json, 'utf8');

  console.log(`Synced custom news from Google Sheet: ${EXPORT_URL}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
