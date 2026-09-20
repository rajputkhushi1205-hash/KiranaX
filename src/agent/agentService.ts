import { randomUUID } from 'node:crypto';
import { createCustomer, findCustomerByPhone, getCustomerProfile } from '../services/customerService.js';
import { searchProducts, findAlternativeProducts } from '../services/productService.js';
import { createOrder } from '../services/orderService.js';

const quantityWords: Record<string, number> = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3 };
const productMatchers = [
  { pattern: /(?:milk|doodh)/i, query: 'milk' },
  { pattern: /(?:tea|chai)/i, query: 'tea' },
  { pattern: /(?:sugar|cheeni)/i, query: 'sugar' },
  { pattern: /(?:aata|atta)/i, query: 'aashirvaad atta' },
  { pattern: /fortune.*oil|oil/i, query: 'fortune oil' },
  { pattern: /maggi/i, query: 'maggi' },
  { pattern: /(?:tata )?salt|namak/i, query: 'tata salt' },
  { pattern: /surf excel/i, query: 'surf excel' },
  { pattern: /ariel/i, query: 'ariel' }
];

function quantityFor(segment: string) {
  const match = segment.match(/\b(\d+(?:\.\d+)?|ek|one|do|two|teen|three)\b/i);
  if (!match) return 1;
  return quantityWords[match[1].toLowerCase()] ?? Number(match[1]);
}

function parseRequestedItems(message: string) {
  return message
    .split(/\s*(?:,|\band\b|\baur\b)\s*/i)
    .map((segment) => {
      const matcher = productMatchers.find((candidate) => candidate.pattern.test(segment));
      return matcher ? { query: matcher.query, quantity: quantityFor(segment) } : null;
    })
    .filter((item): item is { query: string; quantity: number } => Boolean(item));
}

export async function processAgentMessage(input: {
  storeId: string;
  phone?: string;
  customerId?: string;
  message: string;
}) {
  const msg = input.message.trim();

  if (!input.customerId && !input.phone) {
    if (/usual order|usual order bhej do|mera usual order/i.test(msg)) {
      return { status: 'needs_customer', message: 'I need your customer information before I can recreate your usual order.' };
    }
    return { status: 'needs_customer', message: 'I need your customer details before I can place the order.' };
  }

  let customer = input.customerId
    ? getCustomerProfile(input.customerId).customer
    : findCustomerByPhone(input.storeId, input.phone ?? '');

  if (!customer && input.phone) {
    customer = createCustomer({
      storeId: input.storeId,
      fullName: 'Store Customer',
      phone: input.phone
    });
  }

  if (!customer) {
    return { status: 'needs_customer', message: 'I could not find your account. Please share your phone number or register as a customer.' };
  }

  const lower = msg.toLowerCase();
  if (/wahi oil|oil dena jo last time/i.test(lower)) {
    const options = searchProducts('oil', input.storeId).slice(0, 3);
    return {
      status: 'clarification',
      message: 'I found more than one oil option in your history. Please choose one.',
      options: options.map((product) => ({ productId: product.id, name: product.name }))
    };
  }

  if (/usual order|mera usual order/i.test(lower)) {
    return {
      status: 'needs_customer',
      message: 'I need your customer information before I can recreate a usual order.'
    };
  }

  const requestedItems = parseRequestedItems(lower);
  if (requestedItems.length === 0) {
    return { status: 'needs_clarification', message: 'I could not identify a product in that request. Please tell me the item and quantity.' };
  }

  const resolvedItems = requestedItems.map((item) => ({
    ...item,
    product: searchProducts(item.query, input.storeId)[0]
  }));
  const missing = resolvedItems.filter((item) => !item.product);
  if (missing.length > 0) {
    return { status: 'needs_clarification', message: `I could not find ${missing.map((item) => item.query).join(' and ')} in the store catalog.` };
  }

  const unavailable = resolvedItems.filter((item) => item.product && item.quantity > Number(item.product.stock_quantity ?? 0));
  if (unavailable.length > 0) {
    const item = unavailable[0];
    const alternatives = findAlternativeProducts(item.product!.id, input.storeId).map((alternative) => ({ productId: alternative.id, name: alternative.name }));
    return {
      status: 'unavailable',
      message: `${item.product!.name} is unavailable in the requested quantity. I found ${alternatives.length ? 'these alternatives' : 'no suitable in-stock alternative'}.`,
      alternatives
    };
  }

  const order = createOrder({
    storeId: input.storeId,
    customerId: customer.id,
    items: resolvedItems.map((item) => ({ productId: item.product!.id, quantity: item.quantity })),
    deliveryFee: 0,
    discount: 0,
    loyaltyBenefit: 'standard',
    idempotencyKey: `agent-${randomUUID()}`
  });

  const itemSummary = order.items.map((item) => `${item.quantity} × ${item.productNameSnapshot} (${item.unitPrice})`).join(', ');
  return {
    status: 'confirmed',
    orderId: order.id,
    message: `Order confirmed for ${customer.fullName}. I found ${itemSummary}. Your total is ₹${order.total}.`,
    items: order.items,
    total: order.total
  };
}
