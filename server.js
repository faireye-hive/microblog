import express from 'express';
import path from 'path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { cspHttpHeader } from './js/security/csp-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlFile = path.join(__dirname, 'index.html');

// Keep Express and GitHub Pages on the SAME policy: GitHub Pages reads the
// CSP meta tag, while Express also sends it as an HTTP response header.
const html = readFileSync(htmlFile, 'utf8');
const pageCspHeader = cspHttpHeader(html);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // frame-ancestors cannot be delivered through <meta>; it is header-only.
  if (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path)) {
    res.setHeader('Content-Security-Policy', pageCspHeader);
  }
  next();
});

// Serve static assets from project root.
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing.
app.get('*', (req, res) => {
  res.sendFile(htmlFile);
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
