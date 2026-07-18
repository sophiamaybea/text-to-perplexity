const express = require('express');
const cors = require('cors');
const archiver = require('archiver');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

app.use(cors());
app.use(express.json({ limit: '22mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectFormat(text) {
  const mdTokens = /^#{1,6}\s|^[\*\-\+]\s|^>\s|```|\[.+?\]\(.+?\)|^\d+\.\s|\*\*.+?\*\*|__.+?__|^---/m;
  return mdTokens.test(text) ? 'md' : 'txt';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, '')
    .trim()
    .replace(/[\s\-]+/g, '-')
    .substring(0, 60)
    || 'document';
}

function buildFilename(text, ext) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || 'document';
  const slug = slugify(firstLine.replace(/^#+\s*/, ''));
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${slug}-${dateStr}.${ext}`;
}

function resolveFormat(text, requestedFormat) {
  if (requestedFormat === 'md') return 'md';
  if (requestedFormat === 'txt') return 'txt';
  return detectFormat(text);
}

function validateInput(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, status: 400, error: 'Input text is required' };
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) {
    return { valid: false, status: 413, error: 'Input exceeds 20 MB limit. Please reduce your text and try again.' };
  }
  if (text.trim().length === 0) {
    return { valid: false, status: 400, error: 'Input text is required' };
  }
  return { valid: true };
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.post('/convert', (req, res) => {
  const { text, format = 'auto' } = req.body;
  const validation = validateInput(text);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const ext = resolveFormat(text, format);
  const filename = buildFilename(text, ext);
  const mimeType = ext === 'md' ? 'text/markdown' : 'text/plain';

  res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(text);
});

app.post('/convert-zip', (req, res) => {
  const { text, format = 'auto' } = req.body;
  const validation = validateInput(text);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const ext = resolveFormat(text, format);
  const innerFilename = buildFilename(text, ext);
  const zipFilename = innerFilename.replace(`.${ext}`, '.zip');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => {
    console.error('Archiver error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create zip archive' });
    }
  });

  archive.pipe(res);
  archive.append(text, { name: innerFilename });
  archive.finalize();
});

// ── Error middleware ──────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large. Max payload is 22 MB.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`text-to-perplexity server running on http://localhost:${PORT}`);
});
