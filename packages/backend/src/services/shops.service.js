const { query } = require('../config/db');

const getShopById = async (shopId) => {
    const { rows } = await query(
        `SELECT id, name, address, phone, gst_no, active, created_at, updated_at
     FROM shops
     WHERE id = $1`,
        [shopId]
    );

    return rows[0] || null;
};

const updateShop = async (shopId, data) => {
    const allowedFields = ['name', 'address', 'phone', 'gst_no'];

    const updates = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
            updates.push(`${field} = $${index}`);
            values.push(data[field]);
            index += 1;
        }
    }

    if (updates.length === 0) {
        return getShopById(shopId);
    }

    values.push(shopId);

    const { rows } = await query(
        `UPDATE shops
     SET ${updates.join(', ')}
     WHERE id = $${index}
     RETURNING id, name, address, phone, gst_no, active, created_at, updated_at`,
        values
    );

    return rows[0] || null;
};

module.exports = {
    getShopById,
    updateShop,
};