import { Router } from 'express';
import multer from 'multer';
import slugify from 'slugify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, toFrontendStore } from '../types/index.js';
import { dataStore } from '../services/dataStore.js';
import { storageService } from '../services/storageService.js';
import { templateService } from '../services/templateService.js';
import { locationService, InvalidAddressError } from '../services/locationService.js';
import { realtimeService } from '../services/realtimeService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const createStoreSchema = z.object({
  name: z.string().min(2, 'Store name must have at least 2 characters').max(100).optional(),
  store_name: z.string().min(2, 'Store name must have at least 2 characters').max(100).optional(),
  business_type: z.string().optional().default('clothing'),
  custom_business_type: z.string().optional().nullable(),
  custom_options: z.array(z.any()).optional().default([]),
  description: z.string().optional().nullable(),
  currency: z.string().default('₹'),
  address: z.string().optional().nullable(),
  address_method: z.string().default('manual'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  place_id: z.string().optional().nullable(),
  formatted_address: z.string().optional().nullable(),
  maps_url: z.string().optional().nullable(),
  location_source: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().or(z.literal('')).nullable(),
  social_links: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      whatsapp: z.string().optional(),
    })
    .optional(),
  selected_template_id: z.string().default('obsidian-classic'),
  is_default: z.boolean().optional(),
}).refine((data) => data.name || data.store_name, {
  message: 'Store name or store_name is required',
  path: ['name'],
});

const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  store_name: z.string().min(2).max(100).optional(),
  business_type: z.string().optional(),
  custom_business_type: z.string().optional().nullable(),
  custom_options: z.array(z.any()).optional(),
  description: z.string().optional().nullable(),
  currency: z.string().optional(),
  logo_url: z.string().url().optional().nullable().or(z.literal('')),
  banner_url: z.string().url().optional().nullable().or(z.literal('')),
  contact_email: z.string().email().optional().nullable().or(z.literal('')),
  contact_phone: z.string().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  address_method: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  place_id: z.string().optional().nullable(),
  formatted_address: z.string().optional().nullable(),
  maps_url: z.string().optional().nullable(),
  location_source: z.string().optional(),
  social_links: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      whatsapp: z.string().optional(),
    })
    .optional(),
  selected_template_id: z.string().optional(),
  is_default: z.boolean().optional(),
});

const updateLocationSchema = z.object({
  latitude: z.number({ required_error: 'Latitude is required' }).min(-90).max(90),
  longitude: z.number({ required_error: 'Longitude is required' }).min(-180).max(180),
  placeId: z.string().optional().nullable(),
  formattedAddress: z.string().optional().nullable(),
  mapsUrl: z.string().optional().nullable(),
  locationSource: z.enum(['manual', 'google_maps', 'google_places']).optional().default('google_maps'),
});

const selectTemplateSchema = z.object({
  templateId: z.string().min(1, 'templateId is required'),
});

/**
 * Helper to generate a unique slug
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = (slugify as any).default
    ? (slugify as any).default(name, { lower: true, strict: true })
    : slugify(name, { lower: true, strict: true }) || 'store';
  let slug = baseSlug;
  let collision = await dataStore.getStoreBySlug(slug);

  while (collision) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${baseSlug}-${suffix}`;
    collision = await dataStore.getStoreBySlug(slug);
  }

  return slug;
}

/**
 * Helper to automatically geocode address changes during store update/replace.
 * Gracefully handles invalid addresses (400) and temporary failures (preserves coordinates).
 */
