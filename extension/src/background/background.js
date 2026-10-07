/**
 * Influencer CRM Saver — Background Service Worker
 * Handles all backend API requests with 8-second AbortController timeouts,
 * consistent response payloads, and chrome.storage.sync settings.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:5000';
const FETCH_TIMEOUT_MS = 8000;

/**
 * Retrieve normalized API base URL from chrome.storage.sync
 * @returns {Promise<string>}
 */
async function getApiBaseUrl() {
  try {
    const result = await chrome.storage.sync.get(['apiBaseUrl']);
    let url = result.apiBaseUrl || DEFAULT_API_BASE_URL;
    url = url.trim().replace(/\/+$/, '');
    if (url.endsWith('/api')) {
      url = url.slice(0, -4);
    }
    return url;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

/**
 * Helper to perform HTTP fetch with an 8-second timeout using AbortController
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s. Is the CRM backend running?`);
    }
    throw new Error(err.message || 'Network error communicating with CRM server.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request || {};

  // 1. CHECK_EXISTS: GET {API}/api/influencers/check/{username}
  if (action === 'CHECK_EXISTS') {
    (async () => {
      try {
        const username = encodeURIComponent(String(payload.username || '').trim().toLowerCase());
        if (!username) {
          return sendResponse({ ok: false, status: 'error', error: 'Username is required.' });
        }

        const apiBase = await getApiBaseUrl();
        const targetUrl = `${apiBase}/api/influencers/check/${username}`;

        const res = await fetchWithTimeout(targetUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok) {
          return sendResponse({
            ok: false,
            status: 'error',
            error: data.message || `Server returned status ${res.status}`
          });
        }

        sendResponse({
          ok: true,
          status: 'success',
          exists: Boolean(data.exists),
          data: data.data || null
        });
      } catch (err) {
        console.error('[Background] CHECK_EXISTS Error:', err);
        sendResponse({
          ok: false,
          status: 'error',
          error: err.message || "Can't reach CRM server. Is the backend running?"
        });
      }
    })();
    return true; // Keep message channel open for async response
  }

  // 2. SAVE_INFLUENCER: POST {API}/api/influencers
  if (action === 'SAVE_INFLUENCER') {
    (async () => {
      try {
        const influencerData = payload.data || payload.influencer;
        if (!influencerData || !influencerData.username) {
          return sendResponse({ ok: false, status: 'error', error: 'Invalid influencer payload.' });
        }

        const apiBase = await getApiBaseUrl();
        const targetUrl = `${apiBase}/api/influencers`;

        const res = await fetchWithTimeout(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(influencerData)
        });

        const data = await res.json();

        // 201 Created
        if (res.status === 201) {
          // Persist to recentSaves in storage.local for popup display
          try {
            const stored = await chrome.storage.local.get(['recentSaves']);
            const recent = Array.isArray(stored.recentSaves) ? stored.recentSaves : [];
            // Prepend new save, deduplicate by username, keep max 10
            const updated = [influencerData, ...recent.filter(r => r.username !== influencerData.username)].slice(0, 10);
            await chrome.storage.local.set({ recentSaves: updated });
          } catch (_) { /* Non-critical, ignore */ }

          return sendResponse({
            ok: true,
            status: 'created',
            data: data.data
          });
        }

        // 409 Conflict (Duplicate)
        if (res.status === 409) {
          return sendResponse({
            ok: false,
            status: 'duplicate',
            existing: data.data || null,
            error: data.message || 'Influencer already exists in CRM.'
          });
        }

        // Other validation or server error
        const errorDetail = data.errors ? data.errors.map((e) => e.message).join('; ') : data.message;
        sendResponse({
          ok: false,
          status: 'error',
          error: errorDetail || `Server returned HTTP ${res.status}`
        });
      } catch (err) {
        console.error('[Background] SAVE_INFLUENCER Error:', err);
        sendResponse({
          ok: false,
          status: 'error',
          error: err.message || "Can't reach CRM server. Is the backend running?"
        });
      }
    })();
    return true;
  }

  // 3. UPDATE_INFLUENCER: PUT {API}/api/influencers/{username}
  if (action === 'UPDATE_INFLUENCER') {
    (async () => {
      try {
        const username = encodeURIComponent(String(payload.username || '').trim().toLowerCase());
        if (!username) {
          return sendResponse({ ok: false, status: 'error', error: 'Username is required.' });
        }

        const apiBase = await getApiBaseUrl();
        const targetUrl = `${apiBase}/api/influencers/${username}`;

        const updateBody = {
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.bio !== undefined && { bio: payload.bio }),
          ...(payload.followers !== undefined && { followers: payload.followers }),
          ...(payload.tags !== undefined && { tags: payload.tags }),
          ...(payload.notes !== undefined && { notes: payload.notes })
        };

        const res = await fetchWithTimeout(targetUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(updateBody)
        });

        const data = await res.json();

        if (!res.ok) {
          const errorDetail = data.errors ? data.errors.map((e) => e.message).join('; ') : data.message;
          return sendResponse({
            ok: false,
            status: 'error',
            error: errorDetail || `Failed to update influencer (HTTP ${res.status})`
          });
        }

        sendResponse({
          ok: true,
          status: 'updated',
          data: data.data
        });
      } catch (err) {
        console.error('[Background] UPDATE_INFLUENCER Error:', err);
        sendResponse({
          ok: false,
          status: 'error',
          error: err.message || "Can't reach CRM server. Is the backend running?"
        });
      }
    })();
    return true;
  }

  // 4. GET_SETTINGS
  if (action === 'GET_SETTINGS') {
    (async () => {
      try {
        const result = await chrome.storage.sync.get(['apiBaseUrl']);
        sendResponse({
          ok: true,
          status: 'success',
          data: { apiBaseUrl: result.apiBaseUrl || DEFAULT_API_BASE_URL }
        });
      } catch (err) {
        sendResponse({ ok: false, status: 'error', error: err.message });
      }
    })();
    return true;
  }

  // 5. SET_SETTINGS
  if (action === 'SET_SETTINGS') {
    (async () => {
      try {
        let cleanUrl = String(payload.apiBaseUrl || '').trim().replace(/\/+$/, '');
        if (cleanUrl.endsWith('/api')) {
          cleanUrl = cleanUrl.slice(0, -4);
        }
        await chrome.storage.sync.set({ apiBaseUrl: cleanUrl });
        sendResponse({
          ok: true,
          status: 'success',
          data: { apiBaseUrl: cleanUrl }
        });
      } catch (err) {
        sendResponse({ ok: false, status: 'error', error: err.message });
      }
    })();
    return true;
  }

  // 6. TEST_CONNECTION: GET {API}/api/health
  if (action === 'TEST_CONNECTION') {
    (async () => {
      try {
        let hostUrl = payload && payload.apiBaseUrl ? payload.apiBaseUrl : await getApiBaseUrl();
        hostUrl = hostUrl.trim().replace(/\/+$/, '');
        const healthUrl = hostUrl.endsWith('/api') ? `${hostUrl}/health` : `${hostUrl}/api/health`;

        const res = await fetchWithTimeout(healthUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok) {
          return sendResponse({
            ok: false,
            status: 'error',
            error: data.message || `Health check failed (HTTP ${res.status})`
          });
        }

        sendResponse({
          ok: true,
          status: 'healthy',
          data
        });
      } catch (err) {
        sendResponse({
          ok: false,
          status: 'error',
          error: err.message || 'Cannot reach CRM server.'
        });
      }
    })();
    return true;
  }

  // 7. GET_RECENT_SAVES — reads the last 10 saved profiles from chrome.storage.local
  if (action === 'GET_RECENT_SAVES') {
    (async () => {
      try {
        const result = await chrome.storage.local.get(['recentSaves']);
        const list = Array.isArray(result.recentSaves) ? result.recentSaves : [];
        sendResponse({
          ok: true,
          status: 'success',
          data: list
        });
      } catch (err) {
        sendResponse({ ok: false, status: 'error', error: err.message });
      }
    })();
    return true;
  }
});
