import { getDatabase } from '../db/database.js';
import { getCustomerHistory } from './customerService.js';
export function evaluateLoyalty(customerId, subtotal) {
    const history = getCustomerHistory(customerId);
    const isEligible = history.totalOrders >= 10 || subtotal >= 500;
    return {
        customerId,
        isEligible,
        reason: isEligible ? 'Order threshold met or frequent buyer eligible.' : 'No loyalty benefit available.',
        benefit: isEligible ? 'Free delivery' : null,
        freeDelivery: isEligible
    };
}
export function getLoyaltyRules(storeId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM loyalty_rules WHERE store_id = ? AND active = 1').all(storeId);
}
//# sourceMappingURL=loyaltyService.js.map