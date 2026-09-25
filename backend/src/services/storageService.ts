import { randomUUID } from 'crypto';
import path from 'path';
import { env } from '../config/env.js';
import { getSupabaseClient, isLiveSupabaseConfigured } from './supabase.js';
import { storageBootstrap } from './storageBootstrap.js';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export const ALLOWED_CATEGORIES = ['logo', 'banner', 'product'] as const;
export type StorageCategory = (typeof ALLOWED_CATEGORIES)[number];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadFileOptions {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  storeId: string;
  category: StorageCategory;
}

export interface UploadResult {
  success: boolean;
  category: StorageCategory;
  url: string;
  path: string;
}

export const storageService = {
  /**
   * Verifies and ensures the storage bucket exists.
   */
  async ensureBucket(): Promise<void> {
    await storageBootstrap.ensureBucketExists();
  },

  /**
   * Uploads an asset (logo, banner, product image) to Supabase Storage.
   * Path convention:
   * stores/{storeId}/logo/{filename}
   * stores/{storeId}/banner/{filename}
   * stores/{storeId}/products/{filename}
   */
  async uploadAsset(options: UploadFileOptions): Promise<UploadResult> {
    const { buffer, mimetype, originalName, storeId, category } = options;

    if (!buffer || buffer.length === 0) {
      throw new Error('File buffer is empty or missing.');
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new Error(
        `Invalid category '${category}'. Allowed categories are: 'logo', 'banner', 'product'.`
      );
    }

    const normalizedMime = (mimetype || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      throw new Error(
        `Invalid file type '${mimetype}'. Allowed formats: JPEG, PNG, WebP, GIF, SVG.`
      );
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('File size exceeds the 5MB limit.');
    }

    const subfolder = category === 'product' ? 'products' : category;
    const rawExt = path.extname(originalName) || `.${normalizedMime.split('/')[1]?.replace('svg+xml', 'svg') || 'png'}`;
    const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const sanitizedFilename = `${Date.now()}-${randomUUID().slice(0, 8)}${cleanExt}`;
    const storagePath = `stores/${storeId}/${subfolder}/${sanitizedFilename}`;

    const bucketName = env.SUPABASE_STORAGE_BUCKET || 'store-assets';

    if (isLiveSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();

        const { error } = await client.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: normalizedMime,
            upsert: true,
          });

        if (error) {
          const sanitizedErr = error.message.replace(/eyJ[a-zA-Z0-9_\-]+/gi, '[REDACTED]');
          throw new Error(`Supabase Storage upload failed: ${sanitizedErr}`);
        }

        const { data } = client.storage.from(bucketName).getPublicUrl(storagePath);
        return {
          success: true,
          category,
          url: data.publicUrl,
          path: storagePath,
        };
      } catch (err: any) {
        const sanitized = (err.message || '').replace(/eyJ[a-zA-Z0-9_\-]+/gi, '[REDACTED]');
        throw new Error(sanitized);
      }
    }

    // Local / Dev Fallback: Return simulated CDN URL
    const simulatedUrl = `https://storage.obsidian.store/${bucketName}/${storagePath}`;
    return {
      success: true,
      category,
      url: simulatedUrl,
      path: storagePath,
    };
  },
};
