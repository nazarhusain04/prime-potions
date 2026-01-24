# Prime Potions ERP - Product Requirements Document

## Original Problem Statement
Build a complete, production-ready Full-Stack Inventory + Manufacturing ERP system for a small-to-mid manufacturing business named "Prime Potions" (cosmetics manufacturing + co-packing).

## Core Requirements
- **Branding:** Prime Potions ERP
- **Core Goal:** Track inventory and manufacturing end-to-end (Raw Materials → WIP → Finished Goods) with LIVE inventory quantities and full lot/batch traceability
- **Inventory Model:** Append-only transaction ledger (not mutable quantity fields)
- **Excel Workflow:** Match Prime Potions' existing Excel templates EXACTLY
- **Roles:** Admin, Production, Warehouse, QA, Viewer

## Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React with shadcn/ui components
- **Database:** MongoDB
- **Authentication:** JWT
- **Real-time:** WebSockets (planned)

---

## What's Been Implemented (as of Jan 24, 2026)

### P0 - Inventory On-Hand Visibility ✅
- [x] `GET /api/inventory/onhand` - Returns items with on_hand_qty, available_qty, reserved_qty, stock_status
- [x] Supports filters: search, item_type, category, below_min_only
- [x] `GET /api/inventory/onhand/{item_id}` - Detailed lot breakdown
- [x] `GET /api/inventory/alerts/low-stock` - Items below min_stock_level
- [x] Inventory Overview page with search, filters, and status badges

### P0 - Searchable Dropdowns ✅
- [x] `GET /api/search/items?q=...&type=RAW|PACK|FG` - Item search
- [x] `GET /api/search/lots?q=...&item_id=...` - Lot search
- [x] `GET /api/search/locations?q=...` - Location search
- [x] `GET /api/search/formulas?q=...` - Formula search
- [x] `GET /api/search/categories?type=...` - Category search
- [x] SearchableSelect component created

### P0 - Expanded UOM Support ✅
- [x] `GET /api/master/uom` - Returns expanded unit list
- [x] Mass: KG, G, MG, LB, OZ (ounce weight)
- [x] Volume: L, ML, GAL, FL_OZ (fluid ounce)
- [x] Count: EA, PCS, CASE, BOX
- [x] `GET /api/master/uom/resolve/{text}` - Alias resolution
- [x] Admin can add custom UOMs via `POST /api/master/uom`

### P1 - Prime Potions Excel Template Matching ✅
- [x] **Raw Materials Export** (`GET /api/excel/prime-potions/raw-materials`)
  - Sheet: "RAW-MASTER INV"
  - Exact headers: ITEM CODE, INTERNAL LOT #, Ingredient Name, SUPPLIER LOT #, Tracking key, Opening stock, Inventory on hand, EXPIRY / RETEST Date, VENDOR / MANUFACTURER, INCI NAME, Primary Inv Zone, 2ND Inv Zone, CoA, Container Type, Column2, UoM, Notes, Minimum stock, Stock status
- [x] **Packaging Export** (`GET /api/excel/prime-potions/packaging`)
  - Sheet: "Master inventory-Packaging"
  - Exact headers: Item Name, sub category, category, Client, Supplier, Size or Specs, UOM, Opening Stock, On Hand, Active, Storage location, Minimum Stock, Stock Status
- [x] **Batching Template Export** (`GET /api/excel/prime-potions/batching-template`)
  - Sheet: "Batching Sheet" (header row 4)
  - Columns A-N: Ingredient Formula, Inv Loc., Qty Required, Add Order, Added, Kg Sum, Process Notes, Batch Notes, [blank], Qty on Hand (kg), ENTER % QTY HERE, [blank], [blank], Enter individual Quantities...
  - Helper sheet: "Do not change - Import range fr" for VLOOKUP support

### P1 - Admin-Only Excel Import ✅
- [x] `POST /api/excel/prime-potions/import-raw-materials` - Admin only
- [x] `POST /api/excel/prime-potions/import-packaging` - Admin only
- [x] Import updates master data only (not inventory transactions)
- [x] Returns create/update/skip counts

### P1 - Recipe Required Toggle ✅
- [x] `recipe_required` field on formulas collection
- [x] `variance_tolerance_percent` for strict mode validation
- [x] Formulas page with toggle switch and visual indicators
- [x] Flexible (manual ingredients allowed) vs Strict (must match recipe) modes

