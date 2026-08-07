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

This app has **no server or database** — all data lives in your browser's `localStorage`. That means:

- It works completely offline once loaded.
- Data is private to the device/browser you use it on.
- **Export to CSV regularly** (button in the sidebar) to keep a backup — clearing browser data or switching devices/browsers will lose unsaved data.

For a real multi-user plant deployment (multiple staff/terminals sharing one live inventory), you'd want to swap `localStorage` for a small backend (e.g. a simple REST API + database like SQLite/Postgres, or a service like Firebase/Supabase). The current data layer is isolated in `app.js` (`load()` / `persist()` functions) to make that swap straightforward later.

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
├── index.html   # page structure (dashboard, inventory table, forms, modals)
├── style.css    # industrial-themed styling, fully responsive
├── app.js       # all app logic: CRUD, filters, CSV import/export, localStorage
└── README.md
```

## Customizing categories

Plant-specific item categories (cylinder sizes, bulk stock, valves, etc.) are defined at the top of `app.js` in the `CATEGORIES` array — edit that list to match your plant's exact register.

## Notes for real-world use

- **Reorder Level** drives the Low Stock / Out of Stock badges and dashboard gauges — set it to your plant's actual minimum safe stock per item.
- Every quantity change (dispatch, receipt, damage, correction) should go through **Amend Quantity**, not editing — this keeps the Stock Movement Log a true audit trail for safety and compliance checks.
- SKU / Batch No. must be unique per item; the app blocks duplicates.
- This is a starting point — feel free to extend it (e.g. user login, printable gate-pass reports, barcode scanning) as the plant's needs grow.
