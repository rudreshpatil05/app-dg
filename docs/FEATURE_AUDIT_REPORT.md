# DG Mobile & Electronics Feature Audit Report

## Executive summary

The application is a real React/Vite + FastAPI/SQLAlchemy retail system, not a
mock dashboard. It already has connected POS, inventory, IMEI, customer ledger,
supplier, purchase, expense, EMI, repair, warranty, exchange, accounting,
reporting, audit-log, notification, and backup surfaces.

The audit found a solid core sale workflow and several important partial
workflows. The most serious remaining business risk is returns: the current
flow records a pending inspection return, but an approved refund/restock/
ledger-adjustment workflow is not yet present. That gap is documented rather
than reported as complete.

## Verified working

- JWT/password and PIN authentication, active-business scoping, and role
  filtering.
- Product/category catalogue, SKU/barcode lookup, and exact IMEI/serial
  lookup.
- POS cart, GST-inclusive calculations, split payments, credit balances,
  warranty records, stock movement creation, and serialized-device sale
  prevention.
- Server-side price/tax/discount/stock validation.
- Owner/manager override behavior and staff discount restrictions.
- Sale idempotency protection for retried checkout requests.
- Customer sales ledger, payment collection, cash/bank account transaction
  updates, and WhatsApp statement links.
- EMI plan generation, installment schedules, overdue status synchronization,
  collection, and EMI reminder links.
- Expense recording and account balance changes.
- Sales, P&L, GST, stock valuation, CSV, PDF, and XLSX report endpoints.
- Browser print, server invoice PDF download, and WhatsApp invoice links.
- Owner audit-log viewing and role-protected settings/backup access.

## Fixes applied

### Data integrity and authorization

- Customer payment collection now preserves negative balances as customer
  advances instead of silently clamping them to zero.
- Supplier payment collection rejects payments above the supplier payable
  balance.
- Serialized purchases require exactly one non-empty, unique IMEI/serial value
  per received unit.
- Purchase payment methods and empty purchase carts are validated.
- Existing sale hardening from the scan-to-sell pass remains active:
  server-side catalog pricing/tax, role-restricted discounts, stock locking,
  duplicate checkout idempotency, and business-specific invoice numbering.

### Backup

The owner backup endpoint now exports actual business-scoped rows from mapped
tables as downloadable JSON. It still intentionally excludes user credentials
and does not claim to provide restore until a reviewed restore workflow exists.

## Scan-to-sell and billing enhancements retained

- USB scanner/manual input.
- Exact SKU, barcode, IMEI, and serial lookup.
- Automatic focus for consecutive scans.
- Mobile camera scanning where browser `BarcodeDetector` is available.
- Quantity merging for repeat scans of non-serialized products.
- Checkout idempotency.
- Invoice PDF generation, browser printing, and WhatsApp sharing.

## Database and migration notes

Migration added:

- `backend/migrations/001_add_sale_idempotency.sql`

The local development startup path applies the additive sale idempotency
compatibility change without dropping or resetting data. Staging/production
must apply the SQL migration through the deployment migration process.

The audit did not reset `backend/dg_retail.db`. Existing local data remains
present. The local database contains 36 products, 76 serial numbers, 11 sales,
49 customers, 12 suppliers, 5 expenses, 1 EMI plan, and 2 repair tickets at
the time of audit.

## Important remaining gaps

### P0

- Approved return/refund workflow with:
  - owner/manager authorization;
  - return quantity and duplicate-return enforcement;
  - stock/serial state transition;
  - refund cash/bank transaction;
  - customer-ledger and sale/report adjustment;
  - audit trail and concurrency tests.
- MySQL concurrency verification for row locking and invoice-number
  allocation.

### P1

- Idempotency for customer collections, EMI collections, purchases, expenses,
  and supplier payments.
- Credit-limit enforcement and explicit advance application UX.
- Product edit/deactivate and quantity stock-adjustment workflows.
- Purchase-return workflow.
- Durable audit entries for discounts, refunds, payments, expenses, and stock
  adjustments.
- Account-specific mapping for UPI/card/bank instead of the current generic
  bank fallback.
- Return-aware sales/P&L/GST reporting.
- Repair parts, service billing, delivery payment, and repair notifications.

### P2/P3

- Customer/supplier statement exports and due-ageing reports.
- Stock ageing, slow-moving/dead-stock reports, and purchase order tracking.
- Accessory bundles.
- Scheduled/deduplicated EMI, warranty, and low-stock reminders.
- Receipt/document attachment storage.
- Full balance-sheet accounting.
- Offline queue and multi-device conflict resolution.

## Files changed in this audit pass

- `backend/app/routers/customers.py`
- `backend/app/routers/suppliers.py`
- `backend/app/routers/purchases.py`
- `backend/app/routers/settings.py`
- `docs/FEATURE_GAP_ANALYSIS.md`
- `docs/FEATURE_AUDIT_REPORT.md`

Files changed in the prior scan-to-sell pass and included in this audit:

- `backend/app/database.py`
- `backend/app/main.py`
- `backend/app/models/sale.py`
- `backend/app/routers/inventory.py`
- `backend/app/routers/pos.py`
- `backend/app/schemas/pos.py`
- `backend/app/services/pos_service.py`
- `backend/tests/test_core.py`
- `frontend/src/api/client.js`
- `frontend/src/components/layout/Navbar.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/pos/POSBilling.jsx`

## Commands

Start backend:

```powershell
& .\.venv\Scripts\python.exe backend\run_server.py
```

Start frontend:

```powershell
Set-Location frontend
npm run dev
```

Run backend tests:

```powershell
Set-Location backend
& ..\.venv\Scripts\python.exe -m pytest tests\test_core.py -q
```

Build frontend:

```powershell
Set-Location frontend
npm run build
```

## Verification performed

- Backend regression suite: **23 passed**.
- Backend Python compilation: **passed**.
- Frontend production build: **passed**.
- Live backend OpenAPI endpoint: **200 OK**.
- Live frontend endpoint: **200 OK**.
- Browser smoke test: authenticated dashboard and **Scan & Sell** POS loaded.
- New PDF route present in OpenAPI.
- Duplicate checkout and staff-discount tests passed.

The frontend build still emits the existing non-blocking large-chunk warning.
