# PetShop Cashier

Cross-platform cashier app (iOS + Android) built with React Native + Expo.

## App vs WebView — decision

**Native app (this project), not a WebView wrapper.** Reasons:

| Requirement | WebView (website in a shell) | Native app |
|---|---|---|
| Phone camera barcode/QR scanning | Not supported in browser WebViews; requires hacks | ✅ `expo-camera` with real-time scanning |
| Bluetooth scanner (HID keyboard mode) | Keypresses don't reach the web page reliably | ✅ Scanner types into focused inputs natively |
| Bluetooth Low Energy (serial scanners) | Requires native bridges anyway | ✅ `react-native-ble-plx` available |
| Works offline | Needs caching layers | ✅ Local SQLite, fully offline |
| App Store distribution | Still needs a shell app anyway | ✅ Expo builds directly |

A WebView only wraps a website — it doesn't add hardware access. Since camera scanning and Bluetooth are core requirements, native is the correct choice.

## Features

- **Pre-loaded inventory** — your full CSV inventory (255 products) ships with the app and loads into the on-device database on first launch. Duplicate SKUs in the sheet were made unique by appending the package size (e.g. `LCD001-500G`). To re-import after changing the CSV: `node scripts/build-seed.js`, then reload the app.
- **Auto-generated SKUs** — new products follow the shop's `AABBCC00X` SKU format: **AA** = brand initials (e.g. Life Cat → `LC`), **BB** = product-type code, **CC** = rasa/varian initials (e.g. Adult Tuna → `AT`, optional), **00X** = sequence number. The sequence counts up per brand + product-type group, matching the existing inventory (e.g. `CCDAT001`, `CCDAS002`, `CCDK003`). Leave the SKU field blank when adding a product — a live preview shows the code it will get.

  | Category (Jenis Produk) | Code | | Category | Code |
  |---|---|---|---|---|
  | Dry Food | `D` | | Aksesoris Kucing | `A` |
  | Wet Food Kaleng | `WC` | | Aksesoris Ikan | `AI` |
  | Wet Food Sachet | `WS` | | Vitamin Kucing | `V` |
  | Snack Kucing Tube | `ST` | | Obat Kucing | `O` |
  | Snack kucing / Snack | `SK` / `S` | | Grooming Essential | `G` |
  | Makanan Ikan | `MI` | | Pasir Kucing & Litters | `L` |
  | Makanan Kura Kura | `MK` | | Minuman Dingin | `MID` |
  | Makanan Burung | `MB` | | Makanan Hamster | `MH` |
  | Aksesoris Hamster | `AH` | | | |

  Example: brand `Cat Choize`, category *Dry Food*, rasa *Adult Tuna* → `CCDAT005` (next in the `CCD` group).
- **Cashier tab** — point the camera at a product QR/barcode; the product is added to the cart with live **income and profit per line**. Choose a payment method — **Cash** (enter amount received, change is calculated), **QRIS**, or **Bank Transfer** — then charge to complete the sale and decrement stock.
- **Products tab** — searchable list (name or SKU); add/edit products: SKU, name, category, selling price, purchase cost, stock. Long-press to delete. Margin shown per product.
- **QR per SKU tab** — searchable; select a product to show its QR code (encodes the SKU) for printing and sticking on products/shelves.
- **Sales History tab** — every sale with payment method, per-product income and profit, plus grand totals.

## Run it

```bash
npm install
npx expo start
```

Then press `i` for iOS simulator or `a` for Android emulator, or scan the QR shown in the terminal with the **Expo Go** app on your phone (fastest way to try it on a real device).

For a store-ready installable app (needed for Bluetooth pairing flows):

```bash
npx eas build --platform ios    # needs Apple Developer account
npx eas build --platform android
```

## Bluetooth barcode scanner

Most handheld Bluetooth barcode scanners (e.g. Zebra, Netum, Tera) work in **HID keyboard mode**: the phone pairs with the scanner over Bluetooth and the scanner "types" the code wherever the keyboard is focused, followed by Enter. **No code changes are needed** — the scanner effectively replaces the camera.

Two ways to use one with this app:

1. **Camera + scanner hybrid (recommended, zero extra code)**: use the camera for QR codes you print, and keep a TextInput focused somewhere for the Bluetooth scanner. Most scanners can also be programmed to output QR contents the same way.
2. **Dedicated scan field**: add a hidden/focused `TextInput` on the Cashier screen that parses scanned codes — ask if you want this wired in.

If your scanner uses **serial Bluetooth (BLE)** instead of HID mode, add `react-native-ble-plx` and I can integrate a BLE scan listener.

## Data & currency

All data is stored locally on the device in SQLite (`expo-sqlite`) — no server needed, works fully offline. Display is formatted in Indonesian Rupiah (`toLocaleString('id-ID')`); change the `money` helper in each screen if you prefer a different currency symbol.
