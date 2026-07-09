import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname, '..'), '')
  return {
    plugins: [react(), tailwindcss()],
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
        },
      },
    },
  }
})
