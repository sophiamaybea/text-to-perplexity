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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildFilename(text, ext, isSkill) {
  if (isSkill) return 'SKILL.md';
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

/**
 * Build a valid Perplexity SKILL.md file.
 * Rules:
 *  - MUST start with YAML frontmatter block (--- ... ---)
 *  - frontmatter MUST include: name (string), description (string)
 *  - Optional frontmatter fields: version, author, tags (array)
 *  - Body follows after the closing ---
 */
function buildSkillFile(text, skillName, skillDescription, skillVersion, skillAuthor, skillTags) {
  // Escape any YAML-unsafe characters in name/description
  const safeName = (skillName || 'My Skill').replace(/"/g, "'");
  const safeDesc = (skillDescription || 'A Perplexity skill').replace(/"/g, "'");
  const safeVersion = skillVersion || '1.0.0';
  const safeAuthor = skillAuthor || '';

  let frontmatter = `---\nname: "${safeName}"\ndescription: "${safeDesc}"\nversion: "${safeVersion}"`;

  if (safeAuthor) {
    frontmatter += `\nauthor: "${safeAuthor}"`;
  }

  if (skillTags && Array.isArray(skillTags) && skillTags.length > 0) {
    const tagList = skillTags.map(t => `  - ${String(t).trim()}`).join('\n');
    frontmatter += `\ntags:\n${tagList}`;
  }

  frontmatter += '\n---';

  // Strip any existing frontmatter from the body to avoid double-wrapping
  const bodyText = text.replace(/^---[\s\S]*?---\n?/, '').trim();

  return `${frontmatter}\n\n${bodyText}`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/convert', (req, res) => {
  const { text, format = 'auto' } = req.body;
  const validation = validateInput(text);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const ext = resolveFormat(text, format);
  const filename = buildFilename(text, ext, false);
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
  const innerFilename = buildFilename(text, ext, false);
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

/**
 * POST /convert-skill
 * Wraps the input text as a valid Perplexity SKILL.md file.
 * Body: { text, skillName, skillDescription, skillVersion?, skillAuthor?, skillTags? }
 * Returns: SKILL.md download
 */
app.post('/convert-skill', (req, res) => {
  const {
    text,
    skillName,
    skillDescription,
    skillVersion,
    skillAuthor,
    skillTags
  } = req.body;

  const validation = validateInput(text);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  if (!skillName || !skillName.trim()) {
    return res.status(400).json({ error: 'skillName is required for skill files' });
  }
  if (!skillDescription || !skillDescription.trim()) {
    return res.status(400).json({ error: 'skillDescription is required for skill files' });
  }

  const output = buildSkillFile(text, skillName, skillDescription, skillVersion, skillAuthor, skillTags);

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="SKILL.md"');
  res.send(output);
});

// ── Error middleware ───────────────────────────────────────────────────────────

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
