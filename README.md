# text-to-perplexity

Convert any pasted text or dropped file into a **Perplexity Space–ready** `.md` or `.txt` file — with instant browser download and optional `.zip` packaging.

---

## Features

- **Drag-and-drop** or paste any text
- **Auto-detects** Markdown syntax to choose `.md` vs `.txt`
- **Force format** override (Markdown / Plain Text)
- **Character counter** with 18M-char soft warning
- **Download as** `.md`/`.txt` or `.zip`
- **Filename** auto-derived from your first line (slugified + date)
- Dark-mode UI, zero external dependencies on the frontend

---

## Quick Start

```bash
npm install
node server.js
```

Then open [http://localhost:3000](http://localhost:3000).

For development with auto-reload (Node 18+):

```bash
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Port the Express server listens on |

Create a `.env` file (never committed) if you want to override:

```
PORT=8080
```

> **Note:** The app does not currently load `.env` automatically. Set `PORT` via your shell or hosting platform.

---

## API Reference

### `POST /convert`

Converts text and returns a file download.

**Request body (JSON):**
```json
{
  "text": "# My Document\n\nHello world.",
  "format": "auto"
}
```

`format` accepts: `"auto"` | `"md"` | `"txt"`

**Response:** File download with `Content-Disposition: attachment; filename="my-document-20260718.md"`

---

### `POST /convert-zip`

Same input as `/convert`. Returns a `.zip` archive containing the converted file.

---

## Uploading to a Perplexity Space

1. Go to [perplexity.ai](https://perplexity.ai) and sign in
2. Navigate to **Spaces** in the left sidebar
3. Open the Space you want to add knowledge to (or create a new one)
4. Click **Add Sources** → **Upload File**
5. Select your downloaded `.md` or `.txt` file
6. Wait for indexing to complete — Perplexity will confirm when the file is ready

> ⚠️ Do **not** upload `.zip` files directly to Spaces — unzip first and upload the inner `.md`/`.txt` file.

---

## Perplexity File Format Notes

| Format | Use when |
|--------|----------|
| `.md`  | Content has headings, lists, code blocks, or links — Perplexity indexes structure |
| `.txt` | Plain prose, no Markdown syntax |
| `.zip` | Only for archival — extract before uploading to Spaces |

**Max file size:** 25 MB (app warns at ~18M characters)

---

## Deploying to Vercel / Railway

### Vercel (serverless)
1. Push this repo to GitHub (already done)
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Set **Framework Preset** to `Other`
4. Add environment variable `PORT` if needed
5. Deploy — Vercel will run `node server.js` via the start script

> ⚠️ `archiver` streaming works best on Railway or Render (long-lived servers). On Vercel, the `/convert-zip` endpoint may hit the 10s serverless timeout for very large files.

### Railway (recommended for streaming)
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select `text-to-perplexity`
3. Set `PORT` environment variable if desired
4. Deploy — Railway auto-detects `npm start`

---

## License

MIT
