import { Router } from 'express';
import { searchProducts, getProductById } from '../services/productService.js';

export function routeProducts() {
  const router = Router();

  router.get('/', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const products = searchProducts(query, 'store-demo');
    res.json({ success: true, data: products });
  });

  router.get('/:id', (req, res) => {
    const product = getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } });
    }
    return res.json({ success: true, data: product });
  });

  return router;
}
