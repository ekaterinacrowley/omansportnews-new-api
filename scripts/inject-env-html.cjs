#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'src', 'index.html');
const content = fs.readFileSync(srcPath, 'utf8');

const apiKey = process.env.API_KEY || '';
if (!apiKey) console.warn('inject-env-html: API_KEY is empty. Resulting HTML will have an empty key.');

// Replace occurrence of const API_KEY = '...'; (single or double quotes)
const replaced = content.replace(/const\s+API_KEY\s*=\s*['"].*?['"];?/, `const API_KEY = '${apiKey}';`);

const tmpDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
const outPath = path.join(tmpDir, 'index.injected.html');
fs.writeFileSync(outPath, replaced, 'utf8');
console.log('inject-env-html: injected API_KEY into', outPath);