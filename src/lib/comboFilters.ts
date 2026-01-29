import { invoke } from '@tauri-apps/api/core';

export interface ComboFilterKeyword {
  id: string;
  filter_key: string;
  display_name: string;
  emoji?: string;
  keywords: string[];
  color_class?: string;
  sort_order: number;
  active: boolean;
}

/**
 * Fetch combo filter keywords from the database
 */
export async function getComboFilterKeywords(): Promise<ComboFilterKeyword[]> {
  try {
    const keywords = await invoke<ComboFilterKeyword[]>('get_combo_filter_keywords');
    return keywords;
  } catch (error) {
    console.error('[ComboFilters] Failed to fetch filter keywords:', error);
    throw error;
  }
}

/**
 * Save or update a combo filter keyword
 */
export async function saveComboFilterKeyword(keyword: ComboFilterKeyword): Promise<void> {
  try {
    await invoke('save_combo_filter_keyword', { keyword });
  } catch (error) {
    console.error('[ComboFilters] Failed to save filter keyword:', error);
    throw error;
  }
}

/**
 * Delete a combo filter keyword
 */
export async function deleteComboFilterKeyword(keywordId: string): Promise<void> {
  try {
    await invoke('delete_combo_filter_keyword', { keywordId });
  } catch (error) {
    console.error('[ComboFilters] Failed to delete filter keyword:', error);
    throw error;
  }
}

/**
 * Convert filter keywords to the format expected by components
 */
export function convertToFilterMap(keywords: ComboFilterKeyword[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const keyword of keywords) {
    map[keyword.filter_key] = keyword.keywords;
  }
  return map;
}