### P1 - Excel Sync Page ✅
- [x] Single page with Export and Import sections
- [x] Export buttons: Raw Materials, Packaging, Batching Template
- [x] Import section with file upload (Admin-only)
- [x] Template Reference showing exact headers

### Categories & Custom Fields ✅
- [x] `GET /api/master/categories` - List categories
- [x] `POST /api/master/categories` - Create category (Admin)
- [x] Custom fields support via key/value storage

---

## Test Credentials
- **Admin:** admin@primepotions.com / admin123
- **Production:** production@primepotions.com / user123
- **Warehouse:** warehouse@primepotions.com / user123
- **QA:** qa@primepotions.com / user123
- **Viewer:** viewer@primepotions.com / user123

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Fix "Failed to load data" error on batching workspace
- [x] Inventory On-Hand visibility with min stock alerts
- [x] Searchable dropdown components
- [x] Expanded UOM list (oz, fl oz, etc.)

### P1 - Completed ✅
- [x] Prime Potions Excel template matching (exact headers)
- [x] Excel Sync page with export/import
- [x] Recipe Required toggle for formulas
- [x] Admin-only Excel import controls

### P2 - Next Up
- [ ] Batching import with strict/flexible validation
- [ ] WebSocket live updates on Dashboard
- [ ] Complete Traceability views UI
- [ ] Company Settings admin page

### P3 - Future
- [ ] Full Recipe/BOM management module UI
- [ ] Filling/Packaging module (WIP → Finished Goods)
- [ ] Comprehensive Audit Log UI
- [ ] Advanced reporting
- [ ] Email notifications for low stock alerts

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Inventory On-Hand
- `GET /api/inventory/onhand` - List with filters
- `GET /api/inventory/onhand/{item_id}` - Detail with lots
- `GET /api/inventory/alerts/low-stock` - Alerts

### Search (Dropdowns)
- `GET /api/search/items` - Items
- `GET /api/search/lots` - Lots
- `GET /api/search/locations` - Locations
- `GET /api/search/formulas` - Formulas
- `GET /api/search/categories` - Categories

### Excel Sync (Prime Potions)
- `GET /api/excel/prime-potions/raw-materials` - Export
- `GET /api/excel/prime-potions/packaging` - Export
- `GET /api/excel/prime-potions/batching-template` - Export
- `POST /api/excel/prime-potions/import-raw-materials` - Import (Admin)
- `POST /api/excel/prime-potions/import-packaging` - Import (Admin)

### Master Data
- `GET/POST /api/master/uom` - Units of Measure
- `GET /api/master/uom/resolve/{text}` - UOM alias resolution
- `GET/POST /api/master/categories` - Categories

### Formulas
- `GET/POST /api/formulas` - Formulas with recipe_required
- `PUT /api/formulas/{id}` - Update formula
- `GET /api/formulas/{id}` - Get with lines
- `POST/PUT/DELETE /api/formulas/lines` - Manage lines

### Batching
- `GET/POST /api/batching/workspace` - Workspaces
- `GET /api/batching/workspace/{id}/download-sheet` - Download Excel
- `POST /api/batching/workspace/{id}/upload-sheet` - Upload Excel
- `POST /api/batching/workspace/{id}/start` - Start batch

---

## File Structure
```
/app
├── backend/
│   ├── server.py              # Main FastAPI app with all routes
│   ├── excel_services.py      # PrimePotionsExcelService class
│   ├── requirements.txt
│   └── tests/
│       └── test_p0_p1_features.py
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── components/
    │   │   ├── layout/
    │   │   └── ui/
    │   │       ├── searchable-select.jsx  # NEW
    │   │       └── ...
    │   ├── contexts/
    │   ├── lib/
    │   │   └── api.js
    │   └── pages/
    │       ├── inventory/
    │       │   ├── InventoryOverviewPage.js  # NEW
    │       │   └── ...
    │       ├── ExcelSyncPage.js              # UPDATED
    │       ├── FormulasPage.js               # UPDATED
    │       └── ...
    └── package.json
```

---

## Testing Status
- **Backend:** 26/26 tests passing (100%)
- **Frontend:** All UI flows verified
- **Test file:** `/app/backend/tests/test_p0_p1_features.py`
- **Test report:** `/app/test_reports/iteration_2.json`
