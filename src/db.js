import * as SQLite from 'expo-sqlite';

let db;

export async function initDb() {
  db = await SQLite.openDatabaseAsync('petshop.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      profit REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      profit REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );
  `);
  // Migrations for databases created before these columns existed. Each runs
  // in its own try/catch so the "column already exists" error is ignored.
  const migrations = [
    `ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`,
    `ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''`,
  ];
  for (const stmt of migrations) {
    try {
      await db.execAsync(stmt);
    } catch {
      // Column already present.
    }
  }
}

// Seeds the bundled inventory on first launch; skips if products already exist.
export async function seedIfEmpty() {
  const { n } = await db.getFirstAsync('SELECT COUNT(*) AS n FROM products');
  if (n > 0) return;
  let seed = [];
  try {
    seed = require('./inventory-seed.json');
  } catch {
    // Seed file not shipped (e.g. public repo clone) — start empty.
  }
  await db.withTransactionAsync(async () => {
    for (const p of seed) {
      await db.runAsync(
        'INSERT OR IGNORE INTO products (sku, name, category, brand, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.sku, p.name, p.category, p.brand || '', p.price, p.cost, p.stock]
      );
    }
  });
}

const all = (sql, params = []) => db.getAllAsync(sql, params);

export const getProducts = () => all('SELECT * FROM products ORDER BY name');

// Cashier lookup: a scanned code may be a packaging barcode or one of our SKUs.
export const getProductByCode = async (code) =>
  (await all('SELECT * FROM products WHERE barcode = ? OR sku = ? LIMIT 1', [code, code]))[0] ||
  null;

export const getProductByBarcode = async (barcode, excludeId) =>
  (
    await all('SELECT id, name FROM products WHERE barcode = ? AND id != ? LIMIT 1', [
      barcode,
      excludeId || -1,
    ])
  )[0] || null;

export function addProduct({ sku, name, category = '', brand = '', barcode = '', price, cost, stock }) {
  return db.runAsync(
    'INSERT INTO products (sku, name, category, brand, barcode, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [sku, name, category, brand, barcode, price, cost, stock]
  );
}

export function updateProduct(id, { sku, name, category = '', brand = '', barcode = '', price, cost, stock }) {
  return db.runAsync(
    'UPDATE products SET sku = ?, name = ?, category = ?, brand = ?, barcode = ?, price = ?, cost = ?, stock = ? WHERE id = ?',
    [sku, name, category, brand, barcode, price, cost, stock, id]
  );
}

export const deleteProduct = (id) => db.runAsync('DELETE FROM products WHERE id = ?', [id]);

export async function checkout(cart, paymentMethod = 'cash') {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const profit = cart.reduce((s, it) => s + (it.price - it.cost) * it.qty, 0);
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO sales (total, profit, payment_method) VALUES (?, ?, ?)',
      [total, profit, paymentMethod]
    );
    const saleId = res.lastInsertRowId;
    for (const it of cart) {
      const subtotal = it.price * it.qty;
      const lineProfit = (it.price - it.cost) * it.qty;
      await db.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, sku, name, price, cost, qty, subtotal, profit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, it.id, it.sku, it.name, it.price, it.cost, it.qty, subtotal, lineProfit]
      );
      if (it.id) {
        await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.id]);
      }
    }
  });
  return { total, profit };
}

export const getSales = () => all('SELECT * FROM sales ORDER BY id DESC');
export const getSaleItems = (saleId) =>
  all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [saleId]);

// Product-type codes per the shop's SKU spec: AABBCC00X
// (AA = brand, BB = jenis produk, CC = rasa/varian, 00X = sequence).
export const CATEGORY_CODES = {
  'Dry Food': 'D',
  'Wet Food Kaleng': 'WC',
  'Wet Food Sachet': 'WS',
  'Snack Kucing Tube': 'ST',
  'Snack kucing': 'SK',
  'Snack': 'S',
  'Makanan Ikan': 'MI',
  'Makanan Kura Kura': 'MK',
  'Makanan Burung': 'MB',
  'Makanan Hamster': 'MH',
  'Aksesoris Hamster': 'AH',
  'Aksesoris Kucing': 'A',
  'Aksesoris Ikan': 'AI',
  'Vitamin Kucing': 'V',
  'Obat Kucing': 'O',
  'Grooming Essential': 'G',
  'Pasir Kucing & Litters': 'L',
};

export const CATEGORIES = Object.keys(CATEGORY_CODES);

const firstLetters = (s, max) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, max);

// Builds the next SKU in the AABBCC00X format. Sequence numbers count up per
// brand + product-type group, matching how the existing inventory is coded
// (e.g. CCDAT001, CCDAS002, CCDK003 all share the CC + D group).
export async function generateSku({ brand, category, variant, name }) {
  const aa = firstLetters(brand, 2) || firstLetters(name, 2) || 'GN';
  const bb =
    CATEGORY_CODES[category] ||
    (category ? firstLetters(category.replace(/[^A-Za-z ]/g, ' '), 3) : '');
  const cc = firstLetters(variant || '', 2);
  const group = `${aa}${bb}`;

  const existing = await all('SELECT sku FROM products');
  let max = 0;
  const re = new RegExp(`^${group}[A-Z]{0,2}(\\d{3})`);
  for (const p of existing) {
    const m = p.sku.toUpperCase().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${group}${cc}${String(max + 1).padStart(3, '0')}`;
}
