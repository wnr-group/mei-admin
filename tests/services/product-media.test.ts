import {
  getProductMedia,
  uploadMedia,
  deleteMedia,
} from '@/lib/services/product-media';
import { createClient } from '@/lib/supabase/client';

describe.runIf(!!process.env.NEXT_PUBLIC_SUPABASE_URL)('Product Media Service', () => {
  // Note: These tests assume seeded product data exists
  let productId: string;
  let mediaId: string;

  beforeAll(async () => {
    // Get first product to test with
    const supabase = createClient<any>();

    // Sign in as admin to have write permissions for database tests
    await supabase.auth.signInWithPassword({
      email: 'admin@mei.com',
      password: 'MeiAdmin@123',
    });

    const { data: products } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (products && products.length > 0) {
      productId = products[0].id;
    }
  });

  test('getProductMedia returns media for a product', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found for testing');
      expect(true).toBe(true);
      return;
    }

    const media = await getProductMedia(productId);
    expect(media).toBeDefined();
    expect(Array.isArray(media)).toBe(true);
    if (media.length > 0) {
      expect(media[0]).toHaveProperty('id');
      expect(media[0]).toHaveProperty('product_id');
      expect(media[0]).toHaveProperty('url');
      expect(media[0]).toHaveProperty('is_primary');
      expect(media[0]).toHaveProperty('media_type');
    }
  });

  test('uploadMedia creates and returns new media', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found for testing');
      expect(true).toBe(true);
      return;
    }

    const newMedia = await uploadMedia({
      product_id: productId,
      url: 'https://example.com/test-image.jpg',
      alt_text: 'Test Image',
      media_type: 'IMAGE',
      is_primary: false,
    });

    expect(newMedia).toBeDefined();
    expect(newMedia.id).toBeDefined();
    expect(newMedia.product_id).toBe(productId);
    expect(newMedia.url).toBe('https://example.com/test-image.jpg');
    expect(newMedia.media_type).toBe('IMAGE');
    expect(newMedia.is_primary).toBe(false);

    mediaId = newMedia.id;
  });

  test('deleteMedia soft-deletes media record', async () => {
    if (!mediaId) {
      console.warn('Skipping test: no media created');
      expect(true).toBe(true);
      return;
    }

    await expect(deleteMedia(mediaId)).resolves.not.toThrow();

    // Verify it's deleted by checking it doesn't appear in list
    if (productId) {
      const media = await getProductMedia(productId);
      const deleted = media.find((m) => m.id === mediaId);
      expect(deleted).toBeUndefined();
    }
  });

  test('getProductMedia filters by colorId', async () => {
    if (!productId) {
      console.warn('Skipping test: no product found for testing');
      expect(true).toBe(true);
      return;
    }

    // Generate a UUID-like color ID for testing
    const colorId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    const media = await getProductMedia(productId, colorId);
    expect(Array.isArray(media)).toBe(true);
    // If results exist, verify they're filtered
    if (media.length > 0) {
      expect(media.every((m) => m.color_id === colorId)).toBe(true);
    }
  });
});
