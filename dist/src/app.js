import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { routeHealth } from './routes/health.js';
import { routeProducts } from './routes/products.js';
import { routeCustomers } from './routes/customers.js';
import { routeOrders } from './routes/orders.js';
import { routeAgent } from './routes/agent.js';
export function createApp() {
    const app = express();
    app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
    app.use(express.json({ limit: '1mb' }));
    app.use(morgan('dev'));
    app.use('/api', routeHealth());
    app.use('/api/products', routeProducts());
    app.use('/api/customers', routeCustomers());
    app.use('/api/orders', routeOrders());
    app.use('/api/agent', routeAgent());
    app.use((err, _req, res, _next) => {
        const message = err?.message ?? 'Internal server error';
        const status = err?.statusCode ?? 500;
        res.status(status).json({ success: false, error: { code: err?.code ?? 'INTERNAL_ERROR', message } });
    });
    return app;
}
//# sourceMappingURL=app.js.map