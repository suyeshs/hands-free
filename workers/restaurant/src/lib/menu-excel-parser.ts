/**
 * Menu Excel Parser
 *
 * Parses Excel files uploaded by restaurants and converts them into menu data
 * Supports customizable column mappings per tenant
 */

/**
 * Excel row data (raw from spreadsheet)
 */
export interface ExcelRow {
  [column: string]: any;
}

/**
 * Parsed menu item from Excel
 */
export interface ParsedMenuItem {
  name: string;
  description?: string;
  category: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  imageUrl?: string;
  tags?: string[];
  calories?: number;
  allergens?: string[];
  preparationTime?: number;
  customFields?: { [key: string]: any };
}

/**
 * Excel schema configuration (stored in menu_metadata table)
 */
export interface ExcelSchema {
  columnMappings: { [excelColumn: string]: string };  // {"Item Name": "name", "Price": "price"}
  requiredColumns: string[];
  categoryColumn?: string;  // Which column contains category name
  defaultValues?: { [field: string]: any };
  customFieldMappings?: { [excelColumn: string]: string };  // {"Portion Size": "portion_size"}
}

/**
 * Parse Excel data using tenant's schema configuration
 */
export function parseMenuExcel(
  rows: ExcelRow[],
  schema: ExcelSchema,
  tenantId: string
): { items: ParsedMenuItem[]; categories: Set<string>; errors: string[] } {
  const items: ParsedMenuItem[] = [];
  const categories = new Set<string>();
  const errors: string[] = [];

  // Validate required columns
  if (rows.length === 0) {
    errors.push('Excel file is empty');
    return { items, categories, errors };
  }

  const firstRow = rows[0];
  const availableColumns = Object.keys(firstRow);

  for (const requiredCol of schema.requiredColumns) {
    if (!availableColumns.includes(requiredCol)) {
      errors.push(`Missing required column: ${requiredCol}`);
    }
  }

  if (errors.length > 0) {
    return { items, categories, errors };
  }

  // Parse each row
  rows.forEach((row, index) => {
    try {
      const item: ParsedMenuItem = {
        name: '',
        category: '',
        price: 0,
      };

      const customFields: { [key: string]: any } = {};

      // Map standard fields
      for (const [excelCol, fieldName] of Object.entries(schema.columnMappings)) {
        const value = row[excelCol];

        if (value === undefined || value === null || value === '') {
          continue;
        }

        switch (fieldName) {
          case 'name':
            item.name = String(value).trim();
            break;
          case 'description':
            item.description = String(value).trim();
            break;
          case 'category':
            item.category = String(value).trim();
            categories.add(item.category);
            break;
          case 'price':
            item.price = parsePrice(value);
            break;
          case 'originalPrice':
            item.originalPrice = parsePrice(value);
            break;
          case 'currency':
            item.currency = String(value).trim().toUpperCase();
            break;
          case 'isVegetarian':
            item.isVegetarian = parseBoolean(value);
            break;
          case 'isVegan':
            item.isVegan = parseBoolean(value);
            break;
          case 'isGlutenFree':
            item.isGlutenFree = parseBoolean(value);
            break;
          case 'isDairyFree':
            item.isDairyFree = parseBoolean(value);
            break;
          case 'spiceLevel':
            item.spiceLevel = parseSpiceLevel(value);
            break;
          case 'imageUrl':
            item.imageUrl = String(value).trim();
            break;
          case 'tags':
            item.tags = parseTags(value);
            break;
          case 'calories':
            item.calories = parseInt(String(value), 10);
            break;
          case 'allergens':
            item.allergens = parseAllergens(value);
            break;
          case 'preparationTime':
            item.preparationTime = parseInt(String(value), 10);
            break;
        }
      }

      // Map custom fields
      if (schema.customFieldMappings) {
        for (const [excelCol, customFieldName] of Object.entries(schema.customFieldMappings)) {
          const value = row[excelCol];
          if (value !== undefined && value !== null && value !== '') {
            customFields[customFieldName] = value;
          }
        }
      }

      if (Object.keys(customFields).length > 0) {
        item.customFields = customFields;
      }

      // Apply default values
      if (schema.defaultValues) {
        for (const [field, defaultValue] of Object.entries(schema.defaultValues)) {
          if ((item as any)[field] === undefined) {
            (item as any)[field] = defaultValue;
          }
        }
      }

      // Validate required fields
      if (!item.name) {
        errors.push(`Row ${index + 2}: Missing item name`);
        return;
      }

      if (!item.category) {
        // Use default category if specified
        if (schema.categoryColumn && row[schema.categoryColumn]) {
          item.category = String(row[schema.categoryColumn]).trim();
          categories.add(item.category);
        } else {
          errors.push(`Row ${index + 2}: Missing category for item "${item.name}"`);
          return;
        }
      }

      if (item.price === 0 || isNaN(item.price)) {
        errors.push(`Row ${index + 2}: Invalid price for item "${item.name}"`);
        return;
      }

      items.push(item);
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return { items, categories, errors };
}

/**
 * Generate default Excel schema for common restaurant formats
 */
export function generateDefaultExcelSchema(format: 'simple' | 'detailed' | 'custom'): ExcelSchema {
  switch (format) {
    case 'simple':
      // Simple format: Item Name, Category, Price, Veg/Non-Veg
      return {
        columnMappings: {
          'Item Name': 'name',
          'Category': 'category',
          'Price': 'price',
          'Description': 'description',
          'Veg/Non-Veg': 'isVegetarian',
        },
        requiredColumns: ['Item Name', 'Category', 'Price'],
        categoryColumn: 'Category',
        defaultValues: {
          currency: 'INR',
        },
      };

    case 'detailed':
      // Detailed format: All common fields
      return {
        columnMappings: {
          'Item Name': 'name',
          'Description': 'description',
          'Category': 'category',
          'Price': 'price',
          'Original Price': 'originalPrice',
          'Vegetarian': 'isVegetarian',
          'Vegan': 'isVegan',
          'Gluten Free': 'isGlutenFree',
          'Spice Level': 'spiceLevel',
          'Image URL': 'imageUrl',
          'Tags': 'tags',
          'Calories': 'calories',
          'Allergens': 'allergens',
          'Prep Time (min)': 'preparationTime',
        },
        requiredColumns: ['Item Name', 'Category', 'Price'],
        categoryColumn: 'Category',
        defaultValues: {
          currency: 'INR',
        },
      };

    case 'custom':
      // Custom format: User defines mappings
      return {
        columnMappings: {},
        requiredColumns: ['Item Name', 'Category', 'Price'],
      };
  }
}

/**
 * Infer Excel schema from column headers
 */
export function inferExcelSchema(headers: string[]): ExcelSchema {
  const schema: ExcelSchema = {
    columnMappings: {},
    requiredColumns: [],
  };

  const headerLower = headers.map(h => h.toLowerCase());

  // Common field mappings
  const mappings: { [pattern: string]: string } = {
    // Name variations
    'item name': 'name',
    'dish name': 'name',
    'name': 'name',
    'item': 'name',
    'dish': 'name',

    // Category variations
    'category': 'category',
    'type': 'category',
    'menu section': 'category',

    // Price variations
    'price': 'price',
    'cost': 'price',
    'rate': 'price',
    'amount': 'price',

    // Description
    'description': 'description',
    'details': 'description',

    // Dietary
    'veg': 'isVegetarian',
    'vegetarian': 'isVegetarian',
    'veg/non-veg': 'isVegetarian',
    'vegan': 'isVegan',
    'gluten free': 'isGlutenFree',

    // Spice
    'spice': 'spiceLevel',
    'spice level': 'spiceLevel',
    'heat': 'spiceLevel',

    // Image
    'image': 'imageUrl',
    'photo': 'imageUrl',
    'image url': 'imageUrl',

    // Other
    'calories': 'calories',
    'prep time': 'preparationTime',
    'preparation time': 'preparationTime',
    'tags': 'tags',
    'allergens': 'allergens',
  };

  headers.forEach((header, index) => {
    const headerNormalized = header.toLowerCase().trim();

    for (const [pattern, fieldName] of Object.entries(mappings)) {
      if (headerNormalized.includes(pattern) || pattern.includes(headerNormalized)) {
        schema.columnMappings[header] = fieldName;

        if (fieldName === 'name' || fieldName === 'category' || fieldName === 'price') {
          schema.requiredColumns.push(header);
        }

        break;
      }
    }

    // If not mapped, treat as custom field
    if (!schema.columnMappings[header]) {
      if (!schema.customFieldMappings) {
        schema.customFieldMappings = {};
      }
      // Convert header to snake_case for custom field name
      const customFieldName = header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      schema.customFieldMappings[header] = customFieldName;
    }
  });

  // Set category column
  const categoryCol = headers.find(h => h.toLowerCase().includes('category'));
  if (categoryCol) {
    schema.categoryColumn = categoryCol;
  }

  schema.defaultValues = { currency: 'INR' };

  return schema;
}

// Helper functions

function parsePrice(value: any): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[₹$€,\s]/g, '');
    return parseFloat(cleaned) || 0;
  }

  return 0;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return ['yes', 'true', '1', 'veg', 'v', 'y'].includes(lower);
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function parseSpiceLevel(value: any): 'mild' | 'medium' | 'hot' | 'extra-hot' | undefined {
  if (!value) return undefined;

  const str = String(value).toLowerCase().trim();

  if (str.includes('mild') || str === '1') return 'mild';
  if (str.includes('medium') || str === '2') return 'medium';
  if (str.includes('hot') && !str.includes('extra')) return 'hot';
  if (str.includes('extra') || str === '4') return 'extra-hot';

  return undefined;
}

function parseTags(value: any): string[] | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    // Split by comma, semicolon, or pipe
    return value.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.map(t => String(t).trim()).filter(Boolean);
  }

  return undefined;
}

function parseAllergens(value: any): string[] | undefined {
  // Same as tags
  return parseTags(value);
}

/**
 * Example usage:
 *
 * const excelData = await parseExcelFile(file);  // Using xlsx library
 * const schema = inferExcelSchema(excelData.headers);
 * const { items, categories, errors } = parseMenuExcel(excelData.rows, schema, tenantId);
 *
 * if (errors.length > 0) {
 *   // Handle errors
 *   return { errors };
 * }
 *
 * // Save to D1 database
 * await saveMenuToD1(tenantId, items, categories, db);
 * // Invalidate KV cache
 * await invalidateMenuCache(tenantId, kv);
 */