async function resolveUpdatedLocation(
  existingStore: any,
  body: any
): Promise<{ errorResponse?: { status: number; body: any } }> {
  if (body.address !== undefined) {
    const rawNewAddress = body.address;
    if (typeof rawNewAddress === 'string' && rawNewAddress.trim() !== '') {
      const newAddress = rawNewAddress.trim();
      const existingAddress = (existingStore?.address || '').trim();
      const addressChanged = newAddress !== existingAddress;
      const missingCoords = existingStore?.latitude === null || existingStore?.latitude === undefined;

      if (addressChanged || missingCoords) {
        try {
          const geo = await locationService.geocode(newAddress);
          body.latitude = geo.latitude;
          body.longitude = geo.longitude;
          body.place_id = geo.placeId;
          body.formatted_address = geo.formattedAddress;
          body.maps_url = geo.mapsUrl;
          body.location_source = 'google_maps';
        } catch (geoErr: any) {
          if (geoErr instanceof InvalidAddressError || geoErr?.isInvalidAddress) {
            return {
              errorResponse: {
                status: 400,
                body: {
                  error: 'Invalid Address',
                  message:
                    geoErr.message ||
                    'The address could not be recognized by Google Maps. Please provide a valid address.',
                },
              },
            };
          }
          // Requirement 8: If geocoding fails temporarily, do not delete the previously stored valid coordinates.
          console.warn('[Geocoding] Temporary failure updating address, preserving existing coordinates:', geoErr.message);
          delete body.latitude;
          delete body.longitude;
          delete body.place_id;
          delete body.formatted_address;
          delete body.maps_url;
        }
      }
    }
  }
  return {};
}

