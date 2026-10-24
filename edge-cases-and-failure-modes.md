<!--
DOCUMENT METADATA
Owner: @project-manager
Purpose: Risk register of edge cases and failure modes for the mini-supermarket system
Derived from: "Báo cáo đồ án CNPM_Đề 09_Quản lý siêu thị.docx" (SRS: F1–F10, NF1–NF8, BR1–BR11, UC-01–UC-05)
              + openapi.json (Mini Store API v1, 41 endpoints) + api_usage_guide.md + api_integration_guide.md
Update trigger: Any change to business rules, the API contract, or when an item is fixed/accepted
Read by: @backend-developer, @qa-engineer, @frontend-developer, reviewers
Language: English (ask if a Vietnamese version is needed for the report)
-->

# Edge Cases & Failure Modes

> **Status**: Analysis · **Created**: 2026-10-06
> Derived by reading the SRS report against the implemented API contract. Each item carries a stable ID
> so it can be referenced from test cases, issues, and the project report.

## How to read this

| Mark | Meaning |
|------|---------|
| ✓ | Already handled by the design/implementation — keep as a regression test |
| ⚠ | Partially handled, or handled by convention rather than enforcement |
| ❗ | Gap — no mechanism exists |
| 🔍 | **Needs verification** — inferred from the contract, not confirmed in code |

Severity is about business impact, not implementation effort:
**S1** = loses money or customer trust · **S2** = corrupts data or blocks daily operations · **S3** = friction, noise, or latent risk.

---

## Priority summary

Fix these first. Items 2 and 6 are scope decisions, not defects; the rest are flaws in work that already exists.

| # | Item | ID | Severity |
|---|------|----|----------|
| 1 | No idempotency on checkout — a lost response can double-charge the customer and double-deduct stock | ID-1 | S1 |
| 2 | No invoice void or return — a mis-ring has **no** correction path | LC-1 | S1 |
| 3 | Price changes between scan and checkout are applied silently | MN-1 | S1 |
| 4 | Account lock and role change take up to 15 minutes to take effect | CR-6, CR-7 | S2 |
| 5 | Cost price leaks to cashiers in the sale detail response | AZ-1 | S2 |
| 6 | No shift / cash-drawer reconciliation (no Z-report) | TM-3 | S2 |

---

## 1. Concurrency & races (CR)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| CR-1 | Two cashiers sell the last unit simultaneously | ✓ | — | Product rows locked inside the transaction, stock re-checked; loser gets `409 INSUFFICIENT_STOCK` with per-product `requested`/`available` |
| CR-2 | Deadlock from two carts locking the same products in opposite order | ✓ | — | Locks are acquired in ascending product-id order |
| CR-3 | Stock count submitted after stock moved underneath the operator | ✓ | — | Client must send `expectedSystemQty`; mismatch → `409 STOCK_CONFLICT` |
| CR-4 | Same purchase received twice (double-click, retry, two users) | ✓ | — | `409 PURCHASE_ALREADY_RECEIVED`; stock is never added twice |
| CR-5 | Two stockkeepers edit the same `DRAFT` purchase | ❗ | S2 | Last write wins silently. `items` is a **full replace**, so one person's added lines disappear with no warning. No version/ETag check |
| CR-6 | Admin locks a compromised account mid-shift | ❗ | S2 | The access token stays valid for up to 15 minutes. "Lock" is not revocation — bad when locking someone for suspected theft |
| CR-7 | Admin demotes a user's role mid-session | ❗ | S2 | Same window: the old role travels in the JWT until the next refresh |
| CR-8 | Two browser tabs refresh the token at the same moment | ⚠ | S2 | Refresh-token reuse detection treats it as theft and revokes the **whole session**, logging the cashier out mid-sale. Requires single-flight refresh on the client; nothing server-side prevents it |
| CR-9 | Same customer created from two terminals at once | ✓ / ❗ | S3 | Protected when a phone is present (`409 DUPLICATE_VALUE`); a customer **without** a phone silently duplicates → see DUP-2 |

