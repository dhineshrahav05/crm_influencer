/**
 * Influencer CRM Saver — Popup Controller
 * All field names aligned with background.js response shapes.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrlInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const apiStatusPill = document.getElementById('apiStatusPill');
  const connectionStatusMsg = document.getElementById('connectionStatusMsg');
  const recentList = document.getElementById('recentList');
  const emptyRecent = document.getElementById('emptyRecent');

  let currentApiUrl = 'http://localhost:5000';

  /**
   * Helper to send messages to background worker
   */
  function sendMessage(action, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, payload }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(res || { ok: false });
        }
      });
    });
  }

  /**
   * Update Status Pill UI
   */
  function setStatus(isOnline, text) {
    apiStatusPill.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    apiStatusPill.innerHTML = `<span class="dot"></span> ${text || (isOnline ? 'Connected' : 'Offline')}`;
  }

  /**
   * Test Connection to API
   * background.js TEST_CONNECTION expects: payload.apiBaseUrl
   * background.js responds: { ok, status, data }
   */
  async function testConnection(url) {
    setStatus(false, 'Testing...');
    connectionStatusMsg.textContent = '';

    const targetUrl = (url || apiUrlInput.value).trim();
    const res = await sendMessage('TEST_CONNECTION', { apiBaseUrl: targetUrl });

    if (res.ok) {
      setStatus(true, 'Connected');
      connectionStatusMsg.className = 'connection-status-msg success';
      connectionStatusMsg.textContent = '✓ Successfully connected to CRM server!';
    } else {
      setStatus(false, 'Offline');
      connectionStatusMsg.className = 'connection-status-msg error';
      connectionStatusMsg.textContent = `✗ ${res.error || 'Server not reachable'}`;
    }
  }

  /**
   * Load Initial Settings
   * background.js GET_SETTINGS responds: { ok, data: { apiBaseUrl } }
   */
  const settingsRes = await sendMessage('GET_SETTINGS');
  if (settingsRes.ok && settingsRes.data && settingsRes.data.apiBaseUrl) {
    currentApiUrl = settingsRes.data.apiBaseUrl;
  }
  apiUrlInput.value = currentApiUrl;

  // Test connection on popup open
  testConnection(currentApiUrl);

  /**
   * Save Settings
   * background.js SET_SETTINGS expects: payload.apiBaseUrl
   * background.js responds: { ok, data: { apiBaseUrl } }
   */
  saveSettingsBtn.addEventListener('click', async () => {
    const newUrl = apiUrlInput.value.trim();
    if (!newUrl) return;

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Saving...';

    const saveRes = await sendMessage('SET_SETTINGS', { apiBaseUrl: newUrl });
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = 'Save';

    if (saveRes.ok && saveRes.data && saveRes.data.apiBaseUrl) {
      currentApiUrl = saveRes.data.apiBaseUrl;
      testConnection(currentApiUrl);
    } else {
      connectionStatusMsg.className = 'connection-status-msg error';
      connectionStatusMsg.textContent = `✗ Failed to save settings: ${saveRes.error || 'Unknown error'}`;
    }
  });

  /**
   * Test Connection Button
   */
  testConnectionBtn.addEventListener('click', () => {
    testConnection(apiUrlInput.value.trim());
  });

  /**
   * Open CRM Dashboard Button
   * chrome.tabs is available to popup without a declared "tabs" permission
   */
  openDashboardBtn.addEventListener('click', () => {
    let dashUrl = currentApiUrl.replace(/\/+$/, '');
    if (dashUrl.endsWith('/api')) {
      dashUrl = dashUrl.slice(0, -4);
    }
    const fullDashboardUrl = `${dashUrl}/dashboard`;
    chrome.tabs.create({ url: fullDashboardUrl });
  });

  /**
   * Render Recent Captures from chrome.storage.local
   * Saved by content.js after each successful add via SAVE_INFLUENCER.
   */
  async function loadRecentSaves() {
    let list = [];
    try {
      const result = await chrome.storage.local.get(['recentSaves']);
      list = Array.isArray(result.recentSaves) ? result.recentSaves : [];
    } catch (_) {
      list = [];
    }

    if (list.length === 0) {
      recentList.innerHTML = '';
      emptyRecent.style.display = 'block';
      return;
    }

    emptyRecent.style.display = 'none';
    recentList.innerHTML = list
      .map((item) => {
        const username = item.username || 'unknown';
        const name = item.name || username;
        const initial = (name.charAt(0) || username.charAt(0) || 'U').toUpperCase();
        const followersNum = Number(item.followers);
        const followersStr = followersNum >= 1_000_000
          ? `${(followersNum / 1_000_000).toFixed(1)}M followers`
          : followersNum >= 1_000
          ? `${(followersNum / 1_000).toFixed(1)}K followers`
          : followersNum > 0
          ? `${followersNum} followers`
          : 'Profile saved';

        const avatarHtml = item.profilePicUrl
          ? `<img class="recent-avatar" src="${item.profilePicUrl}" alt="${username}" onerror="this.outerHTML='<div class=\\'recent-avatar-fallback\\'>${initial}</div>';" />`
          : `<div class="recent-avatar-fallback">${initial}</div>`;

        return `
          <div class="recent-item" title="@${username}">
            ${avatarHtml}
            <div class="recent-info">
              <div class="recent-username">@${username}</div>
              <div class="recent-followers">${followersStr}</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  loadRecentSaves();
});
