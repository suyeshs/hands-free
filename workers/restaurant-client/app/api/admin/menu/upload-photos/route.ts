/**
 * Photo Upload and Fuzzy Matching API
 * POST /api/admin/menu/upload-photos
 *
 * Matches uploaded Cloudflare photos to menu items in D1 using fuzzy logic
 * Updates the D1 menu_items table with cloudflare_image_id and photo_url
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCloudflareImageUrl } from '../../../../../imageUpload';

declare global {
  interface CloudflareEnv {
    MENU_DB: D1Database;
  }
}

interface PhotoInput {
  cloudflareId: string;
  filename: string;
}

interface MenuItem {
  id: string;
  name: string;
  name_hindi?: string;
  name_local?: string;
  category: string;
  cloudflare_image_id?: string;
  photo_url?: string;
}

interface MatchResult {
  filename: string;
  imageUrl: string;
  imageId: string;
  matched: boolean;
  matchedItem?: {
    id: string;
    name: string;
    category: string;
  };
  error?: string;
  similarityScore?: number;
}

/**
 * POST /api/admin/menu/upload-photos
 * Body: { tenantId: string, photos: [{cloudflareId, filename}] }
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = env.MENU_DB;

    if (!db) {
      return NextResponse.json(
        { error: 'D1 database not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { tenantId, photos } = body as { tenantId: string; photos: PhotoInput[] };

    if (!tenantId || !photos || !Array.isArray(photos)) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, photos' },
        { status: 400 }
      );
    }

    console.log(`[Photo Matching] Processing ${photos.length} photos for tenant: ${tenantId}`);

    // Fetch all menu items for this tenant from D1
    const menuItemsResult = await db
      .prepare(`SELECT id, name, name_hindi, name_local, category, cloudflare_image_id, photo_url FROM menu_items WHERE tenant_id = ?`)
      .bind(tenantId)
      .all<MenuItem>();

    const menuItems = menuItemsResult.results || [];

    if (menuItems.length === 0) {
      console.error(`[Photo Matching] No menu items found for tenant: ${tenantId}`);
      return NextResponse.json(
        {
          error: 'No menu items found for tenant',
          tenantId,
          message: `Tenant '${tenantId}' has no menu items in the database. Please upload menu data first or check your tenant ID.`,
          availableTenants: ['khao-piyo-7766', 'resttest2020']
        },
        { status: 404 }
      );
    }

    console.log(`[Photo Matching] Found ${menuItems.length} menu items for tenant ${tenantId}`);

    // Match photos to menu items
    const matchResults: MatchResult[] = [];
    const matched: MatchResult[] = [];
    const unmatched: MatchResult[] = [];

    for (const photo of photos) {
      const { cloudflareId, filename } = photo;
      const imageUrl = getCloudflareImageUrl(cloudflareId);

      // Clean filename for matching (remove extension, replace separators)
      const cleanedFilename = cleanFilename(filename);

      // Find best match
      const bestMatch = findBestMatch(cleanedFilename, menuItems);

      if (bestMatch && bestMatch.score >= 0.7) {
        // Update D1 with matched image
        try {
          await db
            .prepare(`
              UPDATE menu_items
              SET cloudflare_image_id = ?,
                  photo_url = ?,
                  updated_at = datetime('now')
              WHERE tenant_id = ? AND id = ?
            `)
            .bind(cloudflareId, imageUrl, tenantId, bestMatch.item.id)
            .run();

          const matchResult: MatchResult = {
            filename,
            imageUrl,
            imageId: cloudflareId,
            matched: true,
            matchedItem: {
              id: bestMatch.item.id,
              name: bestMatch.item.name,
              category: bestMatch.item.category,
            },
            similarityScore: bestMatch.score,
          };

          matched.push(matchResult);
          matchResults.push(matchResult);

          console.log(
            `[Photo Matching] ✓ Matched: ${filename} → ${bestMatch.item.name} (${(bestMatch.score * 100).toFixed(1)}%)`
          );
        } catch (updateError) {
          console.error(`[Photo Matching] Failed to update D1 for ${filename}:`, updateError);
          const unmatchedResult: MatchResult = {
            filename,
            imageUrl,
            imageId: cloudflareId,
            matched: false,
            error: 'Database update failed',
          };
          unmatched.push(unmatchedResult);
          matchResults.push(unmatchedResult);
        }
      } else {
        // No match found - check for duplicates before saving
        let isDuplicate = false;
        let duplicateInfo: string | null = null;

        try {
          // Check for duplicate filenames in unassigned_images using fuzzy logic
          const existingUnassigned = await db
            .prepare(`SELECT filename, cloudflare_image_id FROM unassigned_images WHERE tenant_id = ?`)
            .bind(tenantId)
            .all();

          const cleanedNewFilename = cleanFilename(filename);

          for (const existing of existingUnassigned.results || []) {
            const cleanedExisting = cleanFilename(existing.filename as string);
            const similarity = calculateSimilarity(cleanedNewFilename, cleanedExisting);

            // If similarity > 80%, consider it a potential duplicate
            if (similarity > 0.8) {
              isDuplicate = true;
              duplicateInfo = `Similar to existing unassigned image: ${existing.filename} (${(similarity * 100).toFixed(0)}% similar)`;
              console.log(`[Photo Matching] Potential duplicate detected: ${filename} ≈ ${existing.filename} (${(similarity * 100).toFixed(0)}%)`);
              break;
            }
          }

          // Also check against assigned images in menu_items
          if (!isDuplicate) {
            const assignedImages = await db
              .prepare(`SELECT name, photo_url FROM menu_items WHERE tenant_id = ? AND cloudflare_image_id IS NOT NULL`)
              .bind(tenantId)
              .all();

            for (const assigned of assignedImages.results || []) {
              // Extract filename from photo_url
              const existingFilename = (assigned.photo_url as string)?.split('/').pop() || '';
              const cleanedExisting = cleanFilename(existingFilename);
              const similarity = calculateSimilarity(cleanedNewFilename, cleanedExisting);

              if (similarity > 0.8) {
                isDuplicate = true;
                duplicateInfo = `Already assigned to menu item: ${assigned.name}`;
                console.log(`[Photo Matching] Image already assigned: ${filename} to ${assigned.name}`);
                break;
              }
            }
          }
        } catch (dupError) {
          console.error(`[Photo Matching] Duplicate check error:`, dupError);
        }

        // Save to unassigned_images table (even if duplicate, but flag it)
        try {
          const unassignedId = `unassigned_${tenantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const notes = isDuplicate ? `POTENTIAL DUPLICATE: ${duplicateInfo}` : null;

          await db
            .prepare(`
              INSERT OR REPLACE INTO unassigned_images (id, tenant_id, cloudflare_image_id, filename, image_url, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(unassignedId, tenantId, cloudflareId, filename, imageUrl, notes)
            .run();

          console.log(`[Photo Matching] Saved to unassigned_images: ${filename}${isDuplicate ? ' (flagged as duplicate)' : ''}`);
        } catch (saveError) {
          console.error(`[Photo Matching] Failed to save unassigned image ${filename}:`, saveError);
        }

        const unmatchedResult: MatchResult = {
          filename,
          imageUrl,
          imageId: cloudflareId,
          matched: false,
          error: isDuplicate
            ? `⚠️ DUPLICATE: ${duplicateInfo}`
            : bestMatch
            ? `Low similarity (${(bestMatch.score * 100).toFixed(1)}% < 70%)`
            : 'No matching menu item found',
          similarityScore: bestMatch?.score,
        };
        unmatched.push(unmatchedResult);
        matchResults.push(unmatchedResult);

        console.log(
          `[Photo Matching] ✗ Unmatched: ${filename}${bestMatch ? ` (best: ${bestMatch.item.name} at ${(bestMatch.score * 100).toFixed(1)}%)` : ''}`
        );
      }
    }

    console.log(
      `[Photo Matching] Complete: ${matched.length} matched, ${unmatched.length} unmatched`
    );

    // Trigger D1→KV sync if any photos were matched (fire-and-forget)
    if (matched.length > 0) {
      console.log(`[Photo Matching] Triggering D1→KV sync for updated menu...`);
      triggerKVSync(tenantId, request.url);
    }

    return NextResponse.json({
      success: true,
      tenantId,
      results: {
        matched,
        unmatched,
      },
      total: photos.length,
      matched: matched.length,
      unmatched: unmatched.length,
    });
  } catch (error) {
    console.error('[Photo Matching] Error:', error);
    return NextResponse.json(
      {
        error: 'Photo matching failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Clean filename for fuzzy matching
 * Example: "butter-chicken.jpg" → "butter chicken"
 */
function cleanFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace separators with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Find best matching menu item using fuzzy string matching
 */
function findBestMatch(
  cleanedFilename: string,
  menuItems: MenuItem[]
): { item: MenuItem; score: number } | null {
  let bestMatch: { item: MenuItem; score: number } | null = null;

  for (const item of menuItems) {
    // Try matching against name, name_hindi, and name_local
    const namesToMatch = [
      item.name,
      item.name_hindi,
      item.name_local,
    ].filter(Boolean);

    for (const name of namesToMatch) {
      if (!name) continue;

      const cleanedName = name.toLowerCase().trim();
      const score = calculateSimilarity(cleanedFilename, cleanedName);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Calculate string similarity using Jaro-Winkler distance
 * Returns a score between 0 (no match) and 1 (perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Exact match
  if (str1 === str2) return 1.0;

  // Check if one string contains the other (high confidence)
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    return 0.8 + (shorter.length / longer.length) * 0.2;
  }

  // Use Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  // Convert distance to similarity score (0-1)
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits required to change one string into the other)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Trigger D1→KV sync (fire-and-forget)
 * Automatically syncs menu changes to KV for voice ordering and manual workflows
 */
function triggerKVSync(tenantId: string, baseUrl: string): void {
  // Extract base URL for API call
  const url = new URL(baseUrl);
  const syncUrl = `${url.protocol}//${url.host}/api/admin/menu/sync-d1-to-kv`;

  // Fire-and-forget: don't await the sync
  fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  }).catch(err => {
    console.error(`[Photo Matching] KV sync trigger failed for ${tenantId}:`, err.message);
  });

  console.log(`[Photo Matching] Triggered KV sync for ${tenantId}`);
}
