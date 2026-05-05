import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const BASE_URL = process.env.SITEMAP_BASE_URL || 'https://omansportsnews.com';
const now = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0' },
  { loc: `${BASE_URL}/news.html`, changefreq: 'daily', priority: '0.9' }
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(
    ({ loc, changefreq, priority }) =>
      `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  )
  .join('\n')}\n</urlset>\n`;

const targetFiles = [
  resolve(projectRoot, 'src/sitemap.xml'),
  resolve(projectRoot, 'public/sitemap.xml')
];

for (const filePath of targetFiles) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, xml, 'utf8');
}

console.log(`[sitemap] Generated ${targetFiles.length} files with lastmod=${now}`);
