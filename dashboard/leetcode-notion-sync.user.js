// ==UserScript==
// @name         LeetCode → Notion Sync
// @namespace    recruiting-os
// @version      1.3
// @description  Syncs accepted LeetCode submissions to Notion LC Problems DB
// @author       the candidate
// @match        https://leetcode.com/problems/*
// @grant        GM_xmlhttpRequest
// @grant        window.onurlchange
// @connect      leetcode.com
// @connect      api.notion.com
// ==/UserScript==

// No @sandbox directive — script runs in MAIN_WORLD via browser-native <script> tag injection.
// We don't override any globals (no fetch/XHR patching), so SES lockdown doesn't interfere.
// GM_xmlhttpRequest runs in TM's extension context and bypasses CORS for both domains.

(function () {
  'use strict';

  const NOTION_KEY = 'YOUR_NOTION_INTEGRATION_TOKEN';
  const LC_DB_ID   = '9fc96722-d155-4333-9770-41130fb59a39';

  console.log('[LC→Notion] v1.3 loaded ✓ (ISOLATED_WORLD — SES-exempt)');

  let lastSavedId = null;
  let debounce    = null;

  // ── Detect "Accepted" in DOM ──────────────────────────────────────────────
  const observer = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(checkForAccepted, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Reset on SPA navigation (LeetCode is a React SPA)
  window.onurlchange = () => { lastSavedId = null; };

  function checkForAccepted() {
    // Primary selector — LeetCode's e2e test attribute, stable across UI updates
    const el = document.querySelector('[data-e2e-locator="submission-result"]');
    if (el?.textContent.trim() === 'Accepted') {
      console.log('[LC→Notion] Accepted detected via data-e2e-locator');
      triggerSync();
      return;
    }

    // Fallback — scan spans for standalone "Accepted" text
    for (const span of document.querySelectorAll('span')) {
      if (span.textContent.trim() === 'Accepted' && span.closest('[class*="result"], [class*="submit"]')) {
        console.log('[LC→Notion] Accepted detected via fallback span');
        triggerSync();
        return;
      }
    }
  }

  // ── Main sync flow ────────────────────────────────────────────────────────
  async function triggerSync() {
    const slug = location.pathname.match(/\/problems\/([^/]+)\//)?.[1];
    if (!slug) return;

    console.log('[LC→Notion] Fetching latest accepted submission for:', slug);

    const submissionId = await getLatestAcceptedId(slug);
    if (!submissionId)              { console.warn('[LC→Notion] No submission ID'); return; }
    if (submissionId === lastSavedId) { console.log('[LC→Notion] Already saved, skipping'); return; }
    lastSavedId = submissionId;

    console.log('[LC→Notion] Fetching details for submission:', submissionId);
    const [details, question] = await getSubmissionAndQuestion(submissionId, slug);
    if (!details || !question)      { console.warn('[LC→Notion] Could not load details'); return; }

    saveToNotion(details, question);
  }

  // ── GraphQL: get most recent accepted submission ID for this problem ───────
  function getLatestAcceptedId(slug) {
    return gql(`
      query ($questionSlug: String!, $offset: Int!, $limit: Int!, $status: Int) {
        questionSubmissionList(
          questionSlug: $questionSlug, offset: $offset,
          limit: $limit, status: $status
        ) {
          submissions { id statusDisplay }
        }
      }
    `, { questionSlug: slug, offset: 0, limit: 5, status: 10 })
      .then(data => {
        const subs = data?.questionSubmissionList?.submissions ?? [];
        const hit  = subs.find(s => s.statusDisplay === 'Accepted');
        console.log('[LC→Notion] Submission ID found:', hit?.id);
        return hit?.id ?? null;
      });
  }

  // ── GraphQL: get submission code + problem metadata in one round-trip ─────
  function getSubmissionAndQuestion(submissionId, slug) {
    return gql(`
      query ($submissionId: Int!, $titleSlug: String!) {
        submissionDetails(submissionId: $submissionId) {
          code
          topicTags { name }
          lang { verboseName }
        }
        question(titleSlug: $titleSlug) {
          questionId
          title
          difficulty
        }
      }
    `, { submissionId: parseInt(submissionId, 10), titleSlug: slug })
      .then(data => [data?.submissionDetails ?? null, data?.question ?? null]);
  }

  // ── GraphQL helper — uses GM_xmlhttpRequest to send real session cookies ──
  function gql(query, variables) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method:  'POST',
        url:     'https://leetcode.com/graphql/',
        headers: { 'Content-Type': 'application/json' },
        data:    JSON.stringify({ query, variables }),
        withCredentials: true,
        onload(res) {
          try {
            const json = JSON.parse(res.responseText);
            if (json.errors) console.warn('[LC→Notion] GraphQL errors:', json.errors);
            resolve(json.data ?? null);
          } catch (e) { reject(e); }
        },
        onerror: reject,
      });
    });
  }

  // ── Write to Notion ───────────────────────────────────────────────────────
  function saveToNotion(details, question) {
    const title  = `${question.title} — LC #${question.questionId}`;
    const topics = (details.topicTags ?? []).map(t => ({ name: t.name }));
    const today  = new Date().toISOString().split('T')[0];
    const code   = details.code ?? '';

    // Notion rich_text blocks cap at 2000 chars — split long solutions
    const codeBlocks = [];
    for (let i = 0; i < code.length || codeBlocks.length === 0; i += 2000) {
      codeBlocks.push({ type: 'text', text: { content: code.slice(i, i + 2000) } });
    }

    console.log('[LC→Notion] Saving to Notion:', title);

    GM_xmlhttpRequest({
      method:  'POST',
      url:     'https://api.notion.com/v1/pages',
      headers: {
        'Authorization':  `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':   'application/json',
      },
      data: JSON.stringify({
        parent:     { database_id: LC_DB_ID },
        properties: {
          'Problem':       { title: [{ text: { content: title } }] },
          'Difficulty':    { select: { name: question.difficulty } },
          'Topics':        { multi_select: topics },
          'Status':        { select: { name: 'Solved' } },
          'Solution Code': { rich_text: codeBlocks },
          'Solved Date':   { date: { start: today } },
        },
      }),
      onload(res) {
        try {
          const data = JSON.parse(res.responseText);
          if (data.id) {
            console.log('[LC→Notion] ✓ Saved! Page ID:', data.id);
            showToast('✓ Saved to Notion!');
          } else {
            console.error('[LC→Notion] Notion error:', data);
            showToast('❌ Notion error — see console');
          }
        } catch (_) { showToast('❌ Parse error'); }
      },
      onerror(e) {
        console.error('[LC→Notion] Notion request failed:', e);
        showToast('❌ Could not reach Notion');
      },
    });
  }

  function showToast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px',
      'background:#1a1a1a', 'color:#fff',
      'padding:12px 20px', 'border-radius:8px',
      'font:14px/1 -apple-system,sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.4)',
      'z-index:999999', 'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
  }

})();
