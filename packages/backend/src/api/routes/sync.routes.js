const router = require('express').Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/sync.controller');

/**
 * WatermelonDB sync protocol:
 *   POST /api/sync/push  — device sends dirty records
 *   GET  /api/sync/pull  — device requests delta since last_pulled_at
 *
 * The push endpoint accepts the WatermelonDB SyncPushArgs shape.
 * The pull endpoint returns SyncPullResult shape.
 */

const changeSetSchema = Joi.object({
  created: Joi.array().items(Joi.object()).default([]),
  updated: Joi.array().items(Joi.object()).default([]),
  deleted: Joi.array().items(Joi.string()).default([]),
});

const pushSchema = Joi.object({
  changes: Joi.object({
    medicines:  changeSetSchema,
    inventory:  changeSetSchema,
    bills:      changeSetSchema,
    bill_items: changeSetSchema,
  }).required(),
  last_pulled_at: Joi.number().allow(null).default(null),
});

router.use(authenticate);

router.post('/push', validate(pushSchema),                        asyncHandler(ctrl.push));
router.get('/pull',                                               asyncHandler(ctrl.pull));

module.exports = router;
