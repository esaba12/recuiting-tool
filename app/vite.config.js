import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Vite's built-in server.proxy only does static header injection, which stopped
// being enough once every proxy needed to (a) verify the caller's Supabase
// session and (b) look up THAT user's own BYOK key before forwarding — real
// per-request server logic, not just a header. Rather than reimplement that
// logic twice (once here, once in api/*.js), this middleware runs the actual
// Vercel serverless function handlers directly against Vite's dev server, so
// dev and prod share one code path — no drift possible between them.
function nodeResShim(res) {
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
  res.send = (data) => { res.end(typeof data === 'string' ? data : JSON.stringify(data)) }
  return res
}

async function readJsonBody(req) {
  if (['GET', 'HEAD'].includes(req.method)) return undefined
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch { return raw }
}

// mode 'proxy': builds req.query.path from the mounted-prefix-stripped URL, the
//   same shape api/claude-api.js etc. expect (mirrors vercel.json's `?path=` rewrites).
// mode 'direct': req.query is just this request's own query string (used for
//   api/keys.js, api/google-connect.js — not `?path=` proxies).
function mountApiHandler(mountPath, apiFile, mode = 'proxy') {
  const absPath = path.join(__dirname, 'api', apiFile)
  return {
    name: `dev-api-${mountPath}`,
    configureServer(server) {
      server.middlewares.use(mountPath, async (req, res) => {
        try {
          const { default: handler } = await import(pathToFileURL(absPath).href)
          const url = new URL(req.url, 'http://localhost')
          const params = Object.fromEntries(url.searchParams)
          req.query = mode === 'proxy'
            ? { path: url.pathname.replace(/^\//, ''), ...params }
            : params
          req.body = await readJsonBody(req)
          nodeResShim(res)
          await handler(req, res)
        } catch (e) {
          nodeResShim(res)
          res.status(500).json({ error: { message: e.message } })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname, '..'), '')
  // api/*.js reads from process.env (Vercel's runtime convention) — mirror the
  // loaded .env values onto process.env in dev so the same handler code works
  // unmodified in both places.
  Object.assign(process.env, env)

  return {
    plugins: [
      react(),
      tailwindcss(),
      mountApiHandler('/claude-api', 'claude-api.js'),
      mountApiHandler('/openai-api', 'openai.js'),
      mountApiHandler('/exa', 'exa.js'),
      mountApiHandler('/gh-api', 'gh-api.js'),
      mountApiHandler('/gh-contrib', 'gh-contrib.js'),
      mountApiHandler('/google-calendar', 'google-calendar.js'),
      mountApiHandler('/api/keys', 'keys.js', 'direct'),
      mountApiHandler('/api/google-connect', 'google-connect.js', 'direct'),
    ],
    server: {
      port: 3001,
    },
  }
})
