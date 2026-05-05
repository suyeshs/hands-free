/**
 * Customer Tagging System
 *
 * Manages customer tags with automatic assignment based on rules
 *
 * Features:
 * - Manual tag assignment/removal
 * - Automatic tag assignment based on JSON rules
 * - Tag definitions (name, color, icon, auto-assign rules)
 * - Rule evaluation engine (total_orders, total_spent, last_order_date, etc.)
 */

import type { CustomerRecord } from './customer-manager';

/**
 * Tag definition
 */
export interface TagDefinition {
  id: string;
  tenantId: string;
  name: string;
  color: string; // Hex color code (e.g., '#FFD700')
  icon?: string; // Emoji or icon name
  autoAssignRule?: AutoAssignRule;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Auto-assign rule structure
 */
export interface AutoAssignRule {
  and?: RuleCondition[];
  or?: RuleCondition[];
  // Direct condition (for simple rules)
  total_orders?: ComparisonOperator;
  total_spent?: ComparisonOperator;
  last_order_days_ago?: ComparisonOperator;
  average_order_value?: ComparisonOperator;
}

/**
 * Comparison operator
 */
export interface ComparisonOperator {
  eq?: number; // Equal to
  neq?: number; // Not equal to
  gt?: number; // Greater than
  gte?: number; // Greater than or equal
  lt?: number; // Less than
  lte?: number; // Less than or equal
}

/**
 * Rule condition (used in 'and'/'or' arrays)
 */
export interface RuleCondition {
  total_orders?: ComparisonOperator;
  total_spent?: ComparisonOperator;
  last_order_days_ago?: ComparisonOperator;
  average_order_value?: ComparisonOperator;
}

/**
 * Customer tag (assignment)
 */
export interface CustomerTag {
  id: string;
  customerId: string;
  tagId: string;
  assignedBy: string; // 'auto' or user ID
  assignedAt: string;
}

/**
 * Evaluate a comparison operator against a value
 */
function evaluateComparison(operator: ComparisonOperator, value: number): boolean {
  if (operator.eq !== undefined && value !== operator.eq) return false;
  if (operator.neq !== undefined && value === operator.neq) return false;
  if (operator.gt !== undefined && value <= operator.gt) return false;
  if (operator.gte !== undefined && value < operator.gte) return false;
  if (operator.lt !== undefined && value >= operator.lt) return false;
  if (operator.lte !== undefined && value > operator.lte) return false;

  return true;
}

/**
 * Evaluate a single condition against customer data
 */
function evaluateCondition(
  condition: RuleCondition,
  customer: CustomerRecord,
  lastOrderDaysAgo: number
): boolean {
  if (condition.total_orders) {
    if (!evaluateComparison(condition.total_orders, customer.total_orders)) {
      return false;
    }
  }

  if (condition.total_spent) {
    if (!evaluateComparison(condition.total_spent, customer.total_spent)) {
      return false;
    }
  }

  if (condition.last_order_days_ago) {
    if (!evaluateComparison(condition.last_order_days_ago, lastOrderDaysAgo)) {
      return false;
    }
  }

  if (condition.average_order_value) {
    if (!evaluateComparison(condition.average_order_value, customer.average_order_value)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate days since last order
 */
function calculateLastOrderDaysAgo(lastOrderDate?: string): number {
  if (!lastOrderDate) return Infinity;

  const lastOrder = new Date(lastOrderDate);
  const now = new Date();
  const diffMs = now.getTime() - lastOrder.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Evaluate an auto-assign rule against customer data
 *
 * @param rule - Auto-assign rule
 * @param customer - Customer record
 * @returns true if customer matches the rule
 */
export function evaluateRule(rule: AutoAssignRule, customer: CustomerRecord): boolean {
  const lastOrderDaysAgo = calculateLastOrderDaysAgo(customer.last_order_date);

  // Handle direct conditions (simple rules without and/or)
  if (!rule.and && !rule.or) {
    const directCondition: RuleCondition = {
      total_orders: rule.total_orders,
      total_spent: rule.total_spent,
      last_order_days_ago: rule.last_order_days_ago,
      average_order_value: rule.average_order_value,
    };

    return evaluateCondition(directCondition, customer, lastOrderDaysAgo);
  }

  // Handle AND logic (all conditions must be true)
  if (rule.and) {
    for (const condition of rule.and) {
      if (!evaluateCondition(condition, customer, lastOrderDaysAgo)) {
        return false;
      }
    }
    return true;
  }

  // Handle OR logic (at least one condition must be true)
  if (rule.or) {
    for (const condition of rule.or) {
      if (evaluateCondition(condition, customer, lastOrderDaysAgo)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Auto-assign tags to a customer based on tag definitions
 *
 * @param customerId - Customer ID
 * @param tenantId - Tenant ID
 * @param db - Database connection
 */
export async function autoAssignTags(
  customerId: string,
  tenantId: string,
  db: D1Database
): Promise<string[]> {
  // Fetch customer data
  const customer = await db
    .prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?')
    .bind(customerId, tenantId)
    .first<CustomerRecord>();

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Fetch tag definitions with auto-assign rules
  const tagDefs = await db
    .prepare('SELECT * FROM tag_definitions WHERE tenant_id = ? AND auto_assign_rule IS NOT NULL')
    .bind(tenantId)
    .all<any>();

  const assignedTags: string[] = [];

  // Evaluate each tag rule
  for (const tagDef of tagDefs.results) {
    try {
      const rule: AutoAssignRule = JSON.parse(tagDef.auto_assign_rule);

      if (evaluateRule(rule, customer)) {
        // Check if tag is already assigned
        const existing = await db
          .prepare('SELECT id FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
          .bind(customerId, tagDef.id)
          .first();

        if (!existing) {
          // Assign tag
          await db
            .prepare(
              `INSERT INTO customer_tags (id, customer_id, tag_id, assigned_by, assigned_at)
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              customerId,
              tagDef.id,
              'auto',
              new Date().toISOString()
            )
            .run();

          assignedTags.push(tagDef.id);
        }
      } else {
        // If customer no longer matches rule, remove auto-assigned tag
        await db
          .prepare(
            'DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ? AND assigned_by = ?'
          )
          .bind(customerId, tagDef.id, 'auto')
          .run();
      }
    } catch (error) {
      console.error(`Failed to evaluate rule for tag ${tagDef.name}:`, error);
    }
  }

  return assignedTags;
}

/**
 * Manually assign a tag to a customer
 *
 * @param customerId - Customer ID
 * @param tagId - Tag ID
 * @param assignedBy - User ID who assigned the tag
 * @param db - Database connection
 */
export async function assignTag(
  customerId: string,
  tagId: string,
  assignedBy: string,
  db: D1Database
): Promise<void> {
  // Check if tag already assigned
  const existing = await db
    .prepare('SELECT id FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
    .bind(customerId, tagId)
    .first();

  if (existing) {
    // Update assigned_by if it was auto-assigned
    await db
      .prepare('UPDATE customer_tags SET assigned_by = ? WHERE customer_id = ? AND tag_id = ?')
      .bind(assignedBy, customerId, tagId)
      .run();
  } else {
    // Insert new tag assignment
    await db
      .prepare(
        `INSERT INTO customer_tags (id, customer_id, tag_id, assigned_by, assigned_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), customerId, tagId, assignedBy, new Date().toISOString())
      .run();
  }
}

/**
 * Remove a tag from a customer
 *
 * @param customerId - Customer ID
 * @param tagId - Tag ID
 * @param db - Database connection
 */
export async function removeTag(
  customerId: string,
  tagId: string,
  db: D1Database
): Promise<void> {
  await db
    .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
    .bind(customerId, tagId)
    .run();
}

/**
 * Get all tags for a customer
 *
 * @param customerId - Customer ID
 * @param db - Database connection
 */
export async function getCustomerTags(
  customerId: string,
  db: D1Database
): Promise<TagDefinition[]> {
  const result = await db
    .prepare(
      `SELECT td.* FROM tag_definitions td
       INNER JOIN customer_tags ct ON td.id = ct.tag_id
       WHERE ct.customer_id = ?
       ORDER BY td.name`
    )
    .bind(customerId)
    .all<any>();

  return result.results.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    autoAssignRule: row.auto_assign_rule ? JSON.parse(row.auto_assign_rule) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get all tag definitions for a tenant
 *
 * @param tenantId - Tenant ID
 * @param db - Database connection
 */
export async function getTagDefinitions(
  tenantId: string,
  db: D1Database
): Promise<TagDefinition[]> {
  const result = await db
    .prepare('SELECT * FROM tag_definitions WHERE tenant_id = ? ORDER BY name')
    .bind(tenantId)
    .all<any>();

  return result.results.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    autoAssignRule: row.auto_assign_rule ? JSON.parse(row.auto_assign_rule) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Create a new tag definition
 *
 * @param tenantId - Tenant ID
 * @param tag - Tag definition
 * @param db - Database connection
 */
export async function createTagDefinition(
  tenantId: string,
  tag: {
    name: string;
    color?: string;
    icon?: string;
    autoAssignRule?: AutoAssignRule;
  },
  db: D1Database
): Promise<TagDefinition> {
  const tagId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO tag_definitions (id, tenant_id, name, color, icon, auto_assign_rule, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      tagId,
      tenantId,
      tag.name,
      tag.color || '#3b82f6',
      tag.icon || null,
      tag.autoAssignRule ? JSON.stringify(tag.autoAssignRule) : null,
      now,
      now
    )
    .run();

  return {
    id: tagId,
    tenantId,
    name: tag.name,
    color: tag.color || '#3b82f6',
    icon: tag.icon,
    autoAssignRule: tag.autoAssignRule,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a tag definition
 *
 * @param tagId - Tag ID
 * @param updates - Fields to update
 * @param db - Database connection
 */
export async function updateTagDefinition(
  tagId: string,
  updates: {
    name?: string;
    color?: string;
    icon?: string;
    autoAssignRule?: AutoAssignRule;
  },
  db: D1Database
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name) {
    fields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.color) {
    fields.push('color = ?');
    values.push(updates.color);
  }

  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    values.push(updates.icon);
  }

  if (updates.autoAssignRule !== undefined) {
    fields.push('auto_assign_rule = ?');
    values.push(updates.autoAssignRule ? JSON.stringify(updates.autoAssignRule) : null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(tagId);

  const query = `UPDATE tag_definitions SET ${fields.join(', ')} WHERE id = ?`;

  await db.prepare(query).bind(...values).run();
}

/**
 * Delete a tag definition
 *
 * This will also delete all customer tag assignments (CASCADE)
 *
 * @param tagId - Tag ID
 * @param db - Database connection
 */
export async function deleteTagDefinition(tagId: string, db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM tag_definitions WHERE id = ?').bind(tagId).run();
}

/**
 * Get tag usage statistics for a tenant
 *
 * @param tenantId - Tenant ID
 * @param db - Database connection
 */
export async function getTagStats(
  tenantId: string,
  db: D1Database
): Promise<
  Array<{
    tagId: string;
    tagName: string;
    color: string;
    icon?: string;
    customerCount: number;
  }>
> {
  const result = await db
    .prepare(
      `SELECT
         td.id as tag_id,
         td.name as tag_name,
         td.color,
         td.icon,
         COUNT(ct.customer_id) as customer_count
       FROM tag_definitions td
       LEFT JOIN customer_tags ct ON td.id = ct.tag_id
       WHERE td.tenant_id = ?
       GROUP BY td.id
       ORDER BY customer_count DESC, td.name`
    )
    .bind(tenantId)
    .all<any>();

  return result.results.map((row) => ({
    tagId: row.tag_id,
    tagName: row.tag_name,
    color: row.color,
    icon: row.icon,
    customerCount: row.customer_count,
  }));
}

/**
 * Bulk auto-assign tags for all customers in a tenant
 *
 * Useful for initial setup or after rule changes
 *
 * @param tenantId - Tenant ID
 * @param db - Database connection
 * @returns Number of customers processed
 */
export async function bulkAutoAssignTags(
  tenantId: string,
  db: D1Database
): Promise<number> {
  // Get all customers
  const customers = await db
    .prepare('SELECT id FROM customers WHERE tenant_id = ?')
    .bind(tenantId)
    .all<{ id: string }>();

  let processed = 0;

  for (const customer of customers.results) {
    try {
      await autoAssignTags(customer.id, tenantId, db);
      processed++;
    } catch (error) {
      console.error(`Failed to auto-assign tags for customer ${customer.id}:`, error);
    }
  }

  return processed;
}
