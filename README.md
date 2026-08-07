# Haldia LPG Bottling Plant — Inventory Control

A lightweight, no-backend inventory management web app built for an LPG bottling plant. Track filled/empty cylinders, bulk LPG stock, valves, regulators, seals, PPE and spares — with quantity amendments, low-stock alerts, filtering, and a full audit log of every stock movement.

**Live demo:** just open `index.html` in a browser, or host it for free on GitHub Pages (steps below).

## Features

- **Add Item** — record name, SKU/batch no., category, unit, opening quantity, reorder level, price, supplier and godown/location.
- **Amend Quantity** — Stock In, Stock Out, or Set Exact Quantity (for physical stock corrections), each with a reason, logged automatically.
- **Edit Item Details** — update everything except quantity (use Amend Quantity for that, so every quantity change is auditable).
- **Delete Item** — with a confirmation step.
- **Filters & Search** — search by name/SKU/supplier, filter by category or stock status (Out / Low / Normal), and sort.
- **Dashboard** — total SKUs, low/out-of-stock counts, total inventory value, and a gauge view of stock levels per category.
- **Stock Movement Log** — full audit trail of every stock in/out/adjustment.
- **CSV Export / Import** — back up your data or bulk-load items.
- **Sample data loader** — seeds realistic LPG plant items so you can try the app immediately.

## How data is stored

By default (before you configure anything) this app stores data in your browser's `localStorage` only — private to that one device/browser.

**To make the SAME inventory accessible to anyone with your GitHub Pages URL, on any device, for free**, connect it to a free Firebase Firestore database — no server code required. See "Shared cloud storage" below.

Either way, **export to CSV regularly** (button in the sidebar) to keep a backup.

## Shared cloud storage (Firebase — free)

This is what makes the site a real multi-device tool: everyone who opens your URL sees and edits one shared, live-synced inventory. It uses Firebase's free "Spark" tier, which is enough for a single plant's inventory (well within the free quota of ~50k reads / 20k writes per day).

### 1. Create a free Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with any Google account.
2. Click **Add project**, name it (e.g. `haldia-lpg-inventory`), and finish the wizard (you can disable Google Analytics — not needed).

### 2. Register a web app and get your config
1. On the project's Overview page, click the **`</>`** (Web) icon to add a web app.
2. Give it a nickname and click **Register app**. Firebase Hosting is not needed — skip that step.
3. Firebase shows a `firebaseConfig` object with your keys.

### 3. Enable Firestore
1. In the left sidebar: **Build → Firestore Database → Create database**.
2. Choose a location close to your plant (e.g. `asia-south1` for India).
3. Start in **test mode** for now (open access) — you'll lock this down in step 5.

### 4. Add your config to the app
1. Open `firebase-config.js` in this repo.
2. Replace the placeholder values with the real ones from step 2.
3. Commit and push — GitHub Pages will redeploy automatically within a minute or two.

That's it — reload your site's URL and the little status dot next to the clock (top right) will turn **blue → green**, meaning it's now synced to the shared cloud database. Anyone who opens the same URL will see the same live inventory.

### 5. Lock down Firestore security rules (important)

Test mode leaves your database **open to the internet indefinitely on some setups, or expires after 30 days** — either way, tighten it. In Firebase Console → Firestore Database → **Rules**, replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /haldia_lpg_inventory/plant_data {
      allow read, write: if true;
    }
  }
}
```

This keeps the app exactly as requested — **anyone with your site's URL can read and write the inventory**, with no login required, which matches "anyone with that URL can access it on any device." It also scopes access to only this one document, rather than leaving your whole Firestore project open.

If later you want to restrict *editing* to your plant staff only (e.g. so the public can't tamper with stock counts), the simplest upgrade is Firebase Anonymous Auth or a simple PIN-gate — ask if you'd like that added.

### How syncing works under the hood

- All inventory items + the full stock movement log are stored as one JSON document in Firestore (`haldia_lpg_inventory/plant_data`).
- The app subscribes to that document in real time (`onSnapshot`), so a change made on one device (e.g. warehouse tablet) appears on every other open device (e.g. office computer) within a second or two, no refresh needed.
- A local `localStorage` copy is still kept as a fast-loading cache and offline fallback — if the connection drops, the app keeps working from that cache and re-syncs once back online.
- If `firebase-config.js` is left with placeholder values, the app silently falls back to local-only mode (the status dot shows grey — "Local only").

## Running locally

No build tools or dependencies required.

```bash
git clone https://github.com/<your-username>/haldia-lpg-inventory.git
cd haldia-lpg-inventory
# then just open index.html in your browser, e.g.:
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or serve it locally (recommended so the browser treats it as a proper site):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Hosting for free on GitHub Pages

1. Create a new GitHub repository (e.g. `haldia-lpg-inventory`) and push these three files (`index.html`, `style.css`, `app.js`) plus this `README.md`.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`.
4. Choose the `main` branch and `/ (root)` folder, then **Save**.
5. Wait a minute, then GitHub will give you a live URL like:
   `https://<your-username>.github.io/haldia-lpg-inventory/`

That URL is now a real, working inventory site you (or plant staff) can use from any device with a browser — bookmark it on the plant office computer or tablet.

## File structure

```
haldia-lpg-inventory/
├── index.html          # page structure (dashboard, inventory table, forms, modals)
├── style.css           # industrial-themed styling, fully responsive
├── app.js              # all app logic: CRUD, filters, CSV import/export, cloud sync
├── firebase-config.js  # your Firebase project keys (safe to commit — see above)
└── README.md
```

## Customizing categories

Plant-specific item categories (cylinder sizes, bulk stock, valves, etc.) are defined at the top of `app.js` in the `CATEGORIES` array — edit that list to match your plant's exact register.

## Notes for real-world use

- **Reorder Level** drives the Low Stock / Out of Stock badges and dashboard gauges — set it to your plant's actual minimum safe stock per item.
- Every quantity change (dispatch, receipt, damage, correction) should go through **Amend Quantity**, not editing — this keeps the Stock Movement Log a true audit trail for safety and compliance checks.
- SKU / Batch No. must be unique per item; the app blocks duplicates.
- This is a starting point — feel free to extend it (e.g. user login, printable gate-pass reports, barcode scanning) as the plant's needs grow.
