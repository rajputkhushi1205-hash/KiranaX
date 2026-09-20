import { randomUUID } from 'node:crypto';
import { DEFAULT_STORE_ID } from './database.js';
import Database from 'better-sqlite3';

export function seedDatabase(db: Database.Database) {
  const storeId = DEFAULT_STORE_ID;
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(storeId) as { id: string } | undefined;

  if (!store) {
    db.prepare(
      `INSERT INTO stores (id, name, phone, email, address, area, city, state, postal_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      storeId,
      'Demo Store',
      '+919900000000',
      'hello@kiranax.in',
      'Market Road',
      'Saket',
      'Delhi',
      'Delhi',
      '110001'
    );
  }

  const products = [
    { name: 'Aashirvaad Atta', normalizedName: 'aashirvaad atta', category: 'Grains', brand: 'Aashirvaad', unit: '5kg', description: 'Whole wheat flour', price: 290, stock: 12 },
    { name: 'Fortune Oil', normalizedName: 'fortune oil', category: 'Cooking Oil', brand: 'Fortune', unit: '1L', description: 'Refined soybean oil', price: 145, stock: 8 },
    { name: 'Maggi', normalizedName: 'maggi noodles', category: 'Snacks', brand: 'Maggi', unit: '70g', description: 'Instant noodles', price: 14, stock: 20 },
    { name: 'Mother Dairy Milk', normalizedName: 'mother dairy milk', category: 'Dairy', brand: 'Mother Dairy', unit: '500ml packet', description: 'Pasteurized toned milk', price: 35, stock: 24 },
    { name: 'Tata Tea', normalizedName: 'tata tea', category: 'Beverages', brand: 'Tata', unit: '250g', description: 'Tea leaves', price: 120, stock: 15 },
    { name: 'Madhur Sugar', normalizedName: 'madhur sugar', category: 'Essentials', brand: 'Madhur', unit: '1kg', description: 'Refined sugar', price: 52, stock: 18 },
    { name: 'Tata Salt', normalizedName: 'tata salt', category: 'Essentials', brand: 'Tata', unit: '1kg', description: 'Iodized salt', price: 28, stock: 7 },
    { name: 'Surf Excel', normalizedName: 'surf excel', category: 'Laundry', brand: 'Surf Excel', unit: '1kg', description: 'Detergent powder', price: 160, stock: 0 },
    { name: 'Ariel', normalizedName: 'ariel', category: 'Laundry', brand: 'Ariel', unit: '1kg', description: 'Detergent powder', price: 175, stock: 6 },
    { name: 'Saffola Oil', normalizedName: 'saffola oil', category: 'Cooking Oil', brand: 'Saffola', unit: '1L', description: 'Healthy refined oil', price: 165, stock: 4 }
  ];

  for (const product of products) {
    const existing = db.prepare('SELECT id FROM products WHERE store_id = ? AND normalized_name = ?').get(storeId, product.normalizedName) as { id: string } | undefined;

    if (!existing) {
      const productId = randomUUID();
      db.prepare(
        `INSERT INTO products (id, store_id, name, normalized_name, category, brand, unit, description, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(productId, storeId, product.name, product.normalizedName, product.category, product.brand, product.unit, product.description, 1);

      db.prepare(
        `INSERT INTO inventory (id, store_id, product_id, stock_quantity, low_stock_threshold, selling_price, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(randomUUID(), storeId, productId, product.stock, product.stock <= 5 ? 2 : 5, product.price);
    }
  }

  const seededCustomerPhone = '+919900000001';
  const customer = db.prepare('SELECT id FROM customers WHERE store_id = ? AND phone = ?').get(storeId, seededCustomerPhone) as { id: string } | undefined;
  if (!customer) {
    const customerId = randomUUID();
    db.prepare(
      `INSERT INTO customers (id, store_id, full_name, phone, email, created_at, updated_at, last_order_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
    ).run(customerId, storeId, 'Priya Sharma Demo', seededCustomerPhone, 'priya-demo@example.com');

    db.prepare(
      `INSERT INTO customer_addresses (id, customer_id, label, address_line, area, city, state, postal_code, landmark, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(randomUUID(), customerId, 'Home', '12 Market Road', 'Saket', 'Delhi', 'Delhi', '110001', 'Near Metro', 1);
  }

  const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  if (orderCount.count === 0) {
    const customerRow = db.prepare('SELECT id FROM customers WHERE store_id = ? AND phone = ?').get(storeId, seededCustomerPhone) as { id: string };
    const productsRows = db.prepare('SELECT id, name, normalized_name FROM products WHERE store_id = ?').all(storeId) as { id: string; name: string; normalized_name: string }[];
    const productMap = new Map(productsRows.map((row) => [row.normalized_name, row]));
    const list = ['aashirvaad atta', 'fortune oil', 'maggi noodles', 'tata salt'];

    for (let i = 0; i < 12; i += 1) {
      const selected = list[i % list.length];
      const product = productMap.get(selected) ?? productsRows[0];
      const inventoryRow = db.prepare('SELECT selling_price, stock_quantity FROM inventory WHERE product_id = ?').get(product.id) as { selling_price: number; stock_quantity: number };
      const orderId = randomUUID();
      const orderNumber = `KX-${1000 + i}`;

      db.prepare(
        `INSERT INTO orders (id, order_number, store_id, customer_id, status, subtotal, delivery_fee, discount, loyalty_benefit, total, payment_status, source, created_at, updated_at, confirmed_at)
         VALUES (?, ?, ?, ?, 'COMPLETED', ?, 0, 0, 'standard', ?, 'NOT_IMPLEMENTED', 'demo', datetime('now'), datetime('now'), datetime('now'))`
      ).run(orderId, orderNumber, storeId, customerRow.id, inventoryRow.selling_price, inventoryRow.selling_price);

      db.prepare(
        `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(randomUUID(), orderId, product.id, product.name, 1, inventoryRow.selling_price, inventoryRow.selling_price);
    }
  }
}
