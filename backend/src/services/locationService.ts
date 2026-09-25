import { env } from '../config/env.js';

export class InvalidAddressError extends Error {
  statusCode: number = 400;
  isInvalidAddress: boolean = true;
  constructor(message: string = 'The address could not be recognized by Google Maps. Please provide a valid address.') {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

export class TemporaryGeocodingError extends Error {
  statusCode: number = 503;
  isTemporary: boolean = true;
  constructor(message: string = 'Geocoding service is temporarily unavailable.') {
    super(message);
    this.name = 'TemporaryGeocodingError';
  }
}

export interface LocationData {
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  formattedAddress?: string | null;
  mapsUrl?: string | null;
  locationSource?: 'manual' | 'google_maps' | 'google_places' | string;
}

export const locationService = {
  /**
   * Generates a safe and standardized Google Maps query URL.
   */
  generateMapsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  },

  /**
   * Validates coordinate bounds.
   */
  isValidCoordinates(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      !isNaN(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      typeof lng === 'number' &&
      !isNaN(lng) &&
      lng >= -180 &&
      lng <= 180
    );
  },

  /**
   * Generates deterministic simulated geocoding response for offline/dev/test mode.
   */
  getSimulatedGeocode(trimmedAddress: string): {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    placeId: string;
    mapsUrl: string;
  } {
    if (trimmedAddress.toUpperCase().includes('INVALID_ADDRESS')) {
      throw new InvalidAddressError(
        'The address could not be recognized by Google Maps. Please provide a valid address.'
      );
    }
    if (trimmedAddress.toUpperCase().includes('TEMPORARY_GEO_FAIL')) {
      throw new TemporaryGeocodingError('Geocoding service timeout');
    }

    let hash = 0;
    for (let i = 0; i < trimmedAddress.length; i++) {
      hash = (hash << 5) - hash + trimmedAddress.charCodeAt(i);
      hash = hash & hash;
    }
    const latOffset = ((Math.abs(hash) % 1000) / 1000) * 0.1;
    const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000) * 0.1;
    const lat = Math.round((28.6139 + latOffset) * 1000000) / 1000000;
    const lng = Math.round((77.2090 + lngOffset) * 1000000) / 1000000;

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: trimmedAddress,
      placeId: `sim_place_${Math.abs(hash)}`,
      mapsUrl: locationService.generateMapsUrl(lat, lng),
    };
  },

  /**
   * Geocodes an address string using Google Maps Geocoding API.
   * Securely utilizes env.GOOGLE_MAPS_API_KEY without exposing it.
   */
  async geocode(address: string): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress: string;
    placeId: string;
    mapsUrl: string;
  }> {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      throw new InvalidAddressError('Address must not be empty');
    }

    const trimmedAddress = address.trim();
    const apiKey = env.GOOGLE_MAPS_API_KEY;

    // Simulation / local testing fallback when in test mode or API Key is not set
    if (!apiKey || env.NODE_ENV === 'test') {
      return locationService.getSimulatedGeocode(trimmedAddress);
    }

    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      trimmedAddress
    )}&key=${apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = (await res.json()) as any;

      if (data.status === 'ZERO_RESULTS') {
        throw new InvalidAddressError(
          'The address could not be recognized by Google Maps. Please provide a valid address.'
        );
      }

      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'UNKNOWN_ERROR') {
        throw new TemporaryGeocodingError(`Geocoding service temporarily unavailable: ${data.status}`);
      }

      if (data.status === 'REQUEST_DENIED') {
        if (env.NODE_ENV === 'development') {
          console.warn('[GoogleMaps] Request denied for GOOGLE_MAPS_API_KEY. Using dev simulated fallback.');
          return locationService.getSimulatedGeocode(trimmedAddress);
        }
        throw new TemporaryGeocodingError('Geocoding service configuration issue.');
      }

      if (data.status !== 'OK' || !data.results?.[0]) {
        throw new InvalidAddressError(`Address geocoding failed: ${data.status}`);
      }

      const firstResult = data.results[0];
      const lat = firstResult.geometry.location.lat;
      const lng = firstResult.geometry.location.lng;

      return {
        latitude: lat,
        longitude: lng,
        formattedAddress: firstResult.formatted_address,
        placeId: firstResult.place_id,
        mapsUrl: locationService.generateMapsUrl(lat, lng),
      };
    } catch (err: any) {
      if (err instanceof InvalidAddressError || err instanceof TemporaryGeocodingError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new TemporaryGeocodingError('Geocoding request timed out.');
      }
      if (env.NODE_ENV === 'development') {
        console.warn('[GoogleMaps] Network error connecting to Google Maps API. Using dev fallback.');
        return locationService.getSimulatedGeocode(trimmedAddress);
      }
      throw new TemporaryGeocodingError(err.message || 'Network error communicating with Google Maps API.');
    }
  },

  /**
   * Retrieves place details by placeId using Google Places API if key is available.
   */
  async getPlaceDetails(placeId: string): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress: string;
    name?: string;
    placeId: string;
    mapsUrl: string;
  }> {
    if (!placeId || typeof placeId !== 'string' || placeId.trim() === '') {
      throw new InvalidAddressError('placeId must not be empty');
    }

    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || env.NODE_ENV === 'test') {
      return {
        latitude: 28.6139,
        longitude: 77.209,
        formattedAddress: 'Simulated Place Address',
        placeId,
        mapsUrl: locationService.generateMapsUrl(28.6139, 77.209),
      };
    }

    const endpoint = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=name,formatted_address,geometry,place_id&key=${apiKey}`;

    try {
      const res = await fetch(endpoint);
      const data = (await res.json()) as any;

      if (data.status !== 'OK' || !data.result) {
        throw new Error(`Place details lookup failed: ${data.status}`);
      }

      const result = data.result;
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;

      return {
        latitude: lat,
        longitude: lng,
        formattedAddress: result.formatted_address,
        name: result.name,
        placeId: result.place_id,
        mapsUrl: locationService.generateMapsUrl(lat, lng),
      };
    } catch (err: any) {
      throw new TemporaryGeocodingError(err.message || 'Place details lookup failed.');
    }
  },
};
