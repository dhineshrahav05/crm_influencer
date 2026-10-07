/**
 * Influencer CRM Saver — Instagram DOM & Meta Scraper v2
 *
 * Priority order:
 *  1. window._sharedData / JSON-LD (page-level JSON, most accurate)
 *  2. <meta> OG tags (server-rendered, works on direct page loads)
 *  3. DOM heuristics (works on SPA navigation after React renders)
 *
 * All methods are safe — nothing throws to the caller.
 */

const InstagramScraper = {
  /**
   * Main scrape entrypoint. Returns a structured profile object or null.
   */
  scrapeProfile() {
    try {
      const username = ParseUtils.extractUsername(window.location.pathname);
      if (!username) return null;

      const profileUrl = `https://www.instagram.com/${username}/`;

      // Collect from all three sources
      const jsonData  = this._fromPageJson(username);
      const metaData  = this._fromMeta(username);
      const domData   = this._fromDOM(username);

      const bioText = (domData.bio || jsonData.bio || metaData.bio || '').trim();

      // Automatically extract tagged handles (@username) and hashtags (#tag) from bio
      const extractedTags = [];
      if (bioText) {
        // Extract @mentions (e.g. @mahi7781 -> mahi7781)
        const mentions = bioText.match(/@([a-zA-Z0-9._]{1,30})/g) || [];
        for (const m of mentions) {
          const handle = m.slice(1).toLowerCase().replace(/[._]+$/, '');
          if (handle && handle !== username.toLowerCase() && !extractedTags.includes(handle)) {
            extractedTags.push(handle);
          }
        }

        // Extract #hashtags (e.g. #cricket -> cricket)
        const hashtags = bioText.match(/#([a-zA-Z0-9._]{1,30})/g) || [];
        for (const h of hashtags) {
          const tag = h.slice(1).toLowerCase();
          if (tag && !extractedTags.includes(tag)) {
            extractedTags.push(tag);
          }
        }
      }

      // Merge: JSON > DOM > meta (DOM is live on SPA navigation)
      const result = {
        username,
        name:        (jsonData.name || domData.name || metaData.name || username).trim(),
        profileUrl,
        bio:         bioText,
        tags:        extractedTags,
        followers:   jsonData.followers  ?? domData.followers  ?? metaData.followers,
        following:   jsonData.following  ?? domData.following  ?? metaData.following,
        postsCount:  jsonData.postsCount ?? domData.postsCount ?? metaData.postsCount,
        isVerified:  this._isVerified(),
        profilePicUrl: (domData.profilePicUrl || metaData.profilePicUrl || '').trim(),
        externalUrl:   (domData.externalUrl || '').trim(),
      };

      return result;
    } catch (err) {
      console.warn('[CRM Scraper] Error:', err);
      const username = ParseUtils.extractUsername(window.location.pathname) || '';
      return {
        username, name: username,
        profileUrl: username ? `https://www.instagram.com/${username}/` : '',
        bio: '', followers: null, following: null, postsCount: null,
        isVerified: false, profilePicUrl: '', externalUrl: ''
      };
    }
  },

  // ────────────────────────────────────────────────────────────
  // Strategy 1: Page-level JSON (window._sharedData / JSON-LD)
  // ────────────────────────────────────────────────────────────
  _fromPageJson(username) {
    const data = { name: '', bio: '', followers: null, following: null, postsCount: null };

    // 1a. window._sharedData (older Instagram versions)
    try {
      const user = window._sharedData
        ?.entry_data?.ProfilePage?.[0]?.graphql?.user;
      if (user && user.username === username) {
        data.name       = user.full_name || '';
        data.bio        = user.biography || '';
        data.followers  = user.edge_followed_by?.count ?? null;
        data.following  = user.edge_follow?.count ?? null;
        data.postsCount = user.edge_owner_to_timeline_media?.count ?? null;
        return data; // Best source — return early
      }
    } catch (_) {}

    // 1b. JSON-LD <script> blocks
    try {
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        const json = JSON.parse(script.textContent || '{}');
        const targets = Array.isArray(json) ? json : [json];
        for (const obj of targets) {
          if (obj['@type'] === 'Person' || obj['@type'] === 'ProfilePage') {
            const alternateName = obj.alternateName || '';
            const objName = obj.name || '';
            if (alternateName.toLowerCase() === username || objName.toLowerCase() === username) {
              data.name = data.name || objName;
              data.bio  = data.bio  || obj.description || '';
            }
          }
        }
      }
    } catch (_) {}

    return data;
  },

  // ────────────────────────────────────────────────────────────
  // Strategy 2: OG / meta tags
  // ────────────────────────────────────────────────────────────
  _fromMeta(username) {
    const data = { name: '', bio: '', followers: null, following: null, postsCount: null, profilePicUrl: '' };

    const desc =
      document.querySelector('meta[property="og:description"]')?.content ||
      document.querySelector('meta[name="description"]')?.content || '';

    if (desc) {
      const handleInDesc = desc.match(/@([a-zA-Z0-9._]+)/);
      const profileMatches = !handleInDesc || handleInDesc[1].toLowerCase() === username.toLowerCase();

      if (profileMatches) {
        const fMatch  = desc.match(/([\d.,\s]+\s*[KMBkmb]?)\s*Followers/i);
        const fgMatch = desc.match(/([\d.,\s]+\s*[KMBkmb]?)\s*Following/i);
        const pMatch  = desc.match(/([\d.,\s]+\s*[KMBkmb]?)\s*Posts/i);
        if (fMatch)  data.followers  = ParseUtils.parseNumber(fMatch[1]);
        if (fgMatch) data.following  = ParseUtils.parseNumber(fgMatch[1]);
        if (pMatch)  data.postsCount = ParseUtils.parseNumber(pMatch[1]);
      }
    }

    const title = document.querySelector('meta[property="og:title"]')?.content || '';
    const titleHandleMatch = title.match(/\(@([a-zA-Z0-9._]+)\)/);

    // Only set name if title matches current profile handle
    if (!titleHandleMatch || titleHandleMatch[1].toLowerCase() === username.toLowerCase()) {
      const titleMatch = title.match(/^(.+?)\s*\(@/);
      if (titleMatch) data.name = titleMatch[1].trim();
    }

    data.profilePicUrl = document.querySelector('meta[property="og:image"]')?.content?.trim() || '';

    return data;
  },

  // ────────────────────────────────────────────────────────────
  // Strategy 3: DOM heuristics (critical for SPA navigation)
  // ────────────────────────────────────────────────────────────
  _fromDOM(username) {
    const data = { name: '', bio: '', followers: null, following: null, postsCount: null, profilePicUrl: '', externalUrl: '' };

    const STAT_REGEX = /^\s*[\d.,\s]+[KMBkmb]?\s*(followers|following|posts|abonnés|seguidores|beiträge|beerträge)?\s*$/i;
    const UI_BTN_REGEX = /^(follow|following|message|edit profile|ad tools|view archive|contact|dashboard|professional dashboard|similar accounts|verified|✓)$/i;
    const MUTUAL_REGEX = /^(followed by|gefolgt von|suivi par|seguito da|seguido por)/i;

    const header = document.querySelector('header') || document.querySelector('main') || document.body;

    // ── Profile picture ──
    const imgs = Array.from(header.querySelectorAll('img'));
    const avatarImg = imgs.find(img => img.width > 30 || img.height > 30) || imgs[0];
    if (avatarImg?.src) data.profilePicUrl = avatarImg.src;

    // ── Follower count ──
    const followersEl = 
      document.querySelector('a[href*="/followers"]') ||
      document.querySelector('a[href*="followers"]') ||
      Array.from(document.querySelectorAll('a, button, li, span')).find(el => 
        /^\s*[\d.,\s]+[KMBkmb]?\s*(followers|abonnés|seguidores)\s*$/i.test(el.innerText || '')
      );

    if (followersEl) {
      const titleEl = followersEl.querySelector('[title]');
      const raw = titleEl?.getAttribute('title') || followersEl.innerText || followersEl.textContent;
      data.followers = ParseUtils.parseNumber(raw);
    }

    // ── Following count ──
    const followingEl = 
      document.querySelector('a[href*="/following"]') ||
      document.querySelector('a[href*="following"]') ||
      Array.from(document.querySelectorAll('a, button, li, span')).find(el => 
        /^\s*[\d.,\s]+[KMBkmb]?\s*(following|abonnements)\s*$/i.test(el.innerText || '')
      );

    if (followingEl) {
      const titleEl = followingEl.querySelector('[title]');
      const raw = titleEl?.getAttribute('title') || followingEl.innerText || followingEl.textContent;
      data.following = ParseUtils.parseNumber(raw);
    }

    // ── Posts count ──
    const postsEl = Array.from(document.querySelectorAll('li, button, span, div')).find(el => 
      /^\s*[\d.,\s]+[KMBkmb]?\s*(posts|beiträge)\s*$/i.test(el.innerText || '')
    );

    if (postsEl) {
      const titleEl = postsEl.querySelector('[title]');
      const raw = titleEl?.getAttribute('title') || postsEl.innerText || postsEl.textContent;
      data.postsCount = ParseUtils.parseNumber(raw);
    }

    // ── Display name: span[dir="auto"] / h1 / h2 outside stats & username ──
    const allDirSpans = Array.from(header.querySelectorAll('span[dir="auto"], h1[dir="auto"], h2[dir="auto"], h1, h2'));
    for (const span of allDirSpans) {
      const text = span.innerText?.trim();
      if (!text) continue;

      const lower = text.toLowerCase();
      if (
        lower === username.toLowerCase() ||
        lower.startsWith('@') ||
        STAT_REGEX.test(text) ||
        UI_BTN_REGEX.test(text) ||
        MUTUAL_REGEX.test(text) ||
        text.match(/^[\d.,\s]+[KMBkmb]?$/i) ||
        text.length > 80
      ) continue;

      data.name = text;
      break;
    }

    // ── Bio: collect all multi-line bio spans/blocks in profile header ──
    const bioLines = [];
    let passedName = !data.name;
    for (const span of allDirSpans) {
      const text = span.innerText?.trim();
      if (!text) continue;

      if (!passedName) {
        if (text === data.name || text.toLowerCase() === data.name?.toLowerCase()) {
          passedName = true;
        }
        continue;
      }

      const lower = text.toLowerCase();
      if (
        lower === username.toLowerCase() ||
        lower === '@' + username.toLowerCase() ||
        STAT_REGEX.test(text) ||
        UI_BTN_REGEX.test(text) ||
        MUTUAL_REGEX.test(text) ||
        text.match(/^[\d.,\s]+[KMBkmb]?$/i)
      ) {
        continue;
      }

      const isAlreadyCovered = bioLines.some(line => line === text || line.includes(text));
      if (!isAlreadyCovered) {
        bioLines.push(text);
      }
    }

    if (bioLines.length > 0) {
      data.bio = bioLines.join('\n').trim();
    }

    // ── External link ──
    const extLink = header.querySelector(
      'a[href*="l.instagram.com"], a[rel~="nofollow"][target="_blank"], a[target="_blank"]'
    );
    if (extLink) {
      try {
        const href = extLink.href;
        if (href.includes('u=')) {
          data.externalUrl = decodeURIComponent(new URL(href).searchParams.get('u') || '');
        } else {
          data.externalUrl = extLink.innerText?.trim() || href;
        }
      } catch {
        data.externalUrl = extLink.innerText?.trim() || '';
      }
    }

    return data;
  },

  // ────────────────────────────────────────────────────────────
  // Verified badge detection
  // ────────────────────────────────────────────────────────────
  _isVerified() {
    return Boolean(
      document.querySelector(
        'header svg[aria-label*="erified"], ' +
        'header [title*="erified"], ' +
        'header use[href*="verified"], ' +
        'header path[d*="M10.75 2l.85 2.3"]'   // Instagram's verified SVG path
      )
    );
  },

  /**
   * Debug helper: logs scraped data to the console.
   */
  debugScrape() {
    const data = this.scrapeProfile();
    console.group('🔍 [CRM Scraper] Result');
    if (data) {
      console.table(data);
      console.log('JSON data:', this._fromPageJson(data.username));
      console.log('Meta data:', this._fromMeta(data.username));
      console.log('DOM data:', this._fromDOM(data.username));
    } else {
      console.log('Not a valid Instagram profile page.');
    }
    console.groupEnd();
    return data;
  }
};

if (typeof window !== 'undefined') window.InstagramScraper = InstagramScraper;
if (typeof module !== 'undefined' && module.exports) module.exports = InstagramScraper;
