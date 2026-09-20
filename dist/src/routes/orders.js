import { Router } from 'express';
import { z } from 'zod';
import { createOrder, getOrder } from '../services/orderService.js';
const orderItemSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive()
});
const createOrderSchema = z.object({
    storeId: z.string().min(1),
    customerId: z.string().min(1),
    items: z.array(orderItemSchema).min(1),
    deliveryFee: z.number().optional(),
    discount: z.number().optional(),
    loyaltyBenefit: z.string().optional(),
    idempotencyKey: z.string().optional()
});
export function routeOrders() {
    const router = Router();
    router.get('/:id', (req, res) => {
        try {
            const order = getOrder(req.params.id);
            return res.json({ success: true, data: order });
        }
        catch (error) {
            return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: error.message } });
        }
    });
    router.post('/', (req, res) => {
        const parsed = createOrderSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid order payload.' } });
        }
        try {
            const order = createOrder(parsed.data);
            return res.status(201).json({ success: true, data: order });
        }
        catch (error) {
            const message = error.message;
            return res.status(409).json({ success: false, error: { code: 'ORDER_ERROR', message } });
        }
    });
    return router;
}
//# sourceMappingURL=orders.js.map