const router = require('express').Router();
const Joi = require('joi');

const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { getShopById, updateShop } = require('../../services/shops.service');

const updateShopSchema = Joi.object({
    name: Joi.string().trim().min(2).max(255).optional(),
    address: Joi.string().trim().allow('', null).max(500).optional(),
    phone: Joi.string().trim().allow('', null).max(20).optional(),
    gst_no: Joi.string().trim().allow('', null).max(20).optional(),
}).min(1);

router.use(authenticate);

router.get('/me', asyncHandler(async (req, res) => {
    const shop = await getShopById(req.user.shop_id);

    if (!shop) {
        return res.status(404).json({ error: 'Shop not found' });
    }

    return res.json({ shop });
}));

router.put('/me', requireRole('owner'), validate(updateShopSchema), asyncHandler(async (req, res) => {
    const shop = await updateShop(req.user.shop_id, req.body);

    if (!shop) {
        return res.status(404).json({ error: 'Shop not found' });
    }

    return res.json({ shop });
}));

module.exports = router;