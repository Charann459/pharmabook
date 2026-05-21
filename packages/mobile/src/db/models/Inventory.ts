import { Model } from '@nozbe/watermelondb';

export default class Inventory extends Model {
    static table = 'inventory';

    get serverId() {
        return this._getRaw('server_id') as string | undefined;
    }

    get medicineId() {
        return this._getRaw('medicine_id') as string;
    }

    get shopId() {
        return this._getRaw('shop_id') as string;
    }

    get qty() {
        return this._getRaw('qty') as number;
    }

    get batchNo() {
        return this._getRaw('batch_no') as string;
    }

    get expiryDate() {
        return this._getRaw('expiry_date') as string;
    }

    get lowStockThreshold() {
        return this._getRaw('low_stock_threshold') as number;
    }

    get updatedAt() {
        const value = this._getRaw('updated_at') as number;
        return new Date(value);
    }
}