const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return a structured 400 response if any errors exist.
 */
function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const formattedErrors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value !== undefined ? err.value : null
    }));

    return res.status(400).json({
      message: 'Validation failed. Please review the submitted fields.',
      errors: formattedErrors
    });
  }
  next();
}

/**
 * Rules for creating a new influencer (POST /api/influencers)
 */
const validateCreateInfluencer = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required.')
    .isString()
    .withMessage('Username must be a string.')
    .matches(/^[a-zA-Z0-9._]+$/)
    .withMessage('Username can only contain alphanumeric characters, periods, and underscores.')
    .toLowerCase(),

  body('profileUrl')
    .trim()
    .notEmpty()
    .withMessage('Profile URL is required.')
    .isString()
    .withMessage('Profile URL must be a valid URL string.'),

  body('name')
    .optional({ nullable: true })
    .isString()
    .withMessage('Name must be a string.')
    .trim(),

  body('bio')
    .optional({ nullable: true })
    .isString()
    .withMessage('Bio must be a string.')
    .trim(),

  body('followers')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Followers must be a non-negative number or null.');
      }
      return true;
    }),

  body('following')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Following must be a non-negative number or null.');
      }
      return true;
    }),

  body('postsCount')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Posts count must be a non-negative number or null.');
      }
      return true;
    }),

  body('isVerified')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('isVerified must be a boolean (true or false).')
    .toBoolean(),

  body('profilePicUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('profilePicUrl must be a string.')
    .trim(),

  body('externalUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('externalUrl must be a string.')
    .trim(),

  body('tags')
    .optional({ nullable: true })
    .custom((val) => {
      if (Array.isArray(val)) {
        if (!val.every((item) => typeof item === 'string')) {
          throw new Error('All tags in the array must be strings.');
        }
        return true;
      }
      if (typeof val === 'string') {
        return true;
      }
      throw new Error('Tags must be an array of strings or a comma-separated string.');
    }),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .withMessage('Notes must be a string.')
    .trim()
];

/**
 * Rules for updating an influencer (PUT /api/influencers/:username)
 */
const validateUpdateInfluencer = [
  param('username')
    .trim()
    .notEmpty()
    .withMessage('Username parameter in URL path is required.')
    .toLowerCase(),

  body('name')
    .optional({ nullable: true })
    .isString()
    .withMessage('Name must be a string.')
    .trim(),

  body('profileUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('Profile URL must be a string.')
    .trim(),

  body('bio')
    .optional({ nullable: true })
    .isString()
    .withMessage('Bio must be a string.')
    .trim(),

  body('followers')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Followers must be a non-negative number or null.');
      }
      return true;
    }),

  body('following')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Following must be a non-negative number or null.');
      }
      return true;
    }),

  body('postsCount')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        throw new Error('Posts count must be a non-negative number or null.');
      }
      return true;
    }),

  body('isVerified')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('isVerified must be a boolean (true or false).')
    .toBoolean(),

  body('profilePicUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('profilePicUrl must be a string.')
    .trim(),

  body('externalUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('externalUrl must be a string.')
    .trim(),

  body('tags')
    .optional({ nullable: true })
    .custom((val) => {
      if (Array.isArray(val)) {
        if (!val.every((item) => typeof item === 'string')) {
          throw new Error('All tags in the array must be strings.');
        }
        return true;
      }
      if (typeof val === 'string') {
        return true;
      }
      throw new Error('Tags must be an array of strings or a comma-separated string.');
    }),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .withMessage('Notes must be a string.')
    .trim()
];

/**
 * Rules for checking or fetching by username in URL param
 */
const validateUsernameParam = [
  param('username')
    .trim()
    .notEmpty()
    .withMessage('Username parameter is required.')
    .matches(/^[a-zA-Z0-9._]+$/)
    .withMessage('Username contains invalid characters.')
    .toLowerCase()
];

module.exports = {
  handleValidationErrors,
  validateCreateInfluencer,
  validateUpdateInfluencer,
  validateUsernameParam
};
