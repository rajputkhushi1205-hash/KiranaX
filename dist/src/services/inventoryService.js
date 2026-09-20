import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
export function checkInventory(productId, storeId = 'store-demo') {
    const row = getDatabase().prepare(`SELECT i.*, p.name, p.normalized_name FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE i.product_id = ? AND i.store_id = ?`).get(productId, storeId);
    if (!row) {
        throw new Error('Inventory not found for product.');
    }
    return {
        productId,
        storeId,
        productName: row.name,
        stockQuantity: Number(row.stock_quantity),
        lowStockThreshold: Number(row.low_stock_threshold),
        sellingPrice: Number(row.selling_price),
        updatedAt: row.updated_at
    };
}
export function reserveInventory(productId, quantity, storeId = 'store-demo') {
    const db = getDatabase();
    const row = db.prepare(`SELECT i.*, p.name FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE i.product_id = ? AND i.store_id = ?`).get(productId, storeId);
    if (!row) {
        throw new Error('Inventory not found for product.');
    }
    if (quantity > Number(row.stock_quantity)) {
        throw new Error(`Insufficient stock: only ${row.stock_quantity} available.`);
    }
    const previous = Number(row.stock_quantity);
    const updated = previous - quantity;
    db.prepare(`UPDATE inventory SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(updated, row.id);
    db.prepare(`INSERT INTO inventory_transactions (id, store_id, product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, created_at)
     VALUES (?, ?, ?, 'SALE', ?, ?, ?, 'Order sale', datetime('now'))`).run(randomUUID(), storeId, productId, -quantity, previous, updated);
    return { productId, quantity, remaining: updated };
}
export function ensureLowStock(productId, remaining, storeId = 'store-demo') {
    const db = getDatabase();
    const row = db.prepare('SELECT low_stock_threshold FROM inventory WHERE product_id = ? AND store_id = ?').get(productId, storeId);
    if (!row)
        return false;
    return remaining <= Number(row.low_stock_threshold);
}
//# sourceMappingURL=inventoryService.js.map