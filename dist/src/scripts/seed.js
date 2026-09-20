import { getDatabase } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
const db = getDatabase();
seedDatabase(db);
console.log('Seeded KiranaX demo data with rows:', {
    stores: db.prepare('SELECT COUNT(*) as count FROM stores').get(),
    products: db.prepare('SELECT COUNT(*) as count FROM products').get(),
    customers: db.prepare('SELECT COUNT(*) as count FROM customers').get()
});
//# sourceMappingURL=seed.js.map