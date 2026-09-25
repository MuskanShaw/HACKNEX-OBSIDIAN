import { env } from '../config/env.js';
import { getSupabaseClient, isLiveSupabaseConfigured } from './supabase.js';

export const storageBootstrap = {
  /**
   * Automatically verify and create the required Supabase Storage bucket.
   * Safe to call repeatedly on server boot.
   */
  async ensureBucketExists(): Promise<void> {
    if (!isLiveSupabaseConfigured()) {
      console.log('ℹ️  Storage bootstrap skipped: Live Supabase not configured (mock mode active).');
      return;
    }

    try {
      const client = getSupabaseClient();
      const bucketName = env.SUPABASE_STORAGE_BUCKET || 'store-assets';

      const { data: buckets, error: listError } = await client.storage.listBuckets();
      if (listError) {
        console.warn(`⚠️  Failed to query Supabase storage buckets: ${listError.message}`);
        return;
      }

      const exists = buckets?.some((b) => b.name === bucketName);
      if (!exists) {
        console.log(`📦 Creating missing Supabase storage bucket '${bucketName}'...`);
        const { error: createError } = await client.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
        });

        if (createError) {
          console.warn(`⚠️  Could not create storage bucket '${bucketName}': ${createError.message}`);
        } else {
          console.log(`✅ Supabase storage bucket '${bucketName}' initialized successfully.`);
        }
      } else {
        console.log(`✅ Supabase storage bucket '${bucketName}' verified.`);
      }
    } catch (err: any) {
      console.warn(`⚠️  Error during storage bootstrap: ${err.message}`);
    }
  },
};
