import { Router } from 'express';
import { processAgentMessage } from '../agent/agentService.js';
export function routeAgent() {
    const router = Router();
    router.post('/message', async (req, res) => {
        const { storeId, phone, customerId, message } = req.body ?? {};
        if (!storeId || !message) {
            return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'storeId and message are required.' } });
        }
        try {
            const response = await processAgentMessage({ storeId, phone, customerId, message });
            return res.json({ success: true, data: response });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: { code: 'AGENT_ERROR', message: error.message } });
        }
    });
    return router;
}
//# sourceMappingURL=agent.js.map