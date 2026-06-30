# Recruiting Intelligence System — Claude Context

## What This Repo Is
A zero-touch recruiting OS. Four automated input pipelines feed one Notion hub. Every call, email, and LeetCode solve writes itself to Notion automatically. A React dashboard surfaces what needs attention.

## Who Is the candidate
- a university, CS-LSA, Sophomore, a strong GPA
- Graduating May 2028
- Targeting SWE internship and PM internship
- Recruiting season: Fall 2026 (apps open August)

## Tech Stack
| Tool | Role | Cost |
|---|---|---|
| Granola | Call transcription (no bot) | Free |
| Claude API (YC $500) | Intelligence — extraction, drafts, classification | $0 (credits) |
| Gumloop (YC deal) | Email pipeline — 1 active trigger | Free / $37/mo Pro |
| Notion | Central hub — 4 databases | Free |
| LeetNotion extension | LeetCode → Notion auto-sync | Free |
| Claude Cowork (Pro) | Scheduled tasks — daily brief, weekly memo, call processing | $20/mo |
| Exa (YC $250) | Contact enrichment — LinkedIn lookup | $0 (credits) |

## Models in Use
- **Sonnet 4.6** — email extraction, call processing, follow-up drafts, weekly memo
- **Haiku 4.5** — email classification (cheap, binary decision)

## 4 Pipelines
1. **Calls** → Granola → manual copy → Cowork → Notion
2. **Email** → Gmail → Gumloop (1 trigger) → Claude → Notion
3. **LeetCode** → LeetCode solve → LeetNotion extension → Notion (fully automatic)
4. **Weekly Memo** → Cowork scheduled Sunday 8pm → reads all DBs → writes memo

## 4 Notion Databases
- `Contacts DB` — master CRM, one row per person
- `Calls DB` — one row per call, linked to contact
- `Applications DB` — one row per company/role
- `LeetCode Problems DB` — auto-populated by LeetNotion

## Critical Constraints
- Gumloop: **1 active trigger only** — permanently reserved for the email pipeline
- Notion free: no native automations → Cowork morning brief handles reminders instead
- Granola free: notes accessible 30 days only; no auto-Notion push → one manual copy-paste per call
- Cowork: scheduled tasks only run when laptop is on + Claude Desktop is open

## Repo Structure
```
master-build-plan.md        # Source of truth
CLAUDE.md                   # This file
context.md                  # Personal context for Cowork project
plans/                      # Sub-plans, one per build phase
prompts/                    # All Claude prompts ready to copy-paste
notion/                     # DB schema reference
gumloop/                    # Email flow spec
cowork/                     # All Cowork task templates
dashboard/                  # React Inbox Signal dashboard
.worktrees/                 # Git worktrees for parallel branches
```

## Worktree Branches
- `main` — master plan, shared config, sub-plans
- `notion-setup` → `.worktrees/notion-setup/` — DB schema, API setup scripts
- `email-pipeline` → `.worktrees/email-pipeline/` — Gumloop flow, prompts, Gmail filter
- `dashboard` → `.worktrees/dashboard/` — React dashboard (recruiting-dashboard.jsx)
- `cowork-setup` → `.worktrees/cowork-setup/` — All Cowork tasks and templates

## Key Decisions Already Made
- Use Granola over Deepgram (Deepgram needs 6-8h setup; Granola is 5 min)
- Use Exa on-demand in Cowork (not always-on in Gumloop — saves the 1 trigger)
- Notion automations: skip paid plan; use Cowork morning brief for follow-up reminders
- BYOK in Gumloop: routes Sonnet calls through $500 Anthropic credit (saves Gumloop credits)

## Cost Floor
- $20/mo (Claude Pro for Cowork)
- $57/mo if you add Gumloop Pro for BYOK (recommended once email pipeline is validated)
- $71/mo if you add Granola Business for auto-Notion push from calls
