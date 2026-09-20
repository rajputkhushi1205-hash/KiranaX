import { Router } from 'express';
export function routeHealth() {
    const router = Router();
    router.get('/health', (_req, res) => {
        res.json({ success: true, data: { status: 'ok', service: 'kiranax-backend' } });
    });
    return router;
}
//# sourceMappingURL=health.js.map