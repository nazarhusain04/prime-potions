# Prime Potions ERP - Product Requirements Document

## Original Problem Statement
Build a complete, production-ready Full-Stack Inventory + Manufacturing ERP system for a small-to-mid manufacturing business named "Prime Potions".

## Core Requirements
- **Branding:** Prime Potions ERP (sourced from `company_settings` table)
- **Core Goal:** Track inventory and manufacturing end-to-end (Raw Materials → WIP → Finished Goods) with LIVE inventory quantities and full lot/batch traceability
- **Inventory Model:** Append-only transaction ledger (not mutable quantity fields)
- **Roles:** Admin, Production, Warehouse, QA, Viewer

## Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React with shadcn/ui components
- **Database:** MongoDB
- **Authentication:** JWT
- **Real-time:** WebSockets

## What's Been Implemented (as of Jan 23, 2026)

### Phase 1: Core Infrastructure ✅
- [x] FastAPI backend with all API routes
- [x] React frontend with routing and layout
- [x] MongoDB integration
- [x] JWT authentication (login/logout)
- [x] Seed data endpoint with test users

### Phase 1: Excel-Driven Batching Workflow ✅
- [x] Batching Workspace page (create/view batches)
- [x] Generate pre-filled Excel batching sheet
- [x] Download batching sheet functionality
- [x] Start batch (change status to "In Progress")
- [x] Upload completed sheet endpoint (creates inventory transactions)
- [x] WIP production lot creation

### Master Data Management ✅
- [x] Locations CRUD
- [x] Raw Materials CRUD
- [x] Packaging Materials CRUD
- [x] Products (Finished Goods) CRUD
- [x] Units of Measure CRUD
- [x] Recipes/BOM CRUD

### Inventory Management ✅
- [x] Inventory transactions (append-only ledger)
- [x] Stock snapshots (read-optimized view)
- [x] Receive inventory endpoint
- [x] Stock summary API

### Manufacturing ✅
- [x] Batch Orders CRUD
- [x] Filling Orders CRUD
- [x] Feasibility calculator
- [x] WIP on floor view

### Dashboard ✅
- [x] Live inventory summary cards
- [x] Active batch orders count
- [x] Active filling orders count
- [x] Recent transactions

### Traceability ✅
- [x] Forward trace (raw material → finished goods)
- [x] Backward trace (finished goods → raw materials)
- [x] Where-used lookup

## Test Credentials
- **Admin:** admin@primepotions.com / admin123
- **Production:** production@primepotions.com / user123
- **Warehouse:** warehouse@primepotions.com / user123
- **QA:** qa@primepotions.com / user123
- **Viewer:** viewer@primepotions.com / user123

## Prioritized Backlog

### P0 - High Priority
- [ ] Excel Import/Export Framework for Master Data
- [ ] RBAC enforcement across all endpoints

### P1 - Medium Priority
- [ ] WebSocket live updates on Dashboard
- [ ] Complete Traceability views UI
- [ ] Company Settings admin page

### P2 - Lower Priority
- [ ] Comprehensive Audit Log UI
- [ ] Advanced reporting
- [ ] Excel template management

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Batching Workspace
- `GET /api/batching/workspace` - List workspaces
- `POST /api/batching/workspace` - Create workspace
- `GET /api/batching/workspace/{id}` - Get workspace
- `GET /api/batching/workspace/{id}/download-sheet` - Download Excel sheet
- `POST /api/batching/workspace/{id}/upload-sheet` - Upload completed sheet
- `POST /api/batching/workspace/{id}/start` - Start batch
- `POST /api/batching/workspace/{id}/qa-hold` - Place on QA hold
- `POST /api/batching/workspace/{id}/release` - Release batch

### Master Data
- `GET/POST /api/master/locations`
- `GET/POST /api/master/raw-materials`
- `GET/POST /api/master/packaging-materials`
- `GET/POST /api/master/products`
- `GET/POST /api/master/units`
- `GET/POST /api/master/recipes`

### Inventory
- `GET /api/inventory/stock`
- `GET /api/inventory/stock/summary`
- `GET/POST /api/inventory/transactions`
- `POST /api/inventory/receive`

### Manufacturing
- `GET/POST /api/manufacturing/batch-orders`
- `GET/POST /api/manufacturing/filling-orders`
- `GET /api/manufacturing/feasibility/{product_id}`
- `GET /api/manufacturing/wip-on-floor`

### Formulas
- `GET/POST /api/formulas`
- `GET /api/formulas/{id}`
- `POST /api/formulas/lines`

### Dashboard
- `GET /api/dashboard/summary`

### Traceability
- `GET /api/traceability/forward/{lot_number}`
- `GET /api/traceability/backward/{lot_number}`
- `GET /api/traceability/where-used/{item_id}`

## File Structure
```
/app
├── backend/
│   ├── server.py          # Main FastAPI app
│   ├── excel_services.py  # Excel generation/parsing
│   ├── requirements.txt
│   └── tests/
│       └── test_prime_erp.py
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── components/
    │   │   ├── layout/
    │   │   └── ui/
    │   ├── contexts/
    │   ├── lib/
    │   │   └── api.js
    │   └── pages/
    │       ├── BatchingWorkspacePage.js
    │       ├── DashboardPage.js
    │       └── ...
    └── package.json
```
