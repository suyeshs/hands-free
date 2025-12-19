import Database from "@tauri-apps/plugin-sql";
import { MenuItem, MenuCategory, Order, Table } from "../types";

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:pos.db");
  }
  return db;
}

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const database = await initDatabase();
  const result = await database.select<MenuCategory[]>(
    "SELECT * FROM menu_categories WHERE active = 1 ORDER BY sort_order"
  );
  return result;
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE active = 1"
  );
  
  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

export async function getMenuItemsByCategory(
  categoryId: string
): Promise<MenuItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE category_id = $1 AND active = 1",
    [categoryId]
  );
  
  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

export async function getTables(): Promise<Table[]> {
  const database = await initDatabase();
  const result = await database.select<Table[]>("SELECT * FROM tables");
  return result;
}

export async function updateTableStatus(
  tableId: string,
  status: string
): Promise<void> {
  const database = await initDatabase();
  await database.execute("UPDATE tables SET status = $1 WHERE id = $2", [
    status,
    tableId,
  ]);
}

export async function createOrder(
  tableId: string | null,
  serverId: string
): Promise<string> {
  const database = await initDatabase();
  const orderId = `order-${Date.now()}`;
  const now = new Date().toISOString();
  
  await database.execute(
    "INSERT INTO orders (id, table_id, server_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [orderId, tableId, serverId, "draft", now, now]
  );
  
  return orderId;
}

export async function getOrders(status?: string): Promise<Order[]> {
  const database = await initDatabase();
  let query = "SELECT * FROM orders ORDER BY created_at DESC";
  let params: any[] = [];
  
  if (status) {
    query = "SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC";
    params = [status];
  }
  
  const result = await database.select<Order[]>(query, params);
  return result;
}

export async function searchMenuItems(query: string): Promise<MenuItem[]> {
  const database = await initDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE active = 1 AND (LOWER(name) LIKE $1 OR LOWER(description) LIKE $1)",
    [searchTerm]
  );
  
  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

