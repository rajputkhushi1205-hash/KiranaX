import { resetDatabaseForTests, getDatabase } from './src/db/database.ts';
import { searchProducts } from './src/services/productService.ts';

resetDatabaseForTests();
const db = getDatabase();
console.log('stores', db.prepare('SELECT * FROM stores').all());
console.log('customers', db.prepare('SELECT * FROM customers').all());
console.log('products', db.prepare('SELECT id, store_id, name, normalized_name FROM products').all());
console.log('fortune', searchProducts('fortune oil'));
console.log('atta', searchProducts('atta'));
