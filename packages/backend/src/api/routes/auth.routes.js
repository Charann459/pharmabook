const router = require('express').Router();
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const authController = require('../controllers/auth.controller');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const refreshSchema = Joi.object({
  token: Joi.string().required(),
});

router.post('/login',   validate(loginSchema),   asyncHandler(authController.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout',  authenticate,            asyncHandler(authController.logout));
router.get('/me',       authenticate,            asyncHandler(authController.me));

module.exports = router;
