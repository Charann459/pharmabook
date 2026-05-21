import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const pharmaBookSchema = appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'medicines',
            columns: [
                { name: 'server_id', type: 'string', isOptional: true },
                { name: 'barcode', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'category', type: 'string', isOptional: true },
                { name: 'mrp', type: 'number' },
                { name: 'gst_rate', type: 'number' },
                { name: 'is_global', type: 'boolean' },
                { name: 'shop_id', type: 'string', isOptional: true },
                { name: 'updated_at', type: 'number' },
            ],
        }),

        tableSchema({
            name: 'inventory',
            columns: [
                { name: 'server_id', type: 'string', isOptional: true },
                { name: 'medicine_id', type: 'string' },
                { name: 'shop_id', type: 'string' },
                { name: 'qty', type: 'number' },
                { name: 'batch_no', type: 'string' },
                { name: 'expiry_date', type: 'string' },
                { name: 'low_stock_threshold', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),

        tableSchema({
            name: 'bills',
            columns: [
                { name: 'server_id', type: 'string', isOptional: true },
                { name: 'bill_no', type: 'number', isOptional: true },
                { name: 'shop_id', type: 'string' },
                { name: 'cashier_id', type: 'string' },
                { name: 'subtotal', type: 'number' },
                { name: 'gst_amount', type: 'number' },
                { name: 'discount', type: 'number' },
                { name: 'total', type: 'number' },
                { name: 'sync_status', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),

        tableSchema({
            name: 'bill_items',
            columns: [
                { name: 'server_id', type: 'string', isOptional: true },
                { name: 'bill_id', type: 'string' },
                { name: 'medicine_id', type: 'string' },
                { name: 'qty', type: 'number' },
                { name: 'unit_price', type: 'number' },
                { name: 'gst_rate', type: 'number' },
                { name: 'line_total', type: 'number' },
                { name: 'created_at', type: 'number' },
            ],
        }),
    ],
});