import { Model } from '@nozbe/watermelondb';

export default class Medicine extends Model {
    static table = 'medicines';

    get serverId() {
        return this._getRaw('server_id') as string | undefined;
    }

    get barcode() {
        return this._getRaw('barcode') as string;
    }

    get name() {
        return this._getRaw('name') as string;
    }

    get category() {
        return this._getRaw('category') as string | undefined;
    }

    get mrp() {
        return this._getRaw('mrp') as number;
    }

    get gstRate() {
        return this._getRaw('gst_rate') as number;
    }

    get isGlobal() {
        return this._getRaw('is_global') as boolean;
    }

    get shopId() {
        return this._getRaw('shop_id') as string | undefined;
    }

    get updatedAt() {
        const value = this._getRaw('updated_at') as number;
        return new Date(value);
    }
}