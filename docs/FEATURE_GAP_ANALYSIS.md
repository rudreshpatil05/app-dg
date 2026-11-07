# DG Mobile & Electronics Feature Gap Analysis

## Audit scope and method

This audit covers the repository as implemented, rather than only the navigation
labels. Evidence was gathered from the React pages and API client, FastAPI
routers and services, SQLAlchemy models, the local SQLite schema and row
counts, the existing pytest suite, a production frontend build, live API
responses, and a browser smoke test.

The Khatabook and Vyapar columns below are capability references from the
requested brief. They are not claims about the features or limits of a
particular vendor plan. Regulated tax filing and payment-provider integrations
remain configuration-dependent.

Status meanings:

- **Working**: persistence, calculation, authorization, and a test or live
  verification were found.
- **Partial**: a meaningful workflow exists, but an important branch, control,
  or verification is missing.
- **Broken**: the current behavior can produce an incorrect result or does not
  complete the advertised workflow.
- **UI-only**: controls exist without a verified backend effect.
- **Missing**: no implementation was found.

## Evidence inventory

| Area | Evidence |
|---|---|
| Frontend | `frontend/src/components/`, `frontend/src/api/client.js`, `frontend/src/context/AppContext.jsx` |
| Backend routes | `backend/app/routers/` |
| Business logic | `backend/app/services/` |
| Persistence | `backend/app/models/`, `backend/app/database.py` |
| Existing tests | `backend/tests/test_core.py` |
| Local schema | `backend/dg_retail.db` (preserved; not reset) |
| Current local data | 36 products, 76 serials, 11 sales, 49 customers, 12 suppliers, 5 expenses, 1 EMI plan, 2 repair tickets |

## Feature matrix

### A. Dashboard and business overview

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Period sales | Daily, weekly, monthly, trend data | Dashboard sales totals and seven-day chart | Vyapar | Working | `backend/app/routers/dashboard.py`, `DashboardView.jsx` | No arbitrary-period dashboard selector | P2 | Improve | Add date-range API/UI test |
| Cash and bank | Live account balances | Cash, bank, UPI/card balance aggregation | Vyapar | Working | `dashboard.py`, `models/finance.py` | Account mapping for every payment provider is coarse | P1 | Fix | Payment-account integration tests |
| Customer dues | Receivables and EMI due | Outstanding customer and due-today EMI totals | Khatabook, retail | Partial | `dashboard.py`, `routers/emi.py` | Overdue EMI status is not synchronized before every dashboard query | P1 | Fix | Dashboard overdue fixture |
| Supplier payable | Payables | Supplier balance aggregation | Vyapar | Working | `dashboard.py`, `party.py` | Supplier return and ageing are absent | P2 | Implement | Supplier-return report test |
| Stock valuation | Cost valuation and low stock | Serialized and non-serialized stock valuation | Vyapar, retail | Partial | `dashboard.py`, `Product`, `SerialNumber` | No ageing/dead-stock calculation | P2 | Implement | Product-age report test |
| Profit | Revenue, COGS, expenses | Dashboard profit for non-staff | Vyapar | Partial | `dashboard.py`, `accounting_service.py` | Revenue/return treatment needs refund workflow | P1 | Fix | Return-aware P&L test |

