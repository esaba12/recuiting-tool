# Phase 2 — LeetCode Sync

**Branch:** `notion-setup` (worktree at `.worktrees/notion-setup/`)  
**Time:** ~15 minutes  
**Day:** Day 1 (do this right after Phase 1)  
**Deliverable:** Every LeetCode solve auto-logs to Notion — zero ongoing effort

---

## What You're Building

An automatic bridge: you solve a LeetCode problem → submit → it appears in your Notion LC Problems DB with title, difficulty, topics, your solution code, and timestamp. No manual step.

The extension hooks into LeetCode's submission API. When a submission is accepted, it calls the Notion API directly and creates a new row. It's genuinely zero-touch after setup.

---

## Prerequisites

- Phase 1 complete — LC Problems DB exists in Notion with correct schema
- Notion API key (from Phase 1, Step 3)
- LC Problems DB ID (from Phase 1, Step 5)
- VS Code installed (or Chrome browser if using Option B)

---

## Option A: VS Code Extension (Recommended)

This is the better option if you solve in VS Code. The extension integrates directly with your editor so you never have to leave to trigger the sync.

### Step 1: Install the Extension

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search: "leetnotion"
4. Install the extension by "LeetNotion" (not "LeetCode for VS Code" — different extension)

### Step 2: Get the LeetNotion Notion Template

The extension README has a link to duplicate the official LeetNotion Notion template. This template is pre-configured with:
- All required properties in the right types
- The "Due for Review" spaced repetition view already set up
- Correct formula for Review Date

**Option:** If you already created the LC Problems DB manually in Phase 1 with the correct schema, you can use that database. But the template is easier — it saves 10 minutes of manual property configuration.

If using the template: duplicate it into your Notion workspace. This becomes your LC Problems DB. Get its Database ID (Phase 1, Step 5 instructions). Share it with your Notion integration.

### Step 3: Configure the Extension

In VS Code:
1. Open Command Palette (Cmd+Shift+P)
2. Type "LeetNotion: Configure" → select it
3. Enter your Notion API key when prompted
4. Enter your LC Problems Database ID when prompted
5. Extension saves these settings.

### Step 4: Verify the Connection

1. Solve any practice LeetCode problem in VS Code (use the LeetCode VS Code extension to pull problems)
2. Submit successfully
3. Within 5-10 seconds, a new row should appear in your Notion LC Problems DB
4. Verify: problem name, difficulty, topics, and your solution code are populated

---

## Option B: Browser Extension

Use this if you prefer to solve on leetcode.com directly.

### Step 1: Install LeetNotion Sync

- Chrome: Chrome Web Store → search "LeetNotion Sync" → Install
- Firefox: Firefox Add-ons → search "LeetNotion Sync" → Add to Firefox

### Step 2: Configure via the Extension Wizard

1. Click the LeetNotion Sync icon in your browser toolbar
2. The extension shows a setup wizard — paste your Notion API key and LC Problems Database ID
3. Click Save

### Step 3: Verify

1. Go to leetcode.com → solve any problem → submit
2. On accepted submission, the extension shows a small popup: "Saved to Notion ✓"
3. Check your Notion LC Problems DB — the row should be there

---

## What Gets Auto-Logged Per Submission

| Field | Source |
|---|---|
| Problem title | LeetCode |
| LC number | LeetCode |
| Difficulty | LeetCode |
| Topic tags | LeetCode (Array, DP, Graph, Tree, etc.) |
| Solution code | Your submitted code |
| Submission timestamp | → Solved Date |
| Status | Set to "Solved" |
| Review Date | Calculated by formula (Easy: +7 days, Medium: +3 days, Hard: +1 day) |

Fields NOT auto-filled (fill manually):
- Time to Solve
- Optimal (checkbox)
- Notes

---

## Spaced Repetition Workflow

After setup, your daily LC practice works like this:

1. Open Notion → LC Problems DB → "Due for Review" view
2. This shows all problems where `Review Date ≤ Today AND Status = Solved`
3. Re-solve the problems in this queue
4. Update their Solved Date → Review Date recalculates automatically

No external spaced repetition tool needed. It's built into the formula.

---

## Troubleshooting

**Problem doesn't appear after submit:**
- Make sure the submission was "Accepted" — the extension only triggers on accepted submissions, not failed ones
- Check that the DB was shared with your Notion integration (Phase 1, Step 4)
- Verify the Database ID in extension settings has the correct format (with hyphens)

**Extension shows an error:**
- Most common cause: Notion API key has expired or the integration lost access to the DB. Re-share the DB with the integration in Notion settings.

**Wrong database being written to:**
- The extension may have the wrong Database ID. Re-run the configuration step.

---

## Deliverable Checklist

- [ ] LeetNotion extension installed (VS Code or browser)
- [ ] Notion API key entered in extension settings
- [ ] LC Problems DB ID entered in extension settings
- [ ] Test submission creates a row in Notion with correct data
- [ ] "Due for Review" view exists and filters correctly

---

## What Comes Next

This pipeline is done. It will run automatically forever. Move to Phase 3 (Granola setup).

The LC data feeds into the Weekly Recruiting Memo (Phase 6 → Appendix C, Task 2) where Cowork reads your weekly solves and includes them in the Sunday memo.
