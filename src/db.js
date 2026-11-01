import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('petshop.db');

export function initDb() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          cost REAL NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total REAL NOT NULL,
          profit REAL NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sale_items (
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
        );`
      );
      // Migration for databases created before payment methods existed.
      tx.executeSql(
        `ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`,
        [],
        undefined,
        () => true
      );
      // Migration for databases created before the category column existed.
      tx.executeSql(
        `ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''`,
        [],
        undefined,
        () => true
      );
      // Migration for databases created before the brand column existed.
      tx.executeSql(
        `ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT ''`,
        [],
        undefined,
        () => true
      );
    }, reject, resolve);
  });
}

// Seeds the bundled inventory on first launch; skips if products already exist.
export function seedIfEmpty() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('SELECT COUNT(*) AS n FROM products', [], (_, rs) => {
        if (rs.rows.item(0).n > 0) return;
        let seed = [];
        try {
          seed = require('./inventory-seed.json');
        } catch {
          // Seed file not shipped (e.g. public repo clone) — start empty.
        }
        seed.forEach((p) => {
          tx.executeSql(
            'INSERT OR IGNORE INTO products (sku, name, category, brand, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [p.sku, p.name, p.category, p.brand || '', p.price, p.cost, p.stock]
          );
        });
      });
    }, reject, resolve);
  });
}

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
  'Minuman Dingin': 'MID',
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

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(sql, params, (_, rs) => resolve(rs), (_, err) => {
        reject(err);
        return true;
      });
    });
  });

const all = async (sql, params = []) => {
  const rs = await run(sql, params);
  const rows = [];
  for (let i = 0; i < rs.rows.length; i++) rows.push(rs.rows.item(i));
  return rows;
};

export const getProducts = () => all('SELECT * FROM products ORDER BY name');
export const getProductBySku = (sku) =>
  all('SELECT * FROM products WHERE sku = ? LIMIT 1', [sku]).then((r) => r[0] || null);

export function addProduct({ sku, name, category = '', brand = '', price, cost, stock }) {
  return run(
    'INSERT INTO products (sku, name, category, brand, price, cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sku, name, category, brand, price, cost, stock]
  );
}

export function updateProduct(id, { sku, name, category = '', brand = '', price, cost, stock }) {
  return run(
    'UPDATE products SET sku = ?, name = ?, category = ?, brand = ?, price = ?, cost = ?, stock = ? WHERE id = ?',
    [sku, name, category, brand, price, cost, stock, id]
  );
}

export const deleteProduct = (id) => run('DELETE FROM products WHERE id = ?', [id]);

export function checkout(cart, paymentMethod = 'cash') {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const profit = cart.reduce((s, it) => s + (it.price - it.cost) * it.qty, 0);
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT INTO sales (total, profit, payment_method) VALUES (?, ?, ?)',
        [total, profit, paymentMethod],
        [total, profit],
        (_, rs) => {
          const saleId = rs.insertId;
          cart.forEach((it) => {
            const subtotal = it.price * it.qty;
            const lineProfit = (it.price - it.cost) * it.qty;
            tx.executeSql(
              `INSERT INTO sale_items (sale_id, product_id, sku, name, price, cost, qty, subtotal, profit)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [saleId, it.id, it.sku, it.name, it.price, it.cost, it.qty, subtotal, lineProfit]
            );
            if (it.id) {
              tx.executeSql('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.id]);
            }
          });
        },
        (_, err) => {
          reject(err);
          return true;
        }
      );
    }, reject, () => resolve({ total, profit }));
  });
}

export const getSales = () => all('SELECT * FROM sales ORDER BY id DESC');
export const getSaleItems = (saleId) =>
  all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [saleId]);
