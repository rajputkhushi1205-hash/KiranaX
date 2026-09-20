import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';

export function createCustomer(params: {
  storeId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  landmark?: string;
}) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM customers WHERE store_id = ? AND phone = ?').get(params.storeId, params.phone) as { id: string } | undefined;

  if (existing) {
    throw new Error('Customer already exists for this store and phone number.');
  }

  const customerId = randomUUID();
  db.prepare(
    `INSERT INTO customers (id, store_id, full_name, phone, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(customerId, params.storeId, params.fullName, params.phone, params.email ?? null);

  if (params.address) {
    db.prepare(
      `INSERT INTO customer_addresses (id, customer_id, label, address_line, area, city, state, postal_code, landmark, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(randomUUID(), customerId, 'Home', params.address, params.area ?? '', params.city ?? '', params.state ?? '', params.postalCode ?? '', params.landmark ?? '', 1);
  }

  return getCustomerProfile(customerId).customer;
}

export function findCustomerByPhone(storeId: string, phone: string) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM customers WHERE store_id = ? AND phone = ?').get(storeId, phone) as any;
  return row ? { ...row, id: row.id, storeId: row.store_id, fullName: row.full_name, phone: row.phone, email: row.email, createdAt: row.created_at, updatedAt: row.updated_at, lastOrderAt: row.last_order_at } : null;
}

export function getCustomerProfile(customerId: string) {
  const db = getDatabase();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  if (!customer) throw new Error('Customer not found.');

  const addresses = db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC').all(customerId) as any[];

  return {
    customer: {
      id: customer.id,
      storeId: customer.store_id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      lastOrderAt: customer.last_order_at
    },
    addresses: addresses.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      label: row.label,
      addressLine: row.address_line,
      area: row.area,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      landmark: row.landmark,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

export function getCustomerHistory(customerId: string) {
  const db = getDatabase();
  const orders = db.prepare('SELECT id, subtotal, total, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customerId) as any[];
  const totalOrders = orders.length;
  const totalSpending = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const orderProductRows = db.prepare(`
    SELECT oi.product_id, p.name, COUNT(*) AS frequency
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id IN (
      SELECT id FROM orders WHERE customer_id = ?
    )
    GROUP BY oi.product_id, p.name
    ORDER BY frequency DESC, p.name ASC
  `).all(customerId) as any[];

  const lastOrder = orders[0] ?? null;

  return {
    customerId,
    totalOrders,
    totalSpending,
    frequentProducts: orderProductRows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      frequency: Number(row.frequency)
    })),
    lastOrder,
    orders: orders.map((order) => ({
      id: order.id,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      createdAt: order.created_at
    }))
  };
}
