import { Router } from 'express';
import { z } from 'zod';
import { createCustomer, getCustomerHistory, getCustomerProfile } from '../services/customerService.js';
const createCustomerSchema = z.object({
    storeId: z.string().min(1),
    fullName: z.string().min(2),
    phone: z.string().min(6),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    area: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    landmark: z.string().optional()
});
export function routeCustomers() {
    const router = Router();
    router.post('/', (req, res) => {
        const parsed = createCustomerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid customer payload.' } });
        }
        try {
            const customer = createCustomer({
                storeId: parsed.data.storeId,
                fullName: parsed.data.fullName,
                phone: parsed.data.phone,
                email: parsed.data.email || null,
                address: parsed.data.address,
                area: parsed.data.area,
                city: parsed.data.city,
                state: parsed.data.state,
                postalCode: parsed.data.postalCode,
                landmark: parsed.data.landmark
            });
            return res.status(201).json({ success: true, data: customer });
        }
        catch (error) {
            return res.status(409).json({ success: false, error: { code: 'CUSTOMER_EXISTS', message: error.message } });
        }
    });
    router.get('/:id', (req, res) => {
        try {
            const profile = getCustomerProfile(req.params.id);
            return res.json({ success: true, data: profile });
        }
        catch (error) {
            return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: error.message } });
        }
    });
    router.get('/:id/history', (req, res) => {
        try {
            const history = getCustomerHistory(req.params.id);
            return res.json({ success: true, data: history });
        }
        catch (error) {
            return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: error.message } });
        }
    });
    return router;
}
//# sourceMappingURL=customers.js.map