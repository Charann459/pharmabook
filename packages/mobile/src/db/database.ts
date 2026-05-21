import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { pharmaBookSchema } from './schema';
import Medicine from './models/Medicine';
import Inventory from './models/Inventory';
import Bill from './models/Bill';
import BillItem from './models/BillItem';

const modelClasses = [Medicine, Inventory, Bill, BillItem];

let database: Database | null = null;

if (Platform.OS !== 'web') {
    const adapter = new SQLiteAdapter({
        schema: pharmaBookSchema,
    });

    database = new Database({
        adapter,
        modelClasses,
    });
}

const getDatabase = () => database;

export { database, getDatabase };