import { Database } from "bun:sqlite";
import { Table, Section } from "./types";

const db = new Database("restaurant.sqlite", { create: true });

// Initialize Tables
db.run(`
  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isActive INTEGER DEFAULT 1
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    sectionId TEXT,
    tableNumber TEXT NOT NULL,
    capacity INTEGER,
    qrCodeUrl TEXT,
    status TEXT DEFAULT 'available',
    FOREIGN KEY(sectionId) REFERENCES sections(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tableId TEXT,
    items TEXT,
    total REAL,
    timestamp TEXT,
    status TEXT DEFAULT 'pending'
  )
`);

// Initialization helper
export function initDb() {
    const sectionCount = db.query("SELECT COUNT(*) as count FROM sections").get() as { count: number };
    if (sectionCount.count === 0) {
        console.log("Initializing dummy data in SQLite...");
        db.run("INSERT INTO sections (id, name, isActive) VALUES (?, ?, ?)", ["sec-1", "Main Hall", 1]);
        db.run("INSERT INTO tables (id, sectionId, tableNumber, capacity, status) VALUES (?, ?, ?, ?, ?)",
            ["tab-1", "sec-1", "1", 4, "available"]);
        db.run("INSERT INTO tables (id, sectionId, tableNumber, capacity, status) VALUES (?, ?, ?, ?, ?)",
            ["tab-2", "sec-1", "2", 2, "available"]);
    }
}

export const dbService = {
    // Sections
    getSections: () => {
        return db.query("SELECT * FROM sections").all() as Section[];
    },
    addSection: (id: string, name: string) => {
        db.run("INSERT INTO sections (id, name, isActive) VALUES (?, ?, 1)", [id, name]);
    },

    // Tables
    getTables: () => {
        return db.query("SELECT * FROM tables").all() as Table[];
    },
    addTable: (table: Table) => {
        db.run("INSERT INTO tables (id, sectionId, tableNumber, capacity, qrCodeUrl, status) VALUES (?, ?, ?, ?, ?, ?)",
            [table.id, table.sectionId, table.tableNumber, table.capacity, table.qrCodeUrl, table.status]);
    },

    // Orders
    addOrder: (order: any) => {
        db.run("INSERT INTO orders (id, tableId, items, total, timestamp, status) VALUES (?, ?, ?, ?, ?, ?)",
            [`ord-${Date.now()}`, order.tableId, JSON.stringify(order.items), order.total, order.timestamp, 'pending']);
    },
    getOrders: () => {
        return db.query("SELECT * FROM orders").all();
    }
};