### B. Customers and Khatabook ledger

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Customer profile | Contact, GSTIN, credit limit | Customer CRUD and duplicate-phone protection | Khatabook | Working | `customers.py`, `models/party.py` | No edit/deactivate endpoint | P2 | Implement | Customer update test |
| Ledger | Debit, credit, running balance | Sale and payment ledger entries | Khatabook | Working | `CustomerLedger`, `pos_service.py`, `customers.py` | No statement export endpoint | P2 | Implement | Statement export test |
| Credit sale | Due and partial payment | POS credit/partial payments | Khatabook, Vyapar | Working | `pos_service.py`, `Sale`, tests | Credit-limit enforcement is absent | P1 | Fix | Credit-limit rejection test |
| Advance payment | Negative balance/advance | Customer balance model supports advance | Khatabook | Partial | `Customer.current_balance` | Collection previously clamped advances; now preserves negative balances, but sale application needs explicit UX | P1 | Improve | Advance collection and sale test |
| Payment collection | Cash, UPI, card, bank | Receive-payment endpoint and account update | Khatabook | Partial | `customers.py`, `finance.py` | No idempotency key or receipt record/reference persistence | P1 | Implement | Duplicate collection test |
| Reminders | WhatsApp/SMS reminders | WhatsApp statement link | Khatabook | Partial | `whatsapp_service.py`, customer UI | No configured SMS provider or scheduled reminder job | P2 | Implement | Provider-configured integration test |
| Outstanding report | Customer-wise dues/ageing | Customer list sorted by balance | Khatabook | Partial | `CustomersView.jsx` | No due-date/ageing model | P2 | Implement | Ageing report test |

### C. Billing and POS

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Scan and lookup | SKU/barcode/IMEI/serial | Exact scanner lookup and cart add | Retail | Working | `inventory.py`, `POSBilling.jsx` | Browser camera depends on native `BarcodeDetector`; no polyfill | P2 | Improve | Browser/device matrix |
| Cart | Qty, price, tax, discount | Cart and server-side totals | Vyapar, retail | Partial | `POSBilling.jsx`, `pos_service.py` | Client quantity controls must be rechecked against stock at checkout (server does this); no server quote endpoint | P1 | Improve | Quote/checkout parity test |
| Authorization | Discount and price override | Owner/manager overrides, staff restrictions | Vyapar | Working | `pos_service.py`, regression tests | No explicit approval/audit record for override reason | P1 | Implement | Audit assertion |
| Payments | Cash/UPI/card/bank/split/credit | Split payment records and account updates | Vyapar | Partial | `PosSaleRequest`, `SalePayment` | UPI/card accounts collapse to bank account; no card details are stored, which is correct | P1 | Improve | Account mapping test |
| Invoice | Number, GST, customer, warranty | Invoice persistence and browser receipt | Vyapar, retail | Working | `Sale`, `POSBilling.jsx`, `pos.py` | Invoice template is frontend-only for print | P2 | Improve | PDF content test |
| PDF | Downloadable bill | Server-generated invoice PDF | Vyapar | Working | `GET /pos/sales/{sale_id}/pdf` | No QR/embedded payment payload | P3 | Improve | PDF smoke test |
| WhatsApp | Share bill | WhatsApp deep link | Khatabook, Vyapar | Partial | `whatsapp_service.py` | Link sharing is not a provider delivery/receipt | P2 | Keep | Manual link test |
| Duplicate checkout | Retry safety | Idempotency key and unique business index | Retail | Working | `Sale.idempotency_key`, migration, tests | Existing historical invoices have no keys, as expected | P0 | Keep | Duplicate request test |
| Returns/refunds | Original invoice, stock, refund, audit | Return intake and pending inspection | Vyapar, retail | Partial | `pos.py`, `SaleReturn`, `SalesView.jsx` | No approved refund/restock endpoint; financial reports are not adjusted | P0 | Implement | Approval/refund/concurrency tests |

### D. Inventory and product management

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Catalogue | Product/category/SKU/barcode | Product and category creation/listing | Vyapar | Working | `inventory.py`, `Product`, `Category` | No product edit/deactivate UI/API | P1 | Implement | Product lifecycle test |
| Stock-in | Purchase and opening stock | Opening stock and purchase stock movement | Vyapar | Partial | `purchases.py`, `StockMovement` | No purchase rows existed in local DB; purchase workflow needs dedicated coverage | P1 | Improve | Purchase integration test |
| IMEI | Unique device traceability | Serial registration and sold-state prevention | Retail | Partial | `SerialNumber`, `inventory.py`, `pos_service.py` | Purchase validation now requires exact IMEI count; uniqueness should include all identifier fields/database constraints | P1 | Fix | Duplicate IMEI/serial test |
| Stock-out | Atomic deduction | Server-side stock and serial status updates | Retail | Working | `pos_service.py`, tests | Database-specific locking behavior needs MySQL integration verification | P0 | Verify | Concurrent MySQL test |
| Adjustments | Stock reconciliation | Serial status update only | Vyapar | Partial | `inventory.py` | No quantity adjustment endpoint/audit trail | P1 | Implement | Adjustment audit test |
| Returns | Restock/damaged | Return item model exists | Vyapar | Partial | `SaleReturnItem` | No approved inspection state transition | P0 | Implement | Return state test |
| Ageing | Slow/dead stock | None | Vyapar | Missing | No route/model found | No received-date aggregation/report | P2 | Implement | Ageing report test |

