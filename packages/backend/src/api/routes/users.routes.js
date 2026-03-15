const router = require('express').Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/users.controller');

const createUserSchema = Joi.object({
  name:     Joi.string().max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role:     Joi.string().valid('cashier', 'inv_manager').required(),
  // owner cannot create another owner via API
});

const updateUserSchema = Joi.object({
  name:     Joi.string().max(100).optional(),
  email:    Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  role:     Joi.string().valid('cashier', 'inv_manager').optional(),
  active:   Joi.boolean().optional(),
});

// All user management is owner-only
router.use(authenticate, requireRole('owner'));

router.get('/',      asyncHandler(ctrl.list));
router.post('/',     validate(createUserSchema), asyncHandler(ctrl.create));
router.get('/:id',   asyncHandler(ctrl.getById));
router.patch('/:id', validate(updateUserSchema), asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
