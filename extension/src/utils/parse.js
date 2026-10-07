/**
 * Influencer CRM Saver — Number & Route Parsing Utilities
 */

const ParseUtils = {
  /**
   * Checks if a given pathname belongs to a valid Instagram user profile.
   * Returns false for non-profile routes such as:
   * /, /explore, /reels, /direct, /accounts, /stories, /p/, /reel/, /tv/, /about, /legal, etc.
   *
   * @param {string} pathname - e.g. "/cristiano/" or window.location.pathname
   * @returns {boolean}
   */
  isProfilePage(pathname) {
    if (!pathname || typeof pathname !== 'string') return false;

    // Clean leading/trailing slashes and extract path segments
    const cleanPath = pathname.trim().split('?')[0].split('#')[0];
    const segments = cleanPath.split('/').filter(Boolean);

    if (segments.length === 0) return false;

    const firstSegment = segments[0].toLowerCase();

    // Reserved non-profile top-level routes on Instagram
    const reservedRoutes = new Set([
      '',
      'explore',
      'reels',
      'reel',
      'direct',
      'stories',
      'p',
      'tv',
      'accounts',
      'emails',
      'developer',
      'about',
      'legal',
      'directory',
      'terms',
      'privacy',
      'support',
      'help',
      'settings',
      'api',
      'graphql',
      'ajax',
      'challenge',
      'login',
      'logout',
      'static',
      'meta'
    ]);

    if (reservedRoutes.has(firstSegment)) {
      return false;
    }

    // Profiles are typically /<username>/ or /<username>/tagged/, /<username>/channel/, etc.
    // If there is a second segment, make sure it's an allowed sub-tab on a profile
    if (segments.length > 1) {
      const allowedSubTabs = new Set(['tagged', 'reels', 'channel', 'saved', 'live']);
      if (!allowedSubTabs.has(segments[1].toLowerCase())) {
        return false;
      }
    }

    // Instagram username validation rule: 1-30 chars, alphanumeric + dots + underscores
    const usernameRegex = /^[a-zA-Z0-9._]{1,30}$/;
    return usernameRegex.test(firstSegment);
  },

  /**
   * Extracts the lowercase username from a pathname or URL.
   *
   * @param {string} urlOrPath - e.g. "https://www.instagram.com/cristiano/" or "/cristiano"
   * @returns {string} Username if valid, otherwise ""
   */
  extractUsername(urlOrPath) {
    if (!urlOrPath) return '';
    let path = urlOrPath;

    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      try {
        path = new URL(urlOrPath).pathname;
      } catch {
        path = urlOrPath;
      }
    }

    if (!this.isProfilePage(path)) return '';

    const segments = path.split('?')[0].split('#')[0].split('/').filter(Boolean);
    return segments.length > 0 ? segments[0].toLowerCase() : '';
  },

  /**
   * Converts numbers formatted with metric suffixes or thousand separators into integers.
   * Handles:
   *   "1,234"      -> 1234
   *   "12.4K"      -> 12400
   *   "12,4 k"     -> 12400 (comma decimals and spaces)
   *   "1.2M"       -> 1200000
   *   "3B"         -> 3000000000
   *   "98"         -> 98
   *   "1,234,567"  -> 1234567
   *   null / ""    -> null
   *
   * @param {string|number} rawValue
   * @returns {number|null} Integer or null on invalid/missing input
   */
  parseNumber(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? Math.floor(rawValue) : null;
    }

    let str = String(rawValue).trim().toLowerCase();
    if (!str) return null;

    // Strip out label words (e.g. "followers", "following", "posts", "abonnés", "beerträge")
    str = str.replace(/(followers|following|posts|abonnés|seguidores|beiträge|beerträge)/gi, '').trim();
    str = str.replace(/\s+/g, '');
    if (!str) return null;

    // Identify multiplier suffix (k, m, b)
    let multiplier = 1;
    if (/[kK]$/.test(str)) {
      multiplier = 1_000;
      str = str.slice(0, -1);
    } else if (/[mM]$/.test(str)) {
      multiplier = 1_000_000;
      str = str.slice(0, -1);
    } else if (/[bB]$/.test(str)) {
      multiplier = 1_000_000_000;
      str = str.slice(0, -1);
    }

    // If no multiplier, check for standard thousand separators: "1,234,567" or "1.234.567"
    if (multiplier === 1) {
      if (/^\d{1,3}(,\d{3})+$/.test(str)) {
        str = str.replace(/,/g, '');
      } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, '');
      }
    }

    // Replace comma with dot for decimal values like "12,4" -> "12.4"
    str = str.replace(',', '.');

    // Extract numerical part
    const match = str.match(/^-?\d+(\.\d+)?/);
    if (!match) return null;

    const parsedFloat = parseFloat(match[0]);
    if (Number.isNaN(parsedFloat) || parsedFloat < 0) return null;

    return Math.floor(parsedFloat * multiplier);
  },

  /**
   * Sanitizes tag inputs into clean trimmed unique array
   * @param {string|string[]} tagsInput
   * @returns {string[]}
   */
  parseTags(tagsInput) {
    if (!tagsInput) return [];
    if (Array.isArray(tagsInput)) {
      return Array.from(new Set(tagsInput.map((t) => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean)));
    }
    return Array.from(
      new Set(
        String(tagsInput)
          .split(',')
          .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
          .filter(Boolean)
      )
    );
  }
};

// Export to window for browser extension content scripts & service workers
if (typeof window !== 'undefined') {
  window.ParseUtils = ParseUtils;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParseUtils;
}