### E. Mobile and electronics

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Warranty | Device/customer dates | Warranty record creation and lookup | Retail | Working | `WarrantyRecord`, `WarrantyView.jsx` | Claims do not change warranty state | P1 | Improve | Claim lifecycle test |
| EMI | Schedule, due, collection | EMI plan, installments, overdue sync, collection | Retail | Working | `emi_service.py`, `emi.py`, tests | Collection idempotency and concurrency need strengthening | P1 | Fix | Duplicate collection test |
| Exchange | Old-device valuation | Exchange capture during sale and status UI | Retail | Partial | `ExchangeDevice`, POS, `ExchangeView.jsx` | No exchange stock intake/valuation accounting integration | P2 | Implement | Exchange accounting test |
| Repairs | Job card/status | Repair tickets and status changes | Retail | Partial | `RepairTicket`, `RepairsView.jsx` | Parts, service invoices, notifications and delivery payment workflow absent | P1 | Implement | Repair lifecycle test |
| Bundles | Accessory combinations | None | Retail | Missing | No bundle model/API found | No bundle pricing or stock component rules | P3 | Implement | Bundle pricing test |

### F. Accounting and expenses

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Cashbook | Money in/out and balances | Account transactions for sales, expenses, collections | Vyapar | Partial | `Account`, `AccountTransaction`, `accounting_service.py` | Some payment methods are mapped generically to BANK | P1 | Improve | Account routing test |
| Expenses | Category, account, date | Expense creation and cash/bank deduction | Vyapar | Working | `finance.py`, `ExpensesView.jsx` | No receipt upload storage | P2 | Implement | Receipt attachment test |
| P&L | Revenue, COGS, expenses | Comprehensive P&L endpoint | Vyapar | Partial | `calculate_comprehensive_profit_loss` | Returns, purchases, inventory adjustments not fully represented | P1 | Fix | Return-aware P&L test |
| Balance sheet | Assets/liabilities/equity | None | Vyapar | Missing | No route/model aggregation found | Requires accounting design beyond current cashbook | P2 | Implement | Accounting acceptance suite |
| Reconciliation | Expected vs physical cash | Daily reconciliation | Vyapar | Working | `CashReconciliation`, finance routes | Supplier cash calculation uses purchase totals rather than payment transactions | P1 | Fix | Reconciliation fixture |

### G. Suppliers, purchases and orders

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Suppliers | Profile and ledger | Supplier CRUD, ledger, payment | Vyapar | Partial | `suppliers.py`, `SupplierLedger` | Payment validation improved; no edit/deactivate or statement export | P2 | Improve | Supplier lifecycle test |
| Purchase invoice | Items, tax, paid/due | Purchase creation | Vyapar | Partial | `purchases.py`, `PurchasesView.jsx` | No local purchase rows and no idempotency | P1 | Implement | Purchase retry test |
| IMEI receiving | Exact serial capture | Purchase IMEI registration | Retail | Partial | `purchases.py` | Duplicate IMEI check only covers imei1 and has no DB uniqueness | P1 | Fix | Duplicate identifier test |
| Purchase returns | Supplier return and stock reversal | Model exists only | Vyapar | Missing | `PurchaseReturn` has no route/UI | P1 | Implement | Purchase-return test |
| Orders | PO and delivery status | None | Vyapar | Missing | No PO model/routes found | P3 | Implement | PO lifecycle test |

