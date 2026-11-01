// Parses the inventory CSV and writes src/inventory-seed.json for the app to
// load on first launch. Run with: node scripts/build-seed.js
const fs = require('fs');
const path = require('path');

const csvPath = path.join(
  __dirname,
  '..',
  'src',
  'Pretty_Petshop_Financial_Master_2026_REPACK_FIXED - Inventory (2).csv'
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

// "Rp60,000" / "Rp800" / "-Rp325" / "Rp700" / "" -> number | null
function parseRp(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/rp|\s|"|,/gi, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/"|,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = rows[0];
const idx = (name) => header.findIndex((h) => h.trim() === name);

const col = {
  sku: idx('SKU'),
  name: idx('Nama Produk'),
  category: idx('Jenis Produk'),
  size: idx('Berat/Ukuran pcs'),
  buyPack: idx('Harga Beli'),
  qty: idx('Kuantitas'),
  totalStock: idx('Total Stock'),
  sisaStock: idx('Sisa Stock'),
  buyPcs: idx('Harga Beli/pcs'),
  sellPcs: idx('Harga Jual/pcs'),
  offlineFinal: idx('Harga Offline Final'),
  brand: idx('Merk'),
};

const usedSkus = new Set();
const products = [];
let skipped = 0;

for (const row of rows.slice(1)) {
  const category = (row[col.category] || '').trim().replace(/\s+/g, ' ');
  if (category === 'Minuman Dingin') {
    skipped++;
    continue;
  }
  const name = (row[col.name] || '').trim();
  if (!name) {
    skipped++;
    continue;
  }
  const price =
    parseRp(row[col.offlineFinal]) ?? parseRp(row[col.sellPcs]) ?? parseRp(row[col.buyPcs]);
  const cost = parseRp(row[col.buyPcs]) ?? parseRp(row[col.buyPack]);
  if (price == null && cost == null) {
    skipped++;
    continue;
  }
  const sisa = intOrNull(row[col.sisaStock]);
  const total = intOrNull(row[col.totalStock]);
  const stock = Math.max(0, sisa ?? total ?? 0);

  let sku = (row[col.sku] || '').trim().toUpperCase();
  if (!sku) sku = 'PRD';
  if (usedSkus.has(sku)) {
    const paren = name.match(/\(([^)]+)\)/);
    const suffix = paren
      ? paren[1].toUpperCase().replace(/[^A-Z0-9]+/g, '')
      : String(usedSkus.size);
    let candidate = `${sku}-${suffix}`;
    let n = 2;
    while (usedSkus.has(candidate)) candidate = `${sku}-${suffix}-${n++}`;
    sku = candidate;
  }
  usedSkus.add(sku);

  products.push({
    sku,
    name,
    category,
    brand: (row[col.brand] || '').trim().replace(/\s+/g, ' ') === 'N/A'
      ? ''
      : (row[col.brand] || '').trim().replace(/\s+/g, ' '),
    price: price ?? 0,
    cost: cost ?? 0,
    stock,
  });
}

const out = path.join(__dirname, '..', 'src', 'inventory-seed.json');
fs.writeFileSync(out, JSON.stringify(products, null, 1));
console.log(`Wrote ${products.length} products to ${out} (skipped ${skipped} empty rows)`);
