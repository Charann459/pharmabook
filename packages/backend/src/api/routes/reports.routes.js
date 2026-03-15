const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const asyncHandler = require('../../utils/asyncHandler');
const ctrl = require('../controllers/reports.controller');

// All reports are owner-only
router.use(authenticate, requireRole('owner'));

router.get('/daily',        asyncHandler(ctrl.daily));       // ?date=2026-03-15
router.get('/weekly',       asyncHandler(ctrl.weekly));      // ?week_start=2026-03-10
router.get('/monthly',      asyncHandler(ctrl.monthly));     // ?year=2026&month=3
router.get('/top-medicines', asyncHandler(ctrl.topMedicines)); // ?period=today|week|month&limit=10
router.get('/gst-summary',  asyncHandler(ctrl.gstSummary));  // ?month=3&year=2026 — for GSTR-1 prep

module.exports = router;