### H. Reports and analytics

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Sales report | Date/category/brand/product/customer/payment | Sales summary with filters and breakdowns | Vyapar | Working | `reports.py`, `ReportsView.jsx` | Return-adjusted sales pending | P1 | Fix | Report after return |
| Exports | CSV/PDF/XLSX | Sales exports | Vyapar | Working | `reports.py`, client API | Other ledgers lack exports | P2 | Implement | Export tests |
| GST | Tax totals and invoices | GST summary | Vyapar | Partial | `reports.py`, sales tax fields | Not a filing integration and must not be represented as one | P1 | Keep/Document | Tax calculation fixtures |
| Inventory | Valuation | Stock valuation | Vyapar | Working | `reports.py` | No ageing/dead stock | P2 | Implement | Valuation/ageing test |
| Customer/supplier reports | Dues and collections | Lists and ledgers | Khatabook, Vyapar | Partial | customer/supplier routers | No date-range aggregated report | P2 | Implement | Aggregation tests |

### I. Automation and communication

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Invoice sharing | WhatsApp link | Deep links for invoice/statement | Khatabook, Vyapar | Partial | `whatsapp_service.py` | No provider delivery status | P2 | Keep/Improve | Configured provider test |
| EMI reminders | Due/overdue reminders | Manual WhatsApp link | Retail | Partial | `emi.py` | No scheduler/deduplication | P1 | Implement | Reminder job test |
| Low stock | Notification | Dashboard alerts | Vyapar | Partial | `dashboard.py`, notifications model | No durable generated low-stock event policy | P2 | Implement | Alert dedupe test |
| Warranty reminders | Expiry notification | Dashboard expiry list | Retail | Partial | `dashboard.py` | No scheduled notification | P2 | Implement | Warranty reminder test |

### J. Security, backup and administration

| Field | Required information | Feature | Reference | Current status | Evidence | Gap | Priority | Action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| Authentication | Password/PIN/JWT | Login and token auth | Both | Working | `auth.py`, auth routes, tests | PIN/password operational policy needs deployment review | P1 | Verify | Auth negative tests |
| RBAC | Owner/manager/staff/accountant | Router role dependencies and frontend access | Both | Partial | `auth.py`, `AppContext.jsx` | Some sensitive mutation routes use only authenticated user | P1 | Fix | Role matrix tests |
| Audit | Sensitive changes | Sale audit and audit-log viewer | Both | Partial | `AuditLog`, settings route | Discounts, returns, expenses, payments are not uniformly audited | P1 | Implement | Audit completeness test |
| Backup | Restore-capable data export | Owner backup endpoint | Both | Partial | `settings.py` | Export had only counts; now exports business-scoped table rows, but restore is not implemented | P1 | Improve | Backup content/restore test |
| Recovery | Transaction rollback | SQLAlchemy commits in services | Both | Partial | routers/services | No automated restore or recovery drill | P1 | Implement | Recovery test |
| Offline/sync | Offline sales and conflict resolution | None | Both | Missing | No offline queue/sync implementation | Requires explicit product decision | P3 | Defer | Architecture decision |

## Prioritized implementation completed in this pass

1. Preserved customer advances instead of clamping overpayments to zero.
2. Rejected supplier payments above the payable balance.
3. Required exact IMEI/serial counts for serialized purchases and rejected duplicate/empty values in a request.
4. Exported actual business-scoped rows in the owner backup JSON instead of counts only.
5. Retained and verified sale idempotency, server-authoritative sale pricing, staff discount restrictions, scanner lookup, invoice PDF generation, and duplicate checkout protection from the previous feature pass.

## Remaining P0/P1 work

The highest-risk remaining item is the approved return/refund workflow. The
current endpoint intentionally records a pending inspection return and does not
pretend that a refund or restock has completed. Implementing that safely
requires a return state migration, refund account transaction, customer-ledger
adjustment, serial/stock movement reversal, report adjustments, and owner/
manager approval tests.