## 2. Idempotency & partial failure (ID)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| ID-1 | `POST /sales` response is lost (WiFi blip, hotspot register) | ❗ | **S1** | No idempotency key. The invoice may already exist. Documented mitigation is "query recent sales before retrying" — which a cashier facing a queue will not do. Result: **double invoice, double stock deduction, double points** |
| ID-2 | `POST /purchases` with `receiveNow` is retried after a lost response | ❗ | S2 | Adds stock twice and corrupts weighted-average cost (see MN-7) |
| ID-3 | `409 TRANSACTION_CONFLICT` / `503 TRANSACTION_TIMEOUT` | ✓ | — | Explicitly safe to retry — nothing was written |
| ID-4 | Printer fails after the sale is committed | ✓ | — | `GET /sales/{id}/print` is read-only and reprintable; never re-creates the invoice (UC-02 E7) |
| ID-5 | Tab crash, accidental refresh, or dead tablet battery mid-order | ❗ | S2 | The cart lives only in the browser. The whole order is lost. Also means there is no "park this order" while a customer fetches one more item |
| ID-6 | Response lost after a successful write | ⚠ | S3 | The cashier does not even know the invoice number; recovery is searching sales by cashier + timestamp |

## 3. Money & arithmetic (MN)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| MN-1 | `salePrice` is changed while an order is open | ❗ | **S1** | The cart sends only `{productId, quantity}`; the server prices from the **current** DB value. The customer is charged a different amount than the screen showed, with no conflict detection. Note the inconsistency: stock counts guard stale reads with `expectedSystemQty`; pricing does not |
| MN-2 | A 100% comp, staff freebie, or goodwill write-off | ❗ | S2 | `discountAmount` must be **strictly less than** subtotal (BR7), so an invoice can never total zero |
| MN-3 | Rounding the total down to avoid handing out 200đ coins; tips; overpayment | ❗ | S2 | Payments must sum **exactly** to the total (`422 INVALID_PAYMENT`). Normal Vietnamese retail practice is not expressible |
| MN-4 | Invoice discount split across lines | ⚠ | S3 | Allocated pro-rata, rounded to VND, **last line absorbs the remainder**. Two identical items on one invoice can carry different effective prices — harmless now, a problem the moment returns exist (LC-1) |
| MN-5 | Client-side subtotal disagrees with the server | ⚠ | S3 | The client must mirror the server's per-line `Math.round` exactly, or the pre-checkout display differs from the charge. Final figures must always come from the response |
| MN-6 | Product sold before its first goods receipt | ❗ | S2 | `costPrice` defaults to **0**, so those sales book 100% margin. Cost is snapshotted at sale time, so the gross-profit report for that period can never be corrected |
| MN-7 | Quantity typo on receipt (100 instead of 10) | ❗ | S2 | Permanently corrupts weighted-average cost. A stock count fixes the quantity but **explicitly never touches cost** (BR11), and a received voucher cannot be un-received (INV-4). No correction path exists |

## 4. Time & dates (TM)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| TM-1 | A sale at 00:30 local time | ⚠ | S2 | Timestamps are UTC; business-date filters are `Asia/Ho_Chi_Minh`. 00:30 local = 17:30 UTC **the previous day**. A client that formats UTC naively reports the sale on the wrong business day |
| TM-2 | Invoice number `HDyyyyMMddNNNN` near midnight | 🔍 | S3 | Verify whether the date segment uses store-local or UTC date. If UTC, every invoice between 00:00 and 07:00 local carries yesterday's date |
| TM-3 | End-of-day cash reconciliation; a shift crossing midnight | ❗ | S2 | **No concept of a shift or session**: no opening float, no drawer count, no Z-report. A store open past midnight splits one shift across two report days. For a POS this is a significant omission |
| TM-4 | Year-over-year comparison, all-time totals | ❗ | S3 | Reports require `from` and `to` and cap the window at **366 days** |
| TM-5 | Clock skew between app server and database | ⚠ | S3 | Can land a sale on the wrong day boundary or disturb the daily sequence |

