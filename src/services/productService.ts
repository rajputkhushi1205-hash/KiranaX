import { getDatabase } from '../db/database.js';

export function searchProducts(query: string, storeId = 'store-demo') {
  const db = getDatabase();
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return db.prepare(
      `SELECT p.*, i.stock_quantity AS stock_quantity, i.selling_price AS selling_price
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.store_id = ? AND p.active = 1
       ORDER BY p.name ASC LIMIT 20`
    ).all(storeId) as any[];
  }

  const keyword = `%${normalized}%`;
  return db.prepare(
    `SELECT p.*, i.stock_quantity AS stock_quantity, i.selling_price AS selling_price
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.store_id = ?
       AND p.active = 1
       AND (
         lower(p.name) LIKE ?
         OR lower(p.normalized_name) LIKE ?
         OR lower(COALESCE(p.brand, '')) LIKE ?
         OR lower(COALESCE(p.category, '')) LIKE ?
       )
     ORDER BY p.name ASC LIMIT 10`
  ).all(storeId, keyword, keyword, keyword, keyword) as any[];
}

export function getProductById(productId: string) {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT p.*, i.stock_quantity, i.selling_price, i.low_stock_threshold
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id = ?`
  ).get(productId) as any;

  if (!row) return null;

  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    normalizedName: row.normalized_name,
    category: row.category,
    brand: row.brand,
    unit: row.unit,
    description: row.description,
    active: Boolean(row.active),
    stockQuantity: Number(row.stock_quantity ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 0)
  };
}

export function findAlternativeProducts(productId: string, storeId = 'store-demo') {
  const target = getProductById(productId);
  if (!target) return [];

  const rows = searchProducts(target.category ?? target.name, storeId);
  return rows.filter((row) => row.id !== productId && Number(row.stock_quantity ?? 0) > 0).slice(0, 5);
}
