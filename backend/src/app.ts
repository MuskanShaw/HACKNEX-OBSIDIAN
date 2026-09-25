import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { storageBootstrap } from './services/storageBootstrap.js';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import templateRoutes from './routes/template.routes.js';
import { deployRoutes, deploymentStatusRoutes } from './routes/deploy.routes.js';
import publicRoutes from './routes/public.routes.js';
import docsRoutes from './routes/docs.routes.js';
import accountRoutes from './routes/account.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import mapsRoutes from './routes/maps.routes.js';
import realtimeRoutes from './routes/realtime.routes.js';

import { getSupabaseClient, isLiveSupabaseConfigured } from './services/supabase.js';

export function createApp(): Express {
  const app = express();

  // Trust first proxy hop (Render, Vercel, Cloudflare) for accurate client IP and express-rate-limit
  app.set('trust proxy', 1);

  // Initialize Supabase Storage bucket verification in background
  if (env.NODE_ENV !== 'test') {
    storageBootstrap.ensureBucketExists().catch((err) => {
      console.warn('⚠️  Storage bootstrap background warning:', err.message);
    });
  }

  // Security and utilities
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const rawAllowedOrigins = (env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const defaultOrigins = [
    'https://obsidian-alpha-wheat.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const allowedOrigins = Array.from(new Set([...rawAllowedOrigins, ...defaultOrigins]));

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = requestOrigin.replace(/\/$/, '');
        const isExplicitlyAllowed = allowedOrigins.includes(normalizedOrigin);

        let isVercelDomain = false;
        try {
          const parsedHost = new URL(requestOrigin).hostname;
          isVercelDomain = parsedHost.endsWith('.vercel.app');
        } catch {
          isVercelDomain = false;
        }

        if (isExplicitlyAllowed || isVercelDomain) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'apikey',
      ],
    })
  );

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // General rate limiter
  app.use('/api', generalRateLimiter);

  // Health and System Check
  app.get('/health', async (_req, res) => {
    let dbStatus = 'connected';
    if (isLiveSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('stores').select('id', { head: true, count: 'exact' });
        if (error && error.code === 'PGRST301') {
          dbStatus = 'error';
        }
      } catch {
        dbStatus = 'disconnected';
      }
    }

    res.status(200).json({
      status: 'ok',
      service: 'obsidian-backend',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'OBSIDIAN Storefront Backend Service',
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/health',
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/maps', mapsRoutes);
  app.use('/api/stores/:id/analytics', analyticsRoutes);
  app.use('/api/stores/:id/realtime', realtimeRoutes);
  app.use('/api/stores/:id/products', productRoutes);
  app.use('/api/stores/:id/orders', orderRoutes);
  app.use('/api/stores/:id/deploy', deployRoutes);
  app.use('/api/stores/:id/deployment-status', deploymentStatusRoutes);
  app.use('/api/stores', storeRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/public', publicRoutes);
  // Swagger API Documentation & Specification Aliases
  app.use('/api/docs', docsRoutes);
  app.use('/docs', docsRoutes);
  app.use('/swagger', docsRoutes);
  app.use('/api-docs', docsRoutes);
  app.get('/swagger.json', (_req, res) => res.redirect('/api/docs/swagger.json'));
  app.get('/openapi.json', (_req, res) => res.redirect('/api/docs/swagger.json'));

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
