const router = require('express').Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/bills.controller');

const billItemSchema = Joi.object({
  medicine_id: Joi.string().uuid().required(),
  qty:         Joi.number().integer().positive().required(),
  unit_price:  Joi.number().positive().precision(2).required(),
  gst_rate:    Joi.number().valid(0, 5, 12, 18).required(),
});

const createBillSchema = Joi.object({
  items:    Joi.array().items(billItemSchema).min(1).required(),
  discount: Joi.number().min(0).precision(2).default(0),
  // client_local_id used for sync idempotency
  client_local_id: Joi.string().max(64).optional(),
});

router.use(authenticate);

// Owner and cashier can create bills
router.post('/',     requireRole('owner', 'cashier'), validate(createBillSchema), asyncHandler(ctrl.create));
router.get('/',      requireRole('owner', 'cashier'),                              asyncHandler(ctrl.list));
router.get('/:id',   requireRole('owner', 'cashier'),                              asyncHandler(ctrl.getById));

// PDF download — triggers pdf.worker if not yet generated
router.get('/:id/pdf', requireRole('owner', 'cashier'),                            asyncHandler(ctrl.getPdf));

// Void a bill — owner only
router.post('/:id/void', requireRole('owner'),                                     asyncHandler(ctrl.voidBill));

module.exports = router;