/**
 * GET /api/stores/me
 * Retrieves current user's store(s) or default store
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const stores = await dataStore.getStoresByUserId(userId);
    let defaultStore: any = null;
    if (stores.length === 0) {
      defaultStore = await dataStore.getOrCreateDefaultStoreForUser(userId, {
        name: req.currentUser!.full_name ? `${req.currentUser!.full_name}'s Store` : 'My Obsidian Store',
        contact_email: req.currentUser!.email,
      });
      stores.push(defaultStore);
    } else {
      defaultStore = stores.find((s) => s.is_default) || stores[0];
    }
    const formattedDefault = toFrontendStore(defaultStore);
    res.status(200).json({
      stores: stores.map(toFrontendStore),
      store: formattedDefault,
      defaultStore: formattedDefault,
      formattedStore: formattedDefault,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/stores
 * Creates a new store profile with automatic address geocoding
 */
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createStoreSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        name,
        store_name,
        business_type,
        custom_business_type,
        custom_options,
        description,
        currency,
        address,
        address_method,
        latitude,
        longitude,
        place_id,
        formatted_address,
        maps_url,
        location_source,
        contact_email,
        contact_phone,
        phone,
        social_links,
        selected_template_id,
        is_default,
      } = req.body;

      const effectiveName = name || store_name || 'My Store';
      const effectivePhone = phone || contact_phone || null;
      const slug = await generateUniqueSlug(effectiveName);

      let resolvedLat = latitude ?? null;
      let resolvedLng = longitude ?? null;
      let resolvedPlaceId = place_id ?? null;
      let resolvedFormattedAddress = formatted_address ?? null;
      let resolvedMapsUrl = maps_url ?? null;
      let resolvedLocationSource = location_source || 'manual';

      // Automatic geocoding if address is provided
      if (address && typeof address === 'string' && address.trim()) {
        try {
          const geo = await locationService.geocode(address.trim());
          resolvedLat = geo.latitude;
          resolvedLng = geo.longitude;
          resolvedPlaceId = geo.placeId;
          resolvedFormattedAddress = geo.formattedAddress;
          resolvedMapsUrl = geo.mapsUrl;
          resolvedLocationSource = 'google_maps';
        } catch (geoErr: any) {
          if (geoErr instanceof InvalidAddressError || geoErr?.isInvalidAddress) {
            res.status(400).json({
              error: 'Invalid Address',
              message:
                geoErr.message ||
                'The address could not be recognized by Google Maps. Please provide a valid address.',
            });
            return;
          }
          console.warn('[Geocoding] Temporary issue during store creation address geocoding:', geoErr.message);
        }
      }

      if (!resolvedMapsUrl && resolvedLat !== null && resolvedLng !== null) {
        resolvedMapsUrl = locationService.generateMapsUrl(resolvedLat, resolvedLng);
      }

      const newStore = await dataStore.createStore({
        owner_id: req.currentUser!.id,
        user_id: req.currentUser!.id,
        name: effectiveName,
        store_name: effectiveName,
        slug,
        business_type: business_type || 'clothing',
        custom_business_type: custom_business_type || null,
        custom_options: custom_options || [],
        description: description || null,
        currency: currency || '₹',
        address: address || null,
        address_method: address_method || 'manual',
        latitude: resolvedLat,
        longitude: resolvedLng,
        place_id: resolvedPlaceId,
        formatted_address: resolvedFormattedAddress,
        maps_url: resolvedMapsUrl,
        location_source: resolvedLocationSource,
        contact_email: contact_email || req.currentUser!.email,
        contact_phone: effectivePhone,
        phone: effectivePhone,
        social_links: social_links || { instagram: '', facebook: '', twitter: '', whatsapp: '' },
        selected_template_id: selected_template_id || 'obsidian-classic',
        is_default: is_default ?? false,
      });

      realtimeService.broadcast(newStore.id, 'STORE_UPDATED', { store: newStore });

      res.status(201).json({
        message: 'Store created successfully',
        store: newStore,
        formattedStore: toFrontendStore(newStore),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/stores/:id
 * Get single store details
 */
router.get(
  '/:id',
  requireAuth,
  verifyStoreOwnership,
  async (req: AuthenticatedRequest, res) => {
    res.status(200).json({
      store: req.validatedStore,
      formattedStore: req.validatedStore ? toFrontendStore(req.validatedStore) : null,
    });
  }
);

/**
 * PATCH /api/stores/:id
 * Updates store details & branding with automatic geocoding
 */
router.patch(
  '/:id',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: updateStoreSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const locRes = await resolveUpdatedLocation(req.validatedStore, req.body);
      if (locRes.errorResponse) {
        res.status(locRes.errorResponse.status).json(locRes.errorResponse.body);
        return;
      }

      const updated = await dataStore.updateStore(req.params.id, req.body);
      realtimeService.broadcast(updated.id, 'STORE_UPDATED', { store: updated });

      res.status(200).json({
        message: 'Store updated successfully',
        store: updated,
        formattedStore: toFrontendStore(updated),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/stores/:id
 * Replaces / updates full store details with automatic geocoding
 */
router.put(
  '/:id',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: updateStoreSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const locRes = await resolveUpdatedLocation(req.validatedStore, req.body);
      if (locRes.errorResponse) {
        res.status(locRes.errorResponse.status).json(locRes.errorResponse.body);
        return;
      }

      const updated = await dataStore.updateStore(req.params.id, req.body);
      realtimeService.broadcast(updated.id, 'STORE_UPDATED', { store: updated });

      res.status(200).json({
        message: 'Store updated successfully',
        store: updated,
        formattedStore: toFrontendStore(updated),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id
 * Deletes store and safely cascades related data
 */
router.delete(
  '/:id',
  requireAuth,
  verifyStoreOwnership,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const storeId = req.params.id;
      const success = await dataStore.deleteStore(storeId, req.currentUser!.id);

      if (!success) {
        res.status(404).json({ error: 'Not Found', message: 'Store not found' });
        return;
      }

      realtimeService.broadcast(storeId, 'STORE_DELETED', { storeId });

      res.status(200).json({
        success: true,
        message: 'Store deleted successfully',
        deletedStoreId: storeId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/stores/:id/location
 * Updates Google Maps location & coordinates
 */
router.patch(
  '/:id/location',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: updateLocationSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { latitude, longitude, placeId, formattedAddress, mapsUrl, locationSource } = req.body;

      const safeMapsUrl = mapsUrl || locationService.generateMapsUrl(latitude, longitude);

      const updated = await dataStore.updateStore(req.params.id, {
        latitude,
        longitude,
        place_id: placeId || null,
        formatted_address: formattedAddress || null,
        maps_url: safeMapsUrl,
        location_source: locationSource || 'google_maps',
        address_method: 'map',
      });

      realtimeService.broadcast(updated.id, 'STORE_UPDATED', { store: updated });

      res.status(200).json({
        success: true,
        message: 'Store location updated successfully',
        location: {
          latitude: updated.latitude,
          longitude: updated.longitude,
          placeId: updated.place_id,
          formattedAddress: updated.formatted_address,
          mapsUrl: updated.maps_url,
          locationSource: updated.location_source,
        },
        store: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id/products
 * Clears all products from the store
 */
router.delete(
  '/:id/products',
  requireAuth,
  verifyStoreOwnership,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const deletedCount = await dataStore.clearStoreProducts(req.params.id);
      realtimeService.broadcast(req.params.id, 'PRODUCT_DELETED', { cleared: true, count: deletedCount });

      res.status(200).json({
        success: true,
        message: `Successfully cleared ${deletedCount} products from store`,
        clearedCount: deletedCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id/orders
 * Clears all orders from the store
 */
router.delete(
  '/:id/orders',
  requireAuth,
  verifyStoreOwnership,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const deletedCount = await dataStore.clearStoreOrders(req.params.id);
      realtimeService.broadcast(req.params.id, 'ORDER_DELETED', { cleared: true, count: deletedCount });

      res.status(200).json({
        success: true,
        message: `Successfully cleared ${deletedCount} orders from store`,
        clearedCount: deletedCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/stores/:id/upload
 * Uploads store/product media (logo, banner, product) to Supabase Storage
 */
router.post(
  '/:id/upload',
  requireAuth,
  verifyStoreOwnership,
  (req, res, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'File Too Large',
            message: 'File size exceeds the 5MB limit.',
          });
          return;
        }
        res.status(400).json({
          error: 'Upload Error',
          message: err.message || 'File upload error',
        });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const rawCategory = req.body.category;
      if (!rawCategory || typeof rawCategory !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: "Category is required. Allowed categories are: 'logo', 'banner', 'product'.",
        });
        return;
      }

      const category = rawCategory.trim().toLowerCase();
      if (!['logo', 'banner', 'product'].includes(category)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid category '${rawCategory}'. Allowed categories are: 'logo', 'banner', 'product'.`,
        });
        return;
      }

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded' });
        return;
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
      if (!allowedMimes.includes(req.file.mimetype.toLowerCase())) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid file type '${req.file.mimetype}'. Allowed formats: JPEG, PNG, WebP, GIF, SVG.`,
        });
        return;
      }

      const result = await storageService.uploadAsset({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        storeId: req.params.id,
        category: category as 'logo' | 'banner' | 'product',
      });

      // Integrate with Storefront database records
      if (category === 'logo') {
        await dataStore.updateStore(req.params.id, { logo_url: result.url });
      } else if (category === 'banner') {
        await dataStore.updateStore(req.params.id, { banner_url: result.url });
      } else if (category === 'product' && req.body.productId) {
        await dataStore.updateProduct(req.body.productId, { image_url: result.url });
      }

      realtimeService.broadcast(req.params.id, 'STORE_UPDATED', { category, url: result.url });

      res.status(200).json({
        success: true,
        message: 'Asset uploaded successfully',
        category,
        url: result.url,
        path: result.path,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/stores/:id/select-template
 * Binds template to store
 */
router.post(
  '/:id/select-template',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ body: selectTemplateSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { templateId } = req.body;
      const template = templateService.getTemplateById(templateId);

      const updated = await dataStore.updateStore(req.params.id, {
        selected_template_id: template.id,
      });

      realtimeService.broadcast(updated.id, 'STORE_UPDATED', { store: updated });

      res.status(200).json({
        message: 'Template selected successfully',
        store: updated,
        template,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
