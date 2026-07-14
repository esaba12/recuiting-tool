import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Vite's built-in server.proxy only does static header injection (see /notion,
// /gh-api, /claude-api below) — Google's API needs a short-lived access token
// minted from the refresh token on every request, so /google-calendar needs real
// middleware instead. Mirrors api/google-calendar.js's logic exactly, so dev and
// prod behavior stay in sync.
function googleCalendarDevProxy(env) {
  return {
    name: 'google-calendar-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/google-calendar', async (req, res) => {
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              refresh_token: env.GOOGLE_REFRESH_TOKEN,
              grant_type: 'refresh_token',
            }),
          })
          const tokenData = await tokenRes.json()
          if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'Token refresh failed')

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = Buffer.concat(chunks)

          const upstream = await fetch(`https://www.googleapis.com${req.url}`, {
            method: req.method,
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
          res.end(text)
        } catch (e) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: `Google auth failed: ${e.message}` } }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname, '..'), '')
  return {
    plugins: [react(), tailwindcss(), googleCalendarDevProxy(env)],
    server: {
      port: 3001,
      proxy: {
        '/notion': {
          target: 'https://api.notion.com',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/notion/, ''),
          headers: {
            'Authorization': `Bearer ${env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        },
        '/gh-api': {
          target: 'https://api.github.com',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/gh-api/, ''),
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'recruiting-os-dashboard',
            ...(env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${env.GITHUB_TOKEN}` } : {}),
          },
        },
        '/gh-contrib': {
          target: 'https://github-contributions-api.jogruber.de',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/gh-contrib/, ''),
        },
        '/claude-api': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/claude-api/, ''),
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          // Vite's proxy forwards the browser's Origin/Referer through by default —
          // Anthropic's API treats that as a direct-browser-access request and
          // rejects it. This call is genuinely server-to-server (this proxy injects
          // the key), so strip both before forwarding. Production's api/claude-api.js
          // never has this problem since it builds a fresh headers object instead of
          // forwarding the incoming request's headers.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
            })
          },
        },
        '/exa': {
          target: 'https://api.exa.ai',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/exa/, ''),
          headers: {
            'x-api-key': env.EXA_API_KEY || '',
          },
          // Strip browser Origin/Referer before forwarding — same precaution as
          // /claude-api above, in case Exa rejects apparent direct-browser calls.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
            })
          },
        },
      },
    },
  }
})