## 5. Inventory integrity (INV)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| INV-1 | Shrinkage, breakage, theft recorded via stock count | ❗ | S2 | **Adjustments are never costed.** Gross profit is revenue minus COGS of *sold* items only, so losses reduce stock value but never reduce reported profit. Inventory value and reported profit drift apart permanently |
| INV-2 | Goods are on the shelf but the receipt was not entered yet | ❗ | S2 | No negative stock (BR1) means the sale is blocked. The cashier is stuck mid-transaction with a customer waiting and no override — the only escape is to leave the register and create a purchase voucher |
| INV-3 | Full annual count of ~1,000 SKUs | ❗ | S2 | Stock counts are **one product per request**. No count sheet, no batch submit, no partial save, no freeze — each line carries its own `STOCK_CONFLICT` window. Practically unusable at store scale |
| INV-4 | A received purchase was wrong | ❗ | S2 | Cannot be un-received or edited. Correction goes through a stock count, which attributes the error to "adjustment" and leaves the cost basis wrong (MN-7) |
| INV-5 | Deactivating a product that still has stock | ✓ | — | Documented: it stays in `GET /reports/inventory` valuation unless filtered by `isActive`, and drops out of low-stock alerts. Needs a process, not a code change |
| INV-6 | Expired goods | ❗ | S2 | No batch or expiry tracking (out of scope) — expired items scan and sell normally |
| INV-7 | `MovementType.REVERSAL` | ⚠ | S3 | Present in the enum with nothing producing it — the orphan left by putting cancellation out of scope (BR2) |

## 6. Lifecycle & state (LC)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| LC-1 | Mis-scan, wrong quantity, or a customer changing their mind after paying | ❗ | **S1** | **There is no way to void an invoice.** The workaround — a stock-count adjustment — fixes stock but leaves revenue permanently overstated and loyalty points wrong. Mis-rings happen daily in retail; this is the largest real-world gap in the design |
| LC-2 | A `DRAFT` purchase whose product or supplier was deactivated | ✓ | — | Becomes un-receivable with `422 PRODUCT_UNAVAILABLE` / `SUPPLIER_INACTIVE`; the draft can be edited back to a valid state |
| LC-3 | Editing a product whose category was deactivated | 🔍 | S3 | `categoryId` must be active on create/update. If the edit form always resubmits `categoryId`, editing those products starts failing with `422 CATEGORY_INACTIVE`. Plausible UI trap — confirm whether the field is revalidated when unchanged |
| LC-4 | A typo'd, duplicated, or privacy-sensitive customer record | ❗ | S3 | Customers have no deactivate and no delete — unlike products, categories, suppliers and users (BR10 coverage is incomplete) |
| LC-5 | Points awarded to the wrong customer (cashier picks the wrong lookup hit) | ❗ | S3 | `loyaltyPoints` is write-protected and accrue-only; sending it on update is rejected. No reversal, no manual adjustment |

## 7. Authorization & data exposure (AZ)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| AZ-1 | A cashier opens `GET /sales/{id}` | ❗ | S2 | The response includes `unitCostSnapshot`. The stated mitigation is "do not render it" — a UI convention, not enforcement, and it contradicts NF2 ("quyền kiểm tra ở server"). Margin data is visible to anyone who opens devtools |
| AZ-2 | A cashier pages `GET /sales` | 🔍 | S2 | The endpoint accepts a `cashierId` **filter**, which suggests results are not scoped to the caller. If so, any cashier can reconstruct store-wide daily revenue. Verify server-side scoping |
| AZ-3 | Three cashiers fat-finger passwords at shift start | ❗ | S2 | Login rate limit is **5 attempts / 60s per IP**, and every register sits behind one NAT address. The whole shop gets locked out |
| AZ-4 | Someone changes a sale price, a reorder level, or resets a password | ❗ | S2 | **No audit log for master-data changes.** Only stock movements record an actor. Price manipulation is the classic retail fraud vector and it is completely untraced |
| AZ-5 | Two staff share one browser profile on a counter tablet | ⚠ | S3 | Refresh-token rotation and reuse detection interfere between sessions (see CR-8) |
| AZ-6 | Demoting the last remaining admin via `PATCH /users/{id}` | 🔍 | S2 | `LAST_ACTIVE_ADMIN` guards **locking** the last admin. Verify it also guards a role change — otherwise one edit locks the store out of administration permanently |
| AZ-7 | Admin resets another user's password | ❗ | S3 | No notification to the affected user and no second-person control |

