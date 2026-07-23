import { claudeJSON, claudeText, CLAUDE_MODELS } from './claude.js'
import { openaiJSON, openaiText, OPENAI_MODELS } from './openai.js'

// Single switch for every text-only AI call in the app. Defaults to Claude — flip it by
// setting VITE_AI_PROVIDER=openai in .env (repo root, same place NOTION_API_KEY etc.
// live) and restarting the dev server, or by setting the same var in Vercel's env vars
// for production. No code edit required either way.
//
// Both providers are always wired and ready (see lib/claude.js / lib/openai.js) — this
// file only decides which one every `aiJSON`/`aiText` call actually hits, via one
// resolved constant, so switching is a one-line env change instead of touching the ~8
// call sites (job blurbs/analysis, deadline extraction, contact enrichment, company
// ranking, call/email/LinkedIn extraction, timeline scanning, drafting).
//
// Vision (AddToCalendarModal's screenshot→event extraction) is NOT part of this switch —
// it always calls lib/claude.js's Sonnet vision directly, since OpenAI's image
// content-block format differs enough to need its own tested migration.
const requested = (import.meta.env.VITE_AI_PROVIDER || 'claude').toLowerCase()
export const AI_PROVIDER = requested === 'openai' ? 'openai' : 'claude'
export const AI_PROVIDER_LABEL = AI_PROVIDER === 'openai' ? 'GPT' : 'Claude'

// Provider-agnostic model tiers — MINI for cheap/fast structured extraction, STANDARD
// for heavier judgment calls (company ranking, call/email extraction). Resolves to
// whichever provider is active, so callers never reference a provider-specific model
// name directly.
const TIER_MAP = {
  claude: { MINI: CLAUDE_MODELS.HAIKU, STANDARD: CLAUDE_MODELS.SONNET },
  openai: { MINI: OPENAI_MODELS.MINI, STANDARD: OPENAI_MODELS.STANDARD },
}
export const AI_MODELS = TIER_MAP[AI_PROVIDER]

export async function aiText({ model, content, maxTokens }) {
  return AI_PROVIDER === 'openai'
    ? openaiText({ model, content, maxTokens })
    : claudeText({ model, content, maxTokens })
}

export async function aiJSON({ model, content, maxTokens }) {
  return AI_PROVIDER === 'openai'
    ? openaiJSON({ model, content, maxTokens })
    : claudeJSON({ model, content, maxTokens })
}
