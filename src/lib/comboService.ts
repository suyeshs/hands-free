/**
 * Combo Service
 * Database operations for managing combo meal configurations
 */

import Database from '@tauri-apps/plugin-sql';
import { ComboGroup, ComboGroupItem } from '../types';

/**
 * Save or update combo configuration for a menu item
 */
export async function saveComboConfiguration(
  menuItemId: string,
  isCombo: boolean,
  comboGroups: ComboGroup[]
): Promise<void> {
  const db = await Database.load('sqlite:pos.db');

  try {
    // Update is_combo flag on menu item
    await db.execute(
      'UPDATE menu_items SET is_combo = ? WHERE id = ?',
      [isCombo ? 1 : 0, menuItemId]
    );

    // Delete existing combo groups and items for this menu item
    await deleteComboGroups(menuItemId);

    // If not a combo, we're done
    if (!isCombo || comboGroups.length === 0) {
      console.log('[ComboService] Cleared combo configuration for:', menuItemId);
      return;
    }

    // Insert new combo groups and items
    for (let groupIndex = 0; groupIndex < comboGroups.length; groupIndex++) {
      const group = comboGroups[groupIndex];
      const groupId = group.id || `combo-group-${Date.now()}-${groupIndex}`;

      await db.execute(
        `INSERT INTO menu_combo_groups (id, menu_item_id, name, required, min_selections, max_selections, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          groupId,
          menuItemId,
          group.name,
          group.required ? 1 : 0,
          group.min_selections,
          group.max_selections,
          groupIndex,
        ]
      );

      // Insert items for this group
      for (let itemIndex = 0; itemIndex < group.items.length; itemIndex++) {
        const item = group.items[itemIndex];
        const itemId = item.id || `combo-item-${Date.now()}-${groupIndex}-${itemIndex}`;

        await db.execute(
          `INSERT INTO menu_combo_group_items (id, combo_group_id, name, description, image, price_adjustment, available, tags, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            groupId,
            item.name,
            item.description || null,
            item.image || null,
            item.price_adjustment,
            item.available ? 1 : 0,
            item.tags ? JSON.stringify(item.tags) : null,
            itemIndex,
          ]
        );
      }
    }

    console.log('[ComboService] Saved combo configuration for:', menuItemId, 'with', comboGroups.length, 'groups');
  } catch (error) {
    console.error('[ComboService] Failed to save combo configuration:', error);
    throw error;
  }
}

/**
 * Delete all combo groups for a menu item
 */
export async function deleteComboGroups(menuItemId: string): Promise<void> {
  const db = await Database.load('sqlite:pos.db');

  try {
    // Get existing group IDs for this menu item
    const groups = await db.select<Array<{ id: string }>>(
      'SELECT id FROM menu_combo_groups WHERE menu_item_id = ?',
      [menuItemId]
    );

    // Delete items for each group
    for (const group of groups) {
      await db.execute(
        'DELETE FROM menu_combo_group_items WHERE combo_group_id = ?',
        [group.id]
      );
    }

    // Delete the groups
    await db.execute(
      'DELETE FROM menu_combo_groups WHERE menu_item_id = ?',
      [menuItemId]
    );

    console.log('[ComboService] Deleted', groups.length, 'combo groups for:', menuItemId);
  } catch (error) {
    console.error('[ComboService] Failed to delete combo groups:', error);
    throw error;
  }
}

/**
 * Get combo groups for a menu item
 */
export async function getComboGroups(menuItemId: string): Promise<ComboGroup[]> {
  const db = await Database.load('sqlite:pos.db');

  try {
    // Load combo groups
    const groupRows = await db.select<Array<{
      id: string;
      name: string;
      required: number;
      min_selections: number;
      max_selections: number;
      sort_order: number;
    }>>(
      'SELECT * FROM menu_combo_groups WHERE menu_item_id = ? ORDER BY sort_order',
      [menuItemId]
    );

    // Load all items for these groups
    const groupIds = groupRows.map((g) => g.id);
    if (groupIds.length === 0) {
      return [];
    }

    const placeholders = groupIds.map(() => '?').join(',');
    const itemRows = await db.select<Array<{
      id: string;
      combo_group_id: string;
      name: string;
      description: string | null;
      image: string | null;
      price_adjustment: number;
      available: number;
      tags: string | null;
      sort_order: number;
    }>>(
      `SELECT * FROM menu_combo_group_items WHERE combo_group_id IN (${placeholders}) ORDER BY sort_order`,
      groupIds
    );

    // Build combo groups with items
    const comboGroups: ComboGroup[] = groupRows.map((groupRow) => {
      const groupItems: ComboGroupItem[] = itemRows
        .filter((itemRow) => itemRow.combo_group_id === groupRow.id)
        .map((itemRow) => ({
          id: itemRow.id,
          name: itemRow.name,
          description: itemRow.description || undefined,
          image: itemRow.image || undefined,
          price_adjustment: itemRow.price_adjustment,
          available: itemRow.available === 1,
          tags: itemRow.tags ? JSON.parse(itemRow.tags) : undefined,
        }));

      return {
        id: groupRow.id,
        name: groupRow.name,
        required: groupRow.required === 1,
        min_selections: groupRow.min_selections,
        max_selections: groupRow.max_selections,
        items: groupItems,
      };
    });

    return comboGroups;
  } catch (error) {
    console.error('[ComboService] Failed to get combo groups:', error);
    throw error;
  }
}

/**
 * Check if a menu item is a combo
 */
export async function isMenuItemCombo(menuItemId: string): Promise<boolean> {
  const db = await Database.load('sqlite:pos.db');

  try {
    const result = await db.select<Array<{ is_combo: number | null }>>(
      'SELECT is_combo FROM menu_items WHERE id = ?',
      [menuItemId]
    );

    return result.length > 0 && result[0].is_combo === 1;
  } catch (error) {
    console.error('[ComboService] Failed to check if menu item is combo:', error);
    return false;
  }
}
