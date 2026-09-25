import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { validateRequest } from '../middleware/validate.js';
import { dataStore } from '../services/dataStore.js';
import { realtimeService } from '../services/realtimeService.js';
import { toFrontendProduct, generateNumericId } from '../types/index.js';

const router = Router({ mergeParams: true });

const createProductSchema = z.object({
  id: z.coerce.number().optional(),
  clientId: z.coerce.number().optional(),
  client_id: z.coerce.number().optional(),
  name: z.string().min(1, 'Product name is required').max(200),
  price: z.coerce.number().positive('Price must be greater than zero'),
  discountPrice: z.coerce.number().positive().optional().nullable(),
  discount_price: z.coerce.number().positive().optional().nullable(),
  stock: z.coerce.number().int().nonnegative('Stock cannot be negative').default(10),
  emoji: z.string().default('📦'),
  category: z.string().default('General'),
  description: z.string().optional().nullable(),
  image: z.string().url().optional().nullable().or(z.literal('')),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
});

const updateProductSchema = createProductSchema.partial();

const adjustStockSchema = z.object({
  delta: z.coerce.number().int().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
});

const productQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
});

/**
 * GET /api/stores/:id/products
 * Lists all store products formatted with camelCase and numeric client IDs
 */
router.get(
  '/',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ query: productQuerySchema }),
  async (req, res, next) => {
    try {
      const storeId = req.params.id;
      const { search, category, status } = req.query as {
        search?: string;
        category?: string;
        status?: string;
      };

      const products = await dataStore.getProductsByStoreId(storeId, { search, category, status });
      res.status(200).json({
        products: products.map(toFrontendProduct),
        rawProducts: products,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/stores/:id/products/:productId
 * Retrieves a single product by client numeric ID or UUID
 */
router.get(
  '/:productId',
  requireAuth,
  verifyStoreOwnership,
  async (req, res, next) => {
    try {
      const { productId, id: storeId } = req.params as { productId: string; id: string };
      const product = await dataStore.getProductByClientOrBackendId(storeId, productId);
      if (!product || product.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Product not found' });
        return;
      }
      res.status(200).json({
        product: toFrontendProduct(product),
        rawProduct: product,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/stores/:id/products
 * Creates a new product for the store
 */
router.post(
  '/',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const storeId = req.params.id;
      const b = req.body;

      const clientId = b.id || b.clientId || b.client_id || generateNumericId();
      const discountPrice = b.discountPrice !== undefined ? b.discountPrice : b.discount_price;
      const imageUrl = b.image !== undefined ? b.image : b.image_url;

      const product = await dataStore.createProduct({
        store_id: storeId,
        client_id: clientId,
        name: b.name,
        price: b.price,
        discount_price: discountPrice || null,
        stock: b.stock ?? 10,
        emoji: b.emoji || '📦',
        category: b.category || 'General',
        description: b.description || null,
        image_url: imageUrl || null,
        status: b.status || 'active',
      });

      const frontendProduct = toFrontendProduct(product);
      realtimeService.broadcast(storeId, 'PRODUCT_CREATED', { product: frontendProduct });

      res.status(201).json({
        message: 'Product created successfully',
        product: frontendProduct,
        rawProduct: product,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/stores/:id/products/:productId
 * Modifies an existing product (resolves either UUID or numeric client_id)
 */
router.put(
  '/:productId',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: updateProductSchema }),
  async (req, res, next) => {
    try {
      const { productId, id: storeId } = req.params;
      const b = req.body;

      const existing = await dataStore.getProductByClientOrBackendId(storeId, productId);
      if (!existing || existing.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Product not found in this store' });
        return;
      }

      const updates: Record<string, any> = {};
      if (b.name !== undefined) updates.name = b.name;
      if (b.price !== undefined) updates.price = b.price;
      if (b.discountPrice !== undefined || b.discount_price !== undefined) {
        updates.discount_price = b.discountPrice !== undefined ? b.discountPrice : b.discount_price;
      }
      if (b.stock !== undefined) updates.stock = b.stock;
      if (b.emoji !== undefined) updates.emoji = b.emoji;
      if (b.category !== undefined) updates.category = b.category;
      if (b.description !== undefined) updates.description = b.description;
      if (b.image !== undefined || b.image_url !== undefined) {
        updates.image_url = b.image !== undefined ? b.image : b.image_url;
      }
      if (b.status !== undefined) updates.status = b.status;

      const updated = await dataStore.updateProduct(existing.id, updates);
      const frontendProduct = toFrontendProduct(updated);

      realtimeService.broadcast(storeId, 'PRODUCT_UPDATED', { product: frontendProduct });

      res.status(200).json({
        message: 'Product updated successfully',
        product: frontendProduct,
        rawProduct: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/stores/:id/products/:productId/stock
 * Adjusts product inventory stock safely without allowing negative stock
 */
router.patch(
  '/:productId/stock',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: adjustStockSchema }),
  async (req, res, next) => {
    try {
      const { productId, id: storeId } = req.params;
      const { delta, stock } = req.body;

      const existing = await dataStore.getProductByClientOrBackendId(storeId, productId);
      if (!existing || existing.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Product not found in this store' });
        return;
      }

      let updatedProduct;
      if (stock !== undefined) {
        updatedProduct = await dataStore.updateProduct(existing.id, { stock: Math.max(0, stock) });
      } else if (delta !== undefined) {
        updatedProduct = await dataStore.adjustStock(existing.id, delta);
      } else {
        res.status(400).json({ error: 'Bad Request', message: 'Either stock or delta must be specified' });
        return;
      }

      const frontendProduct = toFrontendProduct(updatedProduct);
      realtimeService.broadcast(storeId, 'STOCK_UPDATED', {
        productId: frontendProduct.id,
        stock: frontendProduct.stock,
      });

      res.status(200).json({
        message: 'Stock updated successfully',
        product: frontendProduct,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id/products/:productId
 * Deletes a product from the store (resolves either UUID or numeric client_id)
 */
router.delete(
  '/:productId',
  requireAuth,
  verifyStoreOwnership,
  async (req, res, next) => {
    try {
      const { productId, id: storeId } = req.params;

      const existing = await dataStore.getProductByClientOrBackendId(storeId, productId);
      if (!existing || existing.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Product not found in this store' });
        return;
      }

      await dataStore.deleteProduct(existing.id);
      realtimeService.broadcast(storeId, 'PRODUCT_DELETED', {
        id: existing.client_id || existing.id,
        backendId: existing.id,
      });

      res.status(200).json({
        message: 'Product deleted successfully',
        deletedId: existing.client_id || existing.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
