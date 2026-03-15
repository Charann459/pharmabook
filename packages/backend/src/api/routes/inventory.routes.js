const router = require('express').Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/inventory.controller');

const addStockSchema = Joi.object({
  medicine_id:           Joi.string().uuid().required(),
  qty:                   Joi.number().integer().positive().required(),
  batch_no:              Joi.string().max(100).required(),
  expiry_date:           Joi.date().iso().greater('now').required(),
  low_stock_threshold:   Joi.number().integer().min(1).default(10),
});

const adjustSchema = Joi.object({
  qty:    Joi.number().integer().required(), // positive = add, negative = subtract
  reason: Joi.string().max(255).optional(),
});

router.use(authenticate);

// Both owner and inv_manager can view and add stock
router.get('/',                                           asyncHandler(ctrl.list));
router.get('/low-stock',                                  asyncHandler(ctrl.lowStock));
router.get('/expiring',                                   asyncHandler(ctrl.expiring));
router.get('/:id',                                        asyncHandler(ctrl.getById));
router.post('/',    requireRole('owner', 'inv_manager'),  validate(addStockSchema), asyncHandler(ctrl.addStock));
router.patch('/:id/adjust', requireRole('owner', 'inv_manager'), validate(adjustSchema), asyncHandler(ctrl.adjust));

// Owner-only hard delete (soft delete in practice)
router.delete('/:id', requireRole('owner'),               asyncHandler(ctrl.remove));

module.exports = router;
