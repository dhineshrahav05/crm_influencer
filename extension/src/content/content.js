/**
 * Influencer CRM Saver — Content Script v2
 *
 * Flow:
 *  1. Page detected as Instagram profile → FAB appears
 *  2. Background checks if already in CRM → FAB turns green if yes
 *  3. User clicks FAB → scrape (with retry) → POST to backend → toast
 *  No modal. No typing. Fully automated.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let shadowHost  = null;
  let shadowRoot  = null;
  let currentProfile  = null;
  let isChecking  = false;
  let isSaving    = false;
  let isInCrm     = false;
  let lastPath    = '';

  // ── Extension Context Validator ────────────────────────────
  function isContextValid() {
    return typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
  }

  // ── Messaging helper ───────────────────────────────────────
  function sendBg(action, payload) {
    return new Promise((resolve) => {
      try {
        if (!isContextValid()) {
          resolve({ ok: false, error: 'Extension context invalidated. Please refresh the page.' });
          return;
        }
        chrome.runtime.sendMessage({ action, payload }, (res) => {
          if (chrome.runtime?.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { ok: false, error: 'No response from background' });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  }

  // ── Format number ──────────────────────────────────────────
  function fmt(n) {
    if (n == null || n === '') return '';
    n = Number(n);
    if (isNaN(n)) return '';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString();
  }

  // ── Shadow DOM init ────────────────────────────────────────
  function initShadow() {
    if (shadowRoot) return shadowRoot;

    shadowHost = document.createElement('div');
    shadowHost.id = 'crm-ext-host';
    // Zero footprint: doesn't affect page layout or scroll
    shadowHost.style.cssText = 'all:initial;position:fixed;bottom:0;right:0;width:0;height:0;z-index:2147483647;';
    document.body.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Load CSS via <link> (web_accessible_resources must include content.css)
    if (isContextValid() && chrome.runtime.getURL) {
      try {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = chrome.runtime.getURL('src/content/content.css');
        shadowRoot.appendChild(link);
      } catch (e) {
        console.warn('[CRM Extension] Could not load stylesheet:', e.message);
      }
    }

    return shadowRoot;
  }

  // ── Tear down widget ───────────────────────────────────────
  function removeWidget() {
    if (shadowHost) { shadowHost.remove(); shadowHost = null; shadowRoot = null; }
    currentProfile = null;
    isChecking = isSaving = isInCrm = false;
    lastPath = '';
  }

  // ── Toast ──────────────────────────────────────────────────
  const ICONS = {
    success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>`,
  };

  function showToast(message, type = 'success') {
    if (!shadowRoot) return;
    shadowRoot.querySelectorAll('.crm-toast').forEach(t => t.remove());

    const t = document.createElement('div');
    t.className = `crm-toast crm-toast-${type}`;
    t.innerHTML = `${ICONS[type] || ICONS.info}<span>${message}</span>`;
    shadowRoot.appendChild(t);

    setTimeout(() => { if (t.parentNode) t.remove(); }, 4500);
  }

  // ── FAB render & state ─────────────────────────────────────
  function ensureFab() {
    if (!shadowRoot) return null;
    let fab = shadowRoot.querySelector('#crm-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id   = 'crm-fab';
      fab.type = 'button';
      fab.innerHTML = `
        <div class="crm-fab-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </div>
        <span class="crm-fab-text"></span>
      `;
      fab.addEventListener('click', onFabClick);
      shadowRoot.appendChild(fab);
    }
    return fab;
  }

  function updateFab() {
    const fab  = ensureFab();
    const text = fab?.querySelector('.crm-fab-text');
    if (!fab || !text) return;

    if (isChecking) {
      fab.className = 'crm-fab crm-fab-busy';
      fab.disabled  = true;
      text.innerHTML = `<span class="crm-spin"></span>Checking…`;
    } else if (isSaving) {
      fab.className = 'crm-fab crm-fab-busy';
      fab.disabled  = true;
      text.innerHTML = `<span class="crm-spin"></span>Saving…`;
    } else if (isInCrm) {
      fab.className = 'crm-fab crm-fab-saved';
      fab.disabled  = false;
      text.textContent = '✓ In CRM';
    } else {
      fab.className = 'crm-fab';
      fab.disabled  = false;
      text.textContent = '+ Add to CRM';
    }
  }

  // ── Scrape with retry ──────────────────────────────────────
  /**
   * Try to scrape a complete profile. If data is missing critical fields,
   * retry up to `maxRetries` times with `delayMs` gap (React might still be rendering).
   */
  function scrapeWithRetry(maxRetries = 6, delayMs = 500) {
    return new Promise((resolve) => {
      let attempt = 0;

      function tryNow() {
        if (typeof InstagramScraper === 'undefined') {
          resolve(null);
          return;
        }

        const data = InstagramScraper.scrapeProfile();

        // Require follower count to be resolved before considering scrape complete (unless maxRetries reached)
        const hasEnoughData = data && data.username && (
          data.followers !== null && (data.name !== data.username || Boolean(data.profilePicUrl))
        );

        if (hasEnoughData || attempt >= maxRetries) {
          resolve(data);
        } else {
          attempt++;
          setTimeout(tryNow, delayMs);
        }
      }

      tryNow();
    });
  }

  // ── FAB click → one-click save ─────────────────────────────
  async function onFabClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isSaving || isChecking) return;

    if (isInCrm) {
      showToast(`@${currentProfile?.username} is already in your CRM`, 'info');
      return;
    }

    // Re-scrape with retry for freshest DOM state
    isSaving = true;
    updateFab();

    const profile = await scrapeWithRetry();

    if (!profile || !profile.username) {
      isSaving = false;
      updateFab();
      showToast('Could not read profile data — try refreshing the page.', 'error');
      return;
    }

    currentProfile = profile;

    const res = await sendBg('SAVE_INFLUENCER', { influencer: profile });

    isSaving = false;

    if (res.ok && (res.status === 'created' || res.status === 'updated')) {
      isInCrm = true;
      updateFab();
      const followerStr = profile.followers ? ` · ${fmt(profile.followers)} followers` : '';
      showToast(`✓ Saved @${profile.username}${followerStr}`, 'success');
    } else if (res.status === 'duplicate') {
      isInCrm = true;
      updateFab();
      showToast(`@${profile.username} is already in your CRM`, 'info');
    } else {
      updateFab();
      showToast(res.error || "Can't reach the CRM backend — is the server running?", 'error');
    }
  }

  // ── Page detection & init ──────────────────────────────────
  async function checkPage() {
    if (!isContextValid()) {
      removeWidget();
      return;
    }

    const path = window.location.pathname;

    if (typeof ParseUtils === 'undefined' || !ParseUtils.isProfilePage(path)) {
      removeWidget();
      return;
    }

    // Same profile — no need to re-check
    if (path === lastPath) return;
    lastPath = path;

    // Remove previous widget if navigating between profiles
    removeWidget();
    lastPath = path;

    // Scrape (with retry for SPA navigation delay)
    const profile = await scrapeWithRetry();
    if (!profile || !profile.username) {
      lastPath = ''; // allow re-check
      return;
    }
    currentProfile = profile;

    // Render FAB in "Checking…" state
    initShadow();
    isChecking = true;
    updateFab();

    // Ask background if this influencer is already in CRM
    const res = await sendBg('CHECK_EXISTS', { username: profile.username });
    isChecking = false;
    isInCrm = Boolean(res.ok && res.exists);
    updateFab();
  }

  // ── SPA route watcher ──────────────────────────────────────
  const checkInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(checkInterval);
      removeWidget();
      return;
    }
    checkPage();
  }, 1200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPage);
  } else {
    checkPage();
  }
})();

