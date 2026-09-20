import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabaseForTests, getDatabase } from '../src/db/database.js';
import { createCustomer, getCustomerProfile, getCustomerHistory } from '../src/services/customerService.js';
import { searchProducts, getProductById } from '../src/services/productService.js';
import { checkInventory, reserveInventory, ensureLowStock } from '../src/services/inventoryService.js';
import { createOrder, createOrderWithIdempotency } from '../src/services/orderService.js';
import { evaluateLoyalty } from '../src/services/loyaltyService.js';
import { processAgentMessage } from '../src/agent/agentService.js';

beforeEach(() => {
  resetDatabaseForTests();
});

describe('customer flows', () => {
  it('creates customer and profile', () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      landmark: 'Near Metro'
    });

    expect(customer.fullName).toBe('Priya Sharma');
    const profile = getCustomerProfile(customer.id);
    expect(profile.customer.phone).toBe('+919999999999');
    expect(profile.addresses.length).toBeGreaterThan(0);
  });

  it('rejects duplicate phone numbers in the same store', () => {
    createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    expect(() =>
      createCustomer({
        storeId: 'store-demo',
        fullName: 'Priya Sharma 2',
        phone: '+919999999999',
        address: '13 Market Road',
        area: 'Saket',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001'
      })
    ).toThrow(/already exists/i);
  });

  it('returns customer history with total spending and order count', () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    const product = searchProducts('atta')[0];
    const order = createOrder({
      storeId: 'store-demo',
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 2 }],
      deliveryFee: 0,
      discount: 0,
      loyaltyBenefit: 'standard',
      idempotencyKey: 'order-1'
    });

    const history = getCustomerHistory(customer.id);
    expect(history.totalOrders).toBe(1);
    expect(history.totalSpending).toBeGreaterThan(0);
    expect(order.id).toBeTruthy();
  });
});

describe('products and inventory', () => {
  it('matches a product by keyword and gets actual stock', () => {
    const matches = searchProducts('fortune oil');
    expect(matches.length).toBeGreaterThan(0);
    const product = matches[0];
    expect(product.name.toLowerCase()).toContain('fortune');

    const inventory = checkInventory(product.id);
    expect(inventory.stockQuantity).toBeGreaterThanOrEqual(0);
    expect(inventory.sellingPrice).toBeGreaterThan(0);
  });

  it('reserves stock atomically and rejects insufficient quantities', () => {
    const product = searchProducts('maggi')[0];
    expect(() => reserveInventory(product.id, 999, 'store-demo')).toThrow(/insufficient stock/i);

    const result = reserveInventory(product.id, 2, 'store-demo');
    expect(result.quantity).toBe(2);
    expect(checkInventory(product.id).stockQuantity).toBeLessThan(20);
  });

  it('detects low stock after an adjustment', () => {
    const product = searchProducts('tata salt')[0];
    const alert = ensureLowStock(product.id, 2, 'store-demo');
    expect(alert).toBe(true);
  });
});

describe('orders and loyalty', () => {
  it('creates an order with item snapshots and totals', () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    const product = searchProducts('aashirvaad atta')[0];
    const order = createOrder({
      storeId: 'store-demo',
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 2 }],
      deliveryFee: 0,
      discount: 0,
      loyaltyBenefit: 'standard',
      idempotencyKey: 'order-2'
    });

    expect(order.total).toBeGreaterThan(0);
    expect(order.items[0].productNameSnapshot).toBeTruthy();
    expect(order.items[0].unitPrice).toBeGreaterThan(0);
  });

  it('returns same order for duplicate idempotency keys', () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    const product = searchProducts('maggi')[0];
    const first = createOrder({
      storeId: 'store-demo',
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      deliveryFee: 0,
      discount: 0,
      loyaltyBenefit: 'standard',
      idempotencyKey: 'dup-1'
    });

    const second = createOrder({
      storeId: 'store-demo',
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      deliveryFee: 0,
      discount: 0,
      loyaltyBenefit: 'standard',
      idempotencyKey: 'dup-1'
    });

    expect(second.id).toBe(first.id);
  });

  it('evaluates loyalty rules using actual store data', () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    const result = evaluateLoyalty(customer.id, 700);
    expect(result.isEligible).toBeDefined();
  });
});

describe('agent workflow', () => {
  it('handles a normal product order', async () => {
    const result = await processAgentMessage({
      storeId: 'store-demo',
      phone: '+919999999999',
      message: 'Bhaiya 2 kilo aata, 1 litre Fortune oil aur 3 Maggi bhej do.'
    });

    expect(result.status).toBe('confirmed');
    expect(result.orderId).toBeTruthy();
    expect(result.message).toMatch(/order|confirmed/i);
  });

  it('matches every item in a milk, tea, and sugar request', async () => {
    const result = await processAgentMessage({
      storeId: 'store-demo',
      phone: '+919999999999',
      message: '2 milk packets and 1 tea and 1kg sugar'
    });

    expect(result.status).toBe('confirmed');
    expect(result.message).toContain('Mother Dairy Milk');
    expect(result.message).toContain('Tata Tea');
    expect(result.message).toContain('Madhur Sugar');
    expect(result.total).toBe(242);
    expect(result.items).toHaveLength(3);
  });

  it('does not invent atta for an unknown request', async () => {
    const result = await processAgentMessage({
      storeId: 'store-demo',
      phone: '+919999999999',
      message: 'please send something special'
    });

    expect(result.status).toBe('needs_clarification');
    expect(result.message).not.toContain('Aashirvaad Atta');
  });

  it('returns clarification when a product is ambiguous', async () => {
    const customer = createCustomer({
      storeId: 'store-demo',
      fullName: 'Priya Sharma',
      phone: '+919999999999',
      address: '12 Market Road',
      area: 'Saket',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001'
    });

    const result = await processAgentMessage({
      storeId: 'store-demo',
      customerId: customer.id,
      message: 'Wahi oil dena jo last time liya tha.'
    });

    expect(['clarification', 'needs_clarification']).toContain(result.status);
  });

  it('requires customer information when a customer is missing', async () => {
    const result = await processAgentMessage({
      storeId: 'store-demo',
      message: 'Mera usual order bhej do.'
    });

    expect(result.status).toBe('needs_customer');
  });
});

it('has a seeded store and product catalog that is queryable', () => {
  const store = getDatabase().prepare('SELECT COUNT(*) as count FROM stores').get() as { count: number };
  const products = getDatabase().prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  const product = getProductById(searchProducts('atta')[0].id);

  expect(store.count).toBeGreaterThan(0);
  expect(products.count).toBeGreaterThan(0);
  expect(product?.name).toBeTruthy();
});
