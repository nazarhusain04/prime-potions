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
- **Real-time:** WebSockets

---

## What's Been Implemented

### ✅ P0 - Core Infrastructure
- [x] FastAPI backend with all API routes
- [x] React frontend with routing and layout
- [x] MongoDB integration
- [x] JWT authentication (login/logout)
- [x] Seed data endpoint with test users

### ✅ P0 - Inventory On-Hand Visibility
- [x] `GET /api/inventory/onhand` - Items with on_hand_qty, available_qty, reserved_qty
- [x] `GET /api/inventory/onhand/{item_id}` - Detailed lot breakdown
- [x] `GET /api/inventory/alerts/low-stock` - Items below min_stock_level
- [x] Inventory Overview page with filters and status badges

### ✅ P0 - Searchable Dropdowns
- [x] Search endpoints: `/api/search/items`, `/api/search/lots`, `/api/search/locations`, `/api/search/formulas`
- [x] SearchableSelect component for type-to-search

### ✅ P0 - Expanded UOM Support
- [x] Mass: KG, G, MG, LB, OZ
- [x] Volume: L, ML, GAL, FL_OZ
- [x] Count: EA, PCS, CASE, BOX
- [x] UOM alias resolution

### ✅ P1 - Prime Potions Excel Template Matching
- [x] Raw Materials: "RAW-MASTER INV" sheet with exact headers
- [x] Packaging: "Master inventory-Packaging" sheet with exact headers
- [x] Batching: "Batching Sheet" with header row 4, columns A-N
- [x] Helper sheet for VLOOKUP support

### ✅ P1 - Admin-Only Excel Import
- [x] Raw materials import
- [x] Packaging import
- [x] Import updates master data only (not inventory transactions)

### ✅ P1 - Recipe Required Toggle
- [x] `recipe_required` field on formulas
- [x] `variance_tolerance_percent` for strict validation
- [x] Flexible vs Strict modes

### ✅ P1 - Excel Sync Page
- [x] Export buttons: Raw Materials, Packaging, Batching Template
- [x] Import section (Admin-only)
- [x] Template reference documentation

### ✅ P2 - Batching Import with Validation
- [x] `POST /api/excel/prime-potions/import-batching`
- [x] STRICT mode: Validates against recipe exactly
- [x] FLEXIBLE mode: Allows manual ingredients
- [x] Creates batch record + inventory transactions + WIP production

### ✅ P2 - Complete Traceability Views
- [x] Enhanced TraceabilityPage with 3 tabs
- [x] Trace Lot: Forward/Backward trace with tree visualization
- [x] Where Used: Find all batches using an item
- [x] History tab placeholder
- [x] Color-coded node types (RAW=green, WIP=blue, FG=purple)
- [x] Transaction history display

### ✅ P2 - Quick Import Wizard
- [x] 5-step wizard: Upload → Select Sheet → Map Columns → Preview → Complete
- [x] `POST /api/excel/import-wizard/analyze` - Analyzes Excel structure
- [x] `POST /api/excel/import-wizard/preview` - Shows create/update/skip counts
- [x] `POST /api/excel/import-wizard/apply` - Applies the import
- [x] Auto-suggest column mappings with fuzzy matching
- [x] Progress indicator and summary cards

### ✅ WebSocket Live Updates
- [x] Dashboard subscribes to inventory.updated, batch.updated, filling.updated
- [x] Real-time refresh when data changes

---

## Test Credentials
- **Admin:** admin@primepotions.com / admin123
- **Production:** production@primepotions.com / user123
- **Warehouse:** warehouse@primepotions.com / user123
- **QA:** qa@primepotions.com / user123
- **Viewer:** viewer@primepotions.com / user123

---

## Prioritized Backlog

### P3 - Future Enhancements
- [ ] Email notifications for low stock alerts
- [ ] Advanced reporting dashboards
- [ ] Batch genealogy PDF export
- [ ] Mobile-responsive optimizations
- [ ] Multi-tenant support
- [ ] Barcode/QR code scanning integration

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

### Inventory
- `GET /api/inventory/onhand` - With filters
- `GET /api/inventory/onhand/{item_id}` - Detail
- `GET /api/inventory/alerts/low-stock`
- `GET /api/inventory/stock`
- `GET /api/inventory/transactions`
- `POST /api/inventory/receive`

### Search (Dropdowns)
- `GET /api/search/items`
- `GET /api/search/lots`
- `GET /api/search/locations`
- `GET /api/search/formulas`
- `GET /api/search/categories`

### Excel Sync (Prime Potions)
- `GET /api/excel/prime-potions/raw-materials`
- `GET /api/excel/prime-potions/packaging`
- `GET /api/excel/prime-potions/batching-template`
- `POST /api/excel/prime-potions/import-raw-materials`
- `POST /api/excel/prime-potions/import-packaging`
- `POST /api/excel/prime-potions/import-batching`

### Import Wizard
- `POST /api/excel/import-wizard/analyze`
- `POST /api/excel/import-wizard/preview`
- `POST /api/excel/import-wizard/apply`

### Formulas
- `GET/POST /api/formulas`
- `PUT /api/formulas/{id}`
- `POST/PUT/DELETE /api/formulas/lines`

### Batching
- `GET/POST /api/batching/workspace`
- `GET /api/batching/workspace/{id}/download-sheet`
- `POST /api/batching/workspace/{id}/upload-sheet`
- `POST /api/batching/workspace/{id}/start`

### Traceability
- `GET /api/traceability/forward/{lot_number}`
- `GET /api/traceability/backward/{lot_number}`
- `GET /api/traceability/where-used/{item_id}`

### Master Data
- `GET/POST /api/master/uom`
- `GET/POST /api/master/categories`
- `GET/POST /api/master/locations`
- `GET/POST /api/master/raw-materials`
- `GET/POST /api/master/packaging-materials`
- `GET/POST /api/master/products`

---

## File Structure
```
/app
├── backend/
│   ├── server.py              # Main FastAPI app (3500+ lines)
│   ├── excel_services.py      # PrimePotionsExcelService + ImportWizard
│   ├── requirements.txt
│   └── tests/
│       ├── test_p0_p1_features.py
│       └── test_p2_features.py
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Sidebar.js    # Navigation with Excel Sync submenu
    │   │   │   └── ...
    │   │   └── ui/
    │   │       ├── searchable-select.jsx  # Type-to-search dropdown
    │   │       └── ...
    │   ├── pages/
    │   │   ├── inventory/
    │   │   │   ├── InventoryOverviewPage.js  # On-Hand visibility
    │   │   │   └── ...
    │   │   ├── ExcelSyncPage.js              # Export/Import
    │   │   ├── ImportWizardPage.js           # 5-step wizard
    │   │   ├── FormulasPage.js               # Recipe library
    │   │   ├── TraceabilityPage.js           # 3-tab trace views
    │   │   └── ...
    │   └── contexts/
    │       └── WebSocketContext.js           # Live updates
    └── package.json
```

---

## Testing Status
- **Backend:** 41+ tests passing (P0, P1, P2)
- **Frontend:** All UI flows verified
- **Test reports:** `/app/test_reports/`
