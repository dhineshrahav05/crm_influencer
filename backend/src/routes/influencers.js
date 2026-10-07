const express = require('express');
const router = express.Router();

const {
  createInfluencer,
  getAllInfluencers,
  getInfluencerByUsername,
  updateInfluencer,
  deleteInfluencer,
  checkInfluencerExists
} = require('../controllers/influencerController');

const {
  handleValidationErrors,
  validateCreateInfluencer,
  validateUpdateInfluencer,
  validateUsernameParam
} = require('../middleware/validate');

/**
 * @route   POST /api/influencers
 * @desc    Add a new influencer document to CRM
 */
router.post(
  '/',
  validateCreateInfluencer,
  handleValidationErrors,
  createInfluencer
);

/**
 * @route   GET /api/influencers
 * @desc    List all influencers with search, tag filter, and sort options
 */
router.get('/', getAllInfluencers);

/**
 * @route   GET /api/influencers/check/:username
 * @desc    Check if an influencer exists in the CRM (used by Chrome extension)
 */
router.get(
  '/check/:username',
  validateUsernameParam,
  handleValidationErrors,
  checkInfluencerExists
);

/**
 * @route   GET /api/influencers/:username
 * @desc    Get a single influencer's details by Instagram username
 */
router.get(
  '/:username',
  validateUsernameParam,
  handleValidationErrors,
  getInfluencerByUsername
);

/**
 * @route   PUT /api/influencers/:username
 * @desc    Update tags, notes, or any profile field for an existing influencer
 */
router.put(
  '/:username',
  validateUpdateInfluencer,
  handleValidationErrors,
  updateInfluencer
);

/**
 * @route   DELETE /api/influencers/:username
 * @desc    Delete an influencer from the CRM
 */
router.delete(
  '/:username',
  validateUsernameParam,
  handleValidationErrors,
  deleteInfluencer
);

module.exports = router;
