import { Database } from '@nozbe/watermelondb';
import { Platform } from 'react-native';
import { pharmaBookSchema } from './schema';

import Medicine from './models/Medicine';
import Inventory from './models/Inventory';
import Bill from './models/Bill';
import BillItem from './models/BillItem';

const modelClasses = [Medicine, Inventory, Bill, BillItem] as any;

let database: Database | null = null;

export const getDatabase = (): Database | null => {
    if (database) return database;

    if (Platform.OS === 'web') {
        console.warn(
            'WatermelonDB SQLite adapter is not available on web. Use Android/iOS for offline DB testing.'
        );
        return null;
    }

    const SQLiteAdapter =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@nozbe/watermelondb/adapters/sqlite').default;

    const adapter = new SQLiteAdapter({
        schema: pharmaBookSchema,
        dbName: 'pharmabook_mobile',
        jsi: false,
        onSetUpError: (error: Error) => {
            console.error('WatermelonDB setup failed', error);
        },
    });

    database = new Database({
        adapter,
        modelClasses,
    });

    return database;
};

export type PharmaBookDatabase = Database;