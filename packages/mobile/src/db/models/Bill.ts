import { Model } from '@nozbe/watermelondb';

export default class Bill extends Model {
    static table = 'bills';

    static associations = {
        bill_items: { type: 'has_many' as const, foreignKey: 'bill_id' },
    };

    get serverId() {
        return this._getRaw('server_id') as string | undefined;
    }

    get billNo() {
        return this._getRaw('bill_no') as number | undefined;
    }

    get shopId() {
        return this._getRaw('shop_id') as string;
    }

    get cashierId() {
        return this._getRaw('cashier_id') as string;
    }

    get subtotal() {
        return this._getRaw('subtotal') as number;
    }

    get gstAmount() {
        return this._getRaw('gst_amount') as number;
    }

    get discount() {
        return this._getRaw('discount') as number;
    }

    get total() {
        return this._getRaw('total') as number;
    }

    get billSyncStatus() {
        return this._getRaw('sync_status') as string;
    }

    get createdAt() {
        const value = this._getRaw('created_at') as number;
        return new Date(value);
    }

    get updatedAt() {
        const value = this._getRaw('updated_at') as number;
        return new Date(value);
    }
}