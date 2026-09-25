import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { validateRequest } from '../middleware/validate.js';
import { dataStore } from '../services/dataStore.js';
import { realtimeService } from '../services/realtimeService.js';
import { toFrontendOrder, generateNumericId } from '../types/index.js';

const router = Router({ mergeParams: true });

const orderItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  productId: z.union([z.string(), z.number()]).optional().nullable(),
  product_id: z.union([z.string(), z.number()]).optional().nullable(),
  name: z.string().optional(),
  productName: z.string().optional(),
  product_name: z.string().optional(),
  title: z.string().optional(),
  quantity: z.coerce.number().int().positive('Item quantity must be greater than zero').default(1),
  qty: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().min(0, 'Item price cannot be negative').optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  emoji: z.string().optional(),
  image: z.string().optional().nullable(),
});

const createOrderSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  client_id: z.union([z.string(), z.number()]).optional(),

  // Customer identity & contact
  customerName: z.string().optional(),
  customer_name: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customer_email: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  customer_phone: z.string().optional(),
  phone: z.string().optional(),
  customerAddress: z.string().optional(),
  customer_address: z.string().optional(),
  address: z.string().optional(),
  paymentMethod: z.string().optional(),
  payment_method: z.string().optional(),

  // Nested line items
  items: z.array(orderItemSchema).optional(),
  order_items: z.array(orderItemSchema).optional(),

  // Single-product backward compatibility
  productId: z.union([z.string(), z.number()]).optional().nullable(),
  product_id: z.union([z.string(), z.number()]).optional().nullable(),
  productName: z.string().optional(),
  product_name: z.string().optional(),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero').optional(),

  // Pricing variations
  totalPrice: z.coerce.number().min(0).optional(),
  total_price: z.coerce.number().min(0).optional(),
  totalAmount: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0).optional(),

  // Status & Date
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).default('pending'),
  date: z.string().optional(),
  order_date: z.string().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']),
});

/**
 * GET /api/stores/:id/orders
 * Retrieves store orders formatted for the frontend dashboard
 */
