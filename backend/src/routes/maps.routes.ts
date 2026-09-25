import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { locationService, InvalidAddressError, TemporaryGeocodingError } from '../services/locationService.js';

const router = Router();

const geocodeSchema = z.object({
  address: z.string().min(1, 'Address is required'),
});

const placeDetailsSchema = z.object({
  placeId: z.string().min(1, 'placeId is required'),
});

/**
 * POST /api/maps/geocode
 * Resolves address string to coordinates and place details without exposing the Google Maps API key
 */
router.post(
  '/geocode',
  requireAuth,
  validateRequest({ body: geocodeSchema }),
  async (req, res, next) => {
    try {
      const { address } = req.body;
      const result = await locationService.geocode(address);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof InvalidAddressError || err?.isInvalidAddress) {
        res.status(400).json({
          error: 'Invalid Address',
          message: err.message || 'The address could not be recognized by Google Maps. Please provide a valid address.',
        });
        return;
      }
      if (err instanceof TemporaryGeocodingError || err?.isTemporary) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: err.message || 'Geocoding service is temporarily unavailable.',
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/maps/place-details
 * Retrieves verified place details from place ID
 */
router.post(
  '/place-details',
  requireAuth,
  validateRequest({ body: placeDetailsSchema }),
  async (req, res, next) => {
    try {
      const { placeId } = req.body;
      const result = await locationService.getPlaceDetails(placeId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof InvalidAddressError || err?.isInvalidAddress) {
        res.status(400).json({
          error: 'Invalid Place',
          message: err.message || 'The specified place ID could not be found.',
        });
        return;
      }
      if (err instanceof TemporaryGeocodingError || err?.isTemporary) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: err.message || 'Place service is temporarily unavailable.',
        });
        return;
      }
      next(err);
    }
  }
);

export default router;
