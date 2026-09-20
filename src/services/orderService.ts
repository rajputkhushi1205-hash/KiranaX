import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
import { checkInventory } from './inventoryService.js';
import { getProductById } from './productService.js';

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  storeId: string;
  customerId: string;
  items: OrderItemInput[];
  deliveryFee?: number;
  discount?: number;
  loyaltyBenefit?: string;
  idempotencyKey?: string;
};

export function createOrder(input: CreateOrderInput) {
  const db = getDatabase();
  const storeId = input.storeId;
  const customerId = input.customerId;
  const deliveryFee = input.deliveryFee ?? 0;
  const discount = input.discount ?? 0;
  const idempotencyKey = input.idempotencyKey ?? `order-${Date.now()}-${randomUUID()}`;

  const existing = db.prepare(
    `SELECT id FROM orders WHERE store_id = ? AND customer_id = ? AND idempotency_key = ?`
  ).get(storeId, customerId, idempotencyKey) as { id: string } | undefined;

  if (existing) {
    return getOrder(existing.id);
  }

  let subtotal = 0;
  const itemRecords: Array<{ productId: string; quantity: number; snapshotName: string; unitPrice: number; subtotal: number }> = [];

  for (const item of input.items) {
    const product = getProductById(item.productId);
    if (!product) {
      throw new Error('Product not found.');
    }

    const inventory = checkInventory(item.productId, storeId);
    if (item.quantity > inventory.stockQuantity) {
      throw new Error(`Insufficient stock: only ${inventory.stockQuantity} available for ${product.name}.`);
    }

    const lineSubtotal = inventory.sellingPrice * item.quantity;
    subtotal += lineSubtotal;
    itemRecords.push({
      productId: item.productId,
      quantity: item.quantity,
      snapshotName: product.name,
      unitPrice: inventory.sellingPrice,
      subtotal: lineSubtotal
    });
  }

  const orderId = randomUUID();
  const orderNumber = `KX-${Math.floor(Date.now() % 1000000)}`;
  const total = subtotal + deliveryFee - discount;

  db.prepare(
    `INSERT INTO orders (id, order_number, store_id, customer_id, status, subtotal, delivery_fee, discount, loyalty_benefit, total, payment_status, source, idempotency_key, created_at, updated_at, confirmed_at)
     VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, 'NOT_IMPLEMENTED', 'demo', ?, datetime('now'), datetime('now'), datetime('now'))`
  ).run(orderId, orderNumber, storeId, customerId, subtotal, deliveryFee, discount, input.loyaltyBenefit ?? 'standard', total, idempotencyKey);

  for (const item of itemRecords) {
    db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(randomUUID(), orderId, item.productId, item.snapshotName, item.quantity, item.unitPrice, item.subtotal);

    const currentInventory = checkInventory(item.productId, storeId);
    const newQuantity = currentInventory.stockQuantity - item.quantity;
    db.prepare(`UPDATE inventory SET stock_quantity = ?, updated_at = datetime('now') WHERE product_id = ? AND store_id = ?`).run(newQuantity, item.productId, storeId);
    db.prepare(
      `INSERT INTO inventory_transactions (id, store_id, product_id, order_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, created_at)
       VALUES (?, ?, ?, ?, 'SALE', ?, ?, ?, 'Order sale', datetime('now'))`
    ).run(randomUUID(), storeId, item.productId, orderId, -item.quantity, currentInventory.stockQuantity, newQuantity);
  }

  return getOrder(orderId);
}

export function createOrderWithIdempotency(input: CreateOrderInput) {
  return createOrder(input);
}

export function getOrder(orderId: string) {
  const db = getDatabase();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) throw new Error('Order not found.');

  const items = db.prepare(
    `SELECT oi.*, p.name AS product_name FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`
  ).all(orderId) as any[];

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    storeId: order.store_id,
    status: order.status,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    discount: Number(order.discount),
    loyaltyBenefit: order.loyalty_benefit,
    total: Number(order.total),
    paymentStatus: order.payment_status,
    createdAt: order.created_at,
    items: items.map((item) => ({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      productNameSnapshot: item.product_name_snapshot,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      subtotal: Number(item.subtotal)
    }))
  };
}
