const router = require('express').Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/medicines.controller');

const createSchema = Joi.object({
  barcode:  Joi.string().max(64).required(),
  name:     Joi.string().max(255).required(),
  mrp:      Joi.number().positive().precision(2).required(),
  gst_rate: Joi.number().valid(0, 5, 12, 18).required(),
  category: Joi.string().max(100).required(),
  global:   Joi.boolean().default(false),
});

const updateSchema = createSchema.fork(
  ['barcode', 'name', 'mrp', 'gst_rate', 'category'],
  (f) => f.optional()
);

router.use(authenticate);

// Barcode resolution — cashier and inv_manager both need this
router.get('/resolve/:barcode', asyncHandler(ctrl.resolveBarcode));

// Search medicines by name (for manual billing search)
router.get('/search',           asyncHandler(ctrl.search));

// Full CRUD — owner only for create/update/delete
router.get('/',                                         asyncHandler(ctrl.list));
router.get('/:id',                                      asyncHandler(ctrl.getById));
router.post('/',   requireRole('owner'),  validate(createSchema), asyncHandler(ctrl.create));
router.patch('/:id', requireRole('owner'), validate(updateSchema), asyncHandler(ctrl.update));
router.delete('/:id', requireRole('owner'),             asyncHandler(ctrl.remove));

// Promote a shop-scoped medicine to global (owner only)
router.post('/:id/promote', requireRole('owner'), asyncHandler(ctrl.promote));

module.exports = router;