## 8. Identity & duplicate data (DUP)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| DUP-1 | `+84…` format, foreign numbers, some landline formats | ❗ | S3 | Phone is normalized to 10–11 digits starting with `0`; anything else is rejected outright |
| DUP-2 | A loyalty customer registered without a phone number | ❗ | S3 | Un-findable afterwards (lookup is by phone or code) **and** silently duplicable on every visit |
| DUP-3 | Same manufacturer barcode on a single unit and a multipack | ❗ | S3 | Barcode uniqueness (BR9) blocks a legitimate retail case |
| DUP-4 | Clearing a barcode by sending `null` | ⚠ | S3 | A previously scannable product silently stops scanning at the POS |
| DUP-5 | Changing a product's SKU after it has been sold | ✓ | — | Invoices snapshot SKU and name at sale time (BR5); history stays correct |
| DUP-6 | Duplicate customers created by DUP-2 / CR-9 | ❗ | S3 | No merge tool, so duplicates are permanent and the loyalty balance stays split across them |

## 9. Scale & performance (PERF)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| PERF-1 | 12-month gross-profit report at the NF8 target of 100,000 invoices | ❗ | S2 | Joins sale lines across the range with no pre-aggregation. Unlikely to meet NF1's 2-second goal |
| PERF-2 | Every paginated list | ⚠ | S3 | `meta.total` requires a COUNT over the filtered set — the expensive half of pagination |
| PERF-3 | Repeated product/stock lookups at the POS | ⚠ | S3 | No caching layer is specified anywhere |
| PERF-4 | Boundary values to test against | ✓ | — | 200 cart lines · 10 payments per invoice · 1,000,000 units per line · 100-char search (30 for document numbers) · 366-day report window · money ≤ 9,999,999,999 |

## 10. Operational (OPS)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| OPS-1 | Database outage or dead internet link | ❗ | **S1** | Single store, single database, **no offline mode** (explicitly out of scope). The store cannot sell anything. No documented fallback — not even a manual-receipt procedure |
| OPS-2 | Restoring from backup | ❗ | S2 | NF7 mandates daily backups and a tested restore procedure; Chapter V (Triển khai → Thử nghiệm) is still "To be define", so neither exists |
| OPS-3 | Store name/address/phone are unset in config | ⚠ | S3 | They may be empty strings → receipts print with a blank header |
| OPS-4 | Standing up a fresh environment | ❗ | S3 | How the **first admin account** is created is not specified anywhere |
| OPS-5 | Staff training and demos | ❗ | S3 | No test/training mode — practice transactions land in real revenue reports and real stock |

## 11. Process edge cases a real store hits weekly (PROC)

| ID | Case | Status | Sev | Notes |
|----|------|--------|-----|-------|
| PROC-1 | Cashier needs a discount above the 10% role limit | ❗ | S2 | There is no approval flow. An **admin must create the entire invoice**, not approve the cashier's. The queue stops while someone fetches the manager |
| PROC-2 | Returning customer has forgotten their phone number | ❗ | S3 | Lookup fails, points are not awarded, and a duplicate profile usually gets created (DUP-2, DUP-6) |
| PROC-3 | Shelf tag disagrees with the system price | ❗ | S3 | No override, no price-check workflow — straight to a customer dispute |
| PROC-4 | Customer pays, then wants one item removed | ❗ | S1 | Nothing can be done — see LC-1 |
| PROC-5 | Card terminal declines after the cash half was already counted | ⚠ | S3 | Payments must balance exactly, so the invoice is rebuilt from scratch and stock is re-verified |

---

## Items needing verification (🔍)

These were inferred from the API contract and should be confirmed against the code before being treated as facts:

| ID | Question |
|----|----------|
| TM-2 | Does `HDyyyyMMddNNNN` use the store-local date or the UTC date? |
| LC-3 | Is `categoryId` revalidated on `PATCH /products/{id}` when the value is unchanged? |
| AZ-2 | Is `GET /sales` scoped server-side to the calling cashier, or can any cashier list all sales? |
| AZ-6 | Does the `LAST_ACTIVE_ADMIN` guard cover **role demotion**, or only locking? |

## Known-good behaviors worth keeping as regression tests

CR-1 · CR-2 · CR-3 · CR-4 · ID-3 · ID-4 · INV-5 · LC-2 · DUP-5 · PERF-4

## Sources

- `Báo cáo đồ án CNPM_Đề 09_Quản lý siêu thị.docx` — F1–F10, NF1–NF8, BR1–BR11, UC-01–UC-05
- `openapi.json` — Mini Store API v1, 41 endpoints, 85 schemas, 38 error codes
- `api_usage_guide.md` — purpose, call order, data impact, SRS traceability (§5)
- `api_integration_guide.md` — envelope, token flow, money/date conventions, error catalogue
