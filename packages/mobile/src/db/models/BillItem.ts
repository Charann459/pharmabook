import { Model } from '@nozbe/watermelondb';

export default class BillItem extends Model {
    static table = 'bill_items';

    static associations = {
        bills: { type: 'belongs_to' as const, key: 'bill_id' },
    };

    get serverId() {
        return this._getRaw('server_id') as string | undefined;
    }

    get billId() {
        return this._getRaw('bill_id') as string;
    }

    get medicineId() {
        return this._getRaw('medicine_id') as string;
    }

    get qty() {
        return this._getRaw('qty') as number;
    }

    get unitPrice() {
        return this._getRaw('unit_price') as number;
    }

    get gstRate() {
        return this._getRaw('gst_rate') as number;
    }

    get lineTotal() {
        return this._getRaw('line_total') as number;
    }

    get createdAt() {
        const value = this._getRaw('created_at') as number;
        return new Date(value);
    }
}