const { admin, influencersCollection, formatFirestoreDoc } = require('../config/firebase');

/**
 * Helper to normalize and sanitize tag arrays
 * @param {Array|string} tagsInput 
 * @returns {string[]}
 */
function sanitizeTags(tagsInput) {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) {
    return Array.from(new Set(tagsInput.map((t) => String(t).trim()).filter(Boolean)));
  }
  if (typeof tagsInput === 'string') {
    return Array.from(
      new Set(
        tagsInput
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean)
      )
    );
  }
  return [];
}

/**
 * Helper to safely sanitize number fields or return null
 * @param {*} val 
 * @returns {number|null}
 */
function sanitizeNumberOrNull(val) {
  if (val === undefined || val === null || val === '') return null;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * POST /api/influencers
 * Create a new influencer document in Firestore.
 * Document ID is the lowercased username to strictly guarantee uniqueness.
 */
async function createInfluencer(req, res, next) {
  try {
    const rawUsername = req.body.username;
    const cleanUsername = String(rawUsername).trim().toLowerCase();

    const docRef = influencersCollection.doc(cleanUsername);
    const existingDoc = await docRef.get();

    if (existingDoc.exists) {
      return res.status(409).json({
        message: 'Influencer already exists',
        data: formatFirestoreDoc(existingDoc.data())
      });
    }

    const now = admin.firestore.Timestamp.now();

    const influencerData = {
      username: cleanUsername,
      name: (req.body.name || '').trim(),
      profileUrl: (req.body.profileUrl || `https://www.instagram.com/${cleanUsername}/`).trim(),
      bio: (req.body.bio || '').trim(),
      followers: sanitizeNumberOrNull(req.body.followers),
      following: sanitizeNumberOrNull(req.body.following),
      postsCount: sanitizeNumberOrNull(req.body.postsCount),
      isVerified: Boolean(req.body.isVerified),
      profilePicUrl: (req.body.profilePicUrl || '').trim(),
      externalUrl: (req.body.externalUrl || '').trim(),
      tags: sanitizeTags(req.body.tags),
      notes: (req.body.notes || '').trim(),
      createdAt: now,
      updatedAt: now
    };

    await docRef.set(influencerData);

    const savedDoc = await docRef.get();

    return res.status(201).json({
      message: 'Influencer added to CRM successfully.',
      data: formatFirestoreDoc(savedDoc.data())
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/influencers
 * List all influencers with search, tag filter, and sorting.
 * Query Params:
 *  - search: string (matches username, name, bio, case-insensitive)
 *  - tag: string
 *  - sort: 'createdAt' | 'followers' (default: 'createdAt')
 *  - order: 'asc' | 'desc' (default: 'desc')
 */
async function getAllInfluencers(req, res, next) {
  try {
    const { search, tag, sort = 'createdAt', order = 'desc' } = req.query;

    const snapshot = await influencersCollection.get();
    let influencers = [];

    snapshot.forEach((doc) => {
      influencers.push(formatFirestoreDoc(doc.data()));
    });

    // 1. Tag Filtering
    if (tag && typeof tag === 'string' && tag.trim()) {
      const cleanTag = tag.trim().toLowerCase().replace(/^#/, '');
      influencers = influencers.filter((item) =>
        Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase() === cleanTag)
      );
    }

    // 2. Search query (username, name, bio, tags, notes)
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      influencers = influencers.filter((item) => {
        const usernameMatch = item.username && item.username.toLowerCase().includes(term);
        const nameMatch = item.name && item.name.toLowerCase().includes(term);
        const bioMatch = item.bio && item.bio.toLowerCase().includes(term);
        const tagsMatch = Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase().includes(term));
        const notesMatch = item.notes && item.notes.toLowerCase().includes(term);
        return usernameMatch || nameMatch || bioMatch || tagsMatch || notesMatch;
      });
    }

    // 3. Sorting
    const sortField = sort === 'followers' ? 'followers' : 'createdAt';
    const isAsc = String(order).toLowerCase() === 'asc';

    influencers.sort((a, b) => {
      if (sortField === 'followers') {
        const aVal = a.followers === null || a.followers === undefined ? -1 : a.followers;
        const bVal = b.followers === null || b.followers === undefined ? -1 : b.followers;
        return isAsc ? aVal - bVal : bVal - aVal;
      }

      // Default to createdAt timestamp
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return isAsc ? aTime - bTime : bTime - aTime;
    });

    return res.status(200).json({
      message: 'Influencers retrieved successfully',
      count: influencers.length,
      data: influencers
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/influencers/:username
 * Fetch a single influencer by username.
 */
async function getInfluencerByUsername(req, res, next) {
  try {
    const cleanUsername = String(req.params.username).trim().toLowerCase();
    const docRef = influencersCollection.doc(cleanUsername);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: 'Influencer not found'
      });
    }

    return res.status(200).json({
      message: 'Influencer retrieved successfully',
      data: formatFirestoreDoc(doc.data())
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/influencers/:username
 * Update fields for an existing influencer.
 */
async function updateInfluencer(req, res, next) {
  try {
    const cleanUsername = String(req.params.username).trim().toLowerCase();
    const docRef = influencersCollection.doc(cleanUsername);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: 'Influencer not found'
      });
    }

    const updates = {};
    const body = req.body;

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.profileUrl !== undefined) updates.profileUrl = String(body.profileUrl).trim();
    if (body.bio !== undefined) updates.bio = String(body.bio).trim();
    if (body.followers !== undefined) updates.followers = sanitizeNumberOrNull(body.followers);
    if (body.following !== undefined) updates.following = sanitizeNumberOrNull(body.following);
    if (body.postsCount !== undefined) updates.postsCount = sanitizeNumberOrNull(body.postsCount);
    if (body.isVerified !== undefined) updates.isVerified = Boolean(body.isVerified);
    if (body.profilePicUrl !== undefined) updates.profilePicUrl = String(body.profilePicUrl).trim();
    if (body.externalUrl !== undefined) updates.externalUrl = String(body.externalUrl).trim();
    if (body.tags !== undefined) updates.tags = sanitizeTags(body.tags);
    if (body.notes !== undefined) updates.notes = String(body.notes).trim();

    updates.updatedAt = admin.firestore.Timestamp.now();

    await docRef.update(updates);

    const updatedDoc = await docRef.get();

    return res.status(200).json({
      message: 'Influencer updated successfully',
      data: formatFirestoreDoc(updatedDoc.data())
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/influencers/:username
 * Remove an influencer from the CRM.
 */
async function deleteInfluencer(req, res, next) {
  try {
    const cleanUsername = String(req.params.username).trim().toLowerCase();
    const docRef = influencersCollection.doc(cleanUsername);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: 'Influencer not found'
      });
    }

    await docRef.delete();

    return res.status(200).json({
      message: 'Influencer deleted successfully',
      username: cleanUsername
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/influencers/check/:username
 * Quick existence check for Chrome Extension lookup.
 * Returns { exists: true|false }
 */
async function checkInfluencerExists(req, res, next) {
  try {
    const cleanUsername = String(req.params.username).trim().toLowerCase();
    const docRef = influencersCollection.doc(cleanUsername);
    const doc = await docRef.get();

    return res.status(200).json({
      exists: doc.exists,
      username: cleanUsername,
      data: doc.exists ? formatFirestoreDoc(doc.data()) : null
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createInfluencer,
  getAllInfluencers,
  getInfluencerByUsername,
  updateInfluencer,
  deleteInfluencer,
  checkInfluencerExists
};
