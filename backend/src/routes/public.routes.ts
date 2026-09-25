import { Router } from 'express';
import { dataStore } from '../services/dataStore.js';
import { templateService } from '../services/templateService.js';
import { toFrontendProduct } from '../types/index.js';

const router = Router();

/**
 * GET /api/public/store/:slug
 * Public read-only endpoint for storefront rendering
 */
router.get('/store/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const store = await dataStore.getStoreBySlug(slug);

    if (!store) {
      res.status(404).json({ error: 'Not Found', message: 'Storefront not found' });
      return;
    }

    const products = await dataStore.getProductsByStoreId(store.id, { search: undefined });
    const activeProducts = products.filter((p) => p.status === 'active');
    const template = templateService.getTemplateById(store.selected_template_id);

    // Sanitize store: strictly exclude user_id and internal secrets
    const publicStore = {
      id: store.id,
      name: store.name,
      slug: store.slug,
      businessType: store.business_type,
      customBusinessType: store.custom_business_type || null,
      customOptions: store.custom_options || [],
      description: store.description,
      currency: store.currency,
      address: store.address,
      addressMethod: store.address_method,
      latitude: store.latitude,
      longitude: store.longitude,
      placeId: store.place_id,
      formattedAddress: store.formatted_address,
      mapsUrl: store.maps_url,
      locationSource: store.location_source,
      logoUrl: store.logo_url,
      bannerUrl: store.banner_url,
      contactEmail: store.contact_email,
      contactPhone: store.contact_phone,
      socialLinks: store.social_links,
      selectedTemplateId: store.selected_template_id,
      liveUrl: store.live_url,
    };

    res.status(200).json({
      store: publicStore,
      template,
      products: activeProducts.map(toFrontendProduct),
      rawProducts: activeProducts,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