router.get(
  '/',
  requireAuth,
  verifyStoreOwnership,
  async (req, res, next) => {
    try {
      const storeId = req.params.id;
      const orders = await dataStore.getOrdersByStoreId(storeId);
      const products = await dataStore.getProductsByStoreId(storeId);

      // Map product internal UUID to client numeric ID
      const productClientIdMap = new Map<string, number>();
      for (const p of products) {
        if (p.client_id !== undefined && p.client_id !== null) {
          productClientIdMap.set(p.id, Number(p.client_id));
        }
      }

      res.status(200).json({
        orders: orders.map((o) =>
          toFrontendOrder(o, o.product_id ? productClientIdMap.get(o.product_id) : null)
        ),
        rawOrders: orders,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/stores/:id/orders/:orderId
 * Retrieves a single order by ID or client ID
 */
router.get(
  '/:orderId',
  requireAuth,
  verifyStoreOwnership,
  async (req, res, next) => {
    try {
      const { orderId, id: storeId } = req.params;
      const order = await dataStore.getOrderByClientOrBackendId(storeId, orderId);
      if (!order || order.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Order not found in this store' });
        return;
      }

      res.status(200).json({
        order: toFrontendOrder(order),
        rawOrder: order,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/stores/:id/orders
 * Places a customer order supporting either nested line items or legacy single-item format,
 * with atomic inventory check, server price calculation, and real-time updates.
 */
router.post(
  '/',
  validateRequest({ body: createOrderSchema }),
  async (req, res, next) => {
    try {
      const storeId = req.params.id;
      const store = await dataStore.getStoreById(storeId);
      if (!store) {
        res.status(404).json({ error: 'Not Found', message: 'Store not found' });
        return;
      }

      const b = req.body;
      const customerName = (b.customerName || b.customer_name || 'Valued Customer').trim();
      const customerEmail = (b.customerEmail || b.customer_email || '').trim() || null;
      const customerPhone = (b.customerPhone || b.customer_phone || b.phone || '').trim() || null;
      const customerAddress = (b.customerAddress || b.customer_address || b.address || '').trim() || null;
      const paymentMethod = (b.paymentMethod || b.payment_method || '').trim() || null;
      const clientId = b.id || b.client_id || generateNumericId();

      const rawItems = Array.isArray(b.items) && b.items.length > 0
        ? b.items
        : Array.isArray(b.order_items) && b.order_items.length > 0
        ? b.order_items
        : null;

      const totalGiven =
        b.totalAmount !== undefined && Number(b.totalAmount) >= 0
          ? Number(b.totalAmount)
          : b.total_amount !== undefined && Number(b.total_amount) >= 0
          ? Number(b.total_amount)
          : b.totalPrice !== undefined && Number(b.totalPrice) >= 0
          ? Number(b.totalPrice)
          : b.total_price !== undefined && Number(b.total_price) >= 0
          ? Number(b.total_price)
          : b.total !== undefined && Number(b.total) >= 0
          ? Number(b.total)
          : undefined;

      // ── BRANCH 1: Nested Line Items (Cart Checkout) ──
      if (rawItems && rawItems.length > 0) {
        const { order, remainingStocks } = await dataStore.placeMultiItemOrderAtomic({
          store_id: storeId,
          items: rawItems,
          client_id: clientId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          payment_method: paymentMethod,
          status: b.status || 'pending',
          total_price: totalGiven,
          total_amount: totalGiven,
        });

        const formatted = toFrontendOrder(order);

        realtimeService.broadcast(storeId, 'ORDER_CREATED', { order: formatted });
        for (const rem of remainingStocks) {
          realtimeService.broadcast(storeId, 'STOCK_UPDATED', {
            productId: rem.productId,
            stock: rem.stock,
          });
        }

        res.status(201).json({
          message: 'Order created successfully',
          order: formatted,
          rawOrder: order,
          remainingStocks,
        });
        return;
      }

      // ── BRANCH 2: Single Product Format (Direct / Legacy) ──
      const rawProductId = b.productId !== undefined ? b.productId : b.product_id;
      const quantity = b.quantity ?? 1;

      let matchedProduct = null;
      if (rawProductId !== undefined && rawProductId !== null && String(rawProductId).trim() !== '') {
        matchedProduct = await dataStore.getProductByClientOrBackendId(storeId, rawProductId);
      }

      if (!matchedProduct) {
        if (rawProductId !== undefined && rawProductId !== null && String(rawProductId).trim() !== '') {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Product does not belong to this store or does not exist.',
          });
          return;
        }

        // If product id is absent, check if product name was provided directly
        if (!b.productName && !b.product_name) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'A valid product (productId, productName, or items array) is required to place an order.',
          });
          return;
        }

        // Standalone order with custom item name
        const finalPrice = totalGiven !== undefined ? totalGiven : 0;
        const order = await dataStore.createOrder({
          store_id: storeId,
          product_id: null,
          client_id: clientId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          payment_method: paymentMethod,
          product_name: b.productName || b.product_name,
          quantity,
          total_price: finalPrice,
          total_amount: finalPrice,
          status: b.status || 'pending',
          date: b.date || b.orderDate || b.order_date || b.createdAt,
          createdAt: b.createdAt,
          items: [
            {
              productName: b.productName || b.product_name,
              quantity,
              price: finalPrice,
            },
          ],
        });

        const formatted = toFrontendOrder(order);
        realtimeService.broadcast(storeId, 'ORDER_CREATED', { order: formatted });

        res.status(201).json({
          message: 'Order created successfully',
          order: formatted,
          rawOrder: order,
        });
        return;
      }

      // Atomic placement with catalog inventory check & deduction
      const { order, remainingStock } = await dataStore.placeOrderAtomic({
        store_id: storeId,
        product_id: matchedProduct.id,
        client_id: clientId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        payment_method: paymentMethod,
        quantity,
        status: b.status || 'pending',
        total_price: totalGiven,
        total_amount: totalGiven,
      });

      const formatted = toFrontendOrder(order, matchedProduct.client_id ? Number(matchedProduct.client_id) : null);

      realtimeService.broadcast(storeId, 'ORDER_CREATED', { order: formatted });
      realtimeService.broadcast(storeId, 'STOCK_UPDATED', {
        productId: matchedProduct.client_id || matchedProduct.id,
        stock: remainingStock,
      });

      res.status(201).json({
        message: 'Order created successfully',
        order: formatted,
        rawOrder: order,
        remainingStock,
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (
        msg.toLowerCase().includes('insufficient') ||
        msg.toLowerCase().includes('stock') ||
        msg.toLowerCase().includes('inventory')
      ) {
        res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: err.message,
        });
        return;
      }
      if (
        msg.toLowerCase().includes('does not belong') ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('must contain') ||
        msg.toLowerCase().includes('quantity must be greater')
      ) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * PATCH /api/stores/:id/orders/:orderId/status
 * Updates order status (pending, processing, completed, cancelled)
 */
router.patch(
  '/:orderId/status',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: updateOrderStatusSchema }),
  async (req, res, next) => {
    try {
      const { orderId, id: storeId } = req.params;
      const { status } = req.body;

      const existing = await dataStore.getOrderByClientOrBackendId(storeId, orderId);
      if (!existing || existing.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Order not found in this store' });
        return;
      }

      const updated = await dataStore.updateOrderStatus(existing.id, status);
      const formatted = toFrontendOrder(updated);

      realtimeService.broadcast(storeId, 'ORDER_UPDATED', { order: formatted });

      res.status(200).json({
        message: 'Order status updated successfully',
        order: formatted,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id/orders/:orderId
 * Deletes an order from the store
 */
router.delete(
  '/:orderId',
  requireAuth,
  verifyStoreOwnership,
  async (req, res, next) => {
    try {
      const { orderId, id: storeId } = req.params;

      const existing = await dataStore.getOrderByClientOrBackendId(storeId, orderId);
      if (!existing || existing.store_id !== storeId) {
        res.status(404).json({ error: 'Not Found', message: 'Order not found in this store' });
        return;
      }

      await dataStore.deleteOrder(existing.id);
      realtimeService.broadcast(storeId, 'ORDER_DELETED', {
        id: existing.client_id || existing.id,
        backendId: existing.id,
      });

      res.status(200).json({
        message: 'Order deleted successfully',
        deletedId: existing.client_id || existing.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
