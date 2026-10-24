# Supermarket Management — Frontend Design Spec

**Date**: 2026-10-20
**Status**: Draft for review
**Scope**: Web frontend for the mini-supermarket management system (Đề 09, Nhập môn Công nghệ phần mềm)
**Companion documents**: `openapi.json` · `api-types.ts` · `api_usage_guide.md` · `api_integration_guide.md` · `edge-cases-and-failure-modes.md`

---

## 1. Intent

Build the web frontend for a mini-supermarket management system whose **backend already exists**: Mini Store API v1, 41 endpoints, 85 schemas, 38 error codes, documented and contract-stable.

**Who it is for**: three staff roles in a single store — `ADMIN` (manager), `CASHIER` (sales), `STOCKKEEPER` (inventory). Customers never log in; staff look them up at the counter.

**What success looks like**: every feature F1–F10 from the SRS demonstrably works across all fifteen screens, in Vietnamese, on desktop and tablet. This is a graded course project; the frontend must also produce the screenshots Chương IV needs and the test evidence Chương V needs.

**Working constraint that shapes everything**: the frontend and backend are built **separately by different people** and integrated later. The frontend cannot depend on a running API during development.

### Confirmed with the project owner

| Question | Answer |
|---|---|
| Deliverable | The frontend web app |
| Depth | All 15 screens at demo depth — cover the basics of the product spec, nothing beyond it |
| Development mode | Mock-first; integrate with the real API later |
| Team | One developer on frontend, one on backend |
| Architecture | Approach A — client-side app, mocked at the network boundary |
| Location | `/home/karpy/Lab/m1/frontend/` — a subdirectory of the existing project folder |

### Assumptions (not confirmed — correct these if wrong)

- The backend contract stays stable; changes arrive as a regenerated `api-types.ts`.
- Deployment is a store LAN or a single host, not a public internet product.
- No deadline was given; the plan sequences work by dependency, not by date.

---

## 2. Scope

### In scope

All fifteen screens (S01–S15), covering F1–F10, with the exception flows that UC-01–UC-05 and BR1–BR11 explicitly require.

### Out of scope

Everything the SRS already excludes — online customer accounts, multi-branch, batch/expiry, payment-gateway integration, returns and refunds, offline sync — plus the following, deliberately deferred after a scope discussion:

| Deferred | Risk register ID | Why deferred |
|---|---|---|
| Re-check prices before opening the payment dialog | MN-1 | Mitigates a real S1 defect, but the SRS does not ask for it |
| Persist the cart to localStorage | ID-5 | Same — convenience, not a requirement |
| Full fault-injection scenario panel in the mock | — | Reduced to a minimal forced-error toggle |

These are recorded so they can be picked up deliberately, not rediscovered.

### Required despite the lean scope

These are not extras; the SRS's own use cases specify them:

- `INSUFFICIENT_STOCK` showing per-product availability — UC-02 E2/E3
- `STOCK_CONFLICT` reload-and-reconfirm — UC-04 E2
- Discount ceiling by role — BR7
- Loyalty points on successful payment — BR6
- Reprint that never re-posts an invoice — UC-02 E7
- Single-flight token refresh — without it, sessions die at random (CR-8)
- One shared date component — UTC vs store timezone is a visible defect (TM-1)

---

## 3. Architecture

**Approach A: client-side application inside Next.js, mocked at the network boundary.**

All data fetching happens in the browser through one typed client. React Server Components and server actions are deliberately **not** used for data. Next.js is retained because the SRS names it under "Nền tảng kỹ thuật", and it supplies routing, layouts, and a dev server.

### Why this and not a Next.js BFF

A BFF (route handlers proxying the API, tokens in httpOnly cookies) has a better security posture and would make a stronger NF2 argument. It was rejected because it creates a **second mock problem**: MSW in the browser cannot intercept fetches made by the Next server, so server-side mocking would be needed as well. It also means proxying ~41 endpoints and re-implementing refresh rotation server-side, for a tool that runs on a store LAN. The cost is not justified at this scope. The decision is reversible later — `lib/api` is the only module that would change.

A standalone Prism mock server was rejected as the primary mock because it is **stateless**: a sale would not decrement stock, making the POS demo hollow and the error flows in Chương V impossible to stage. Prism is retained as a contract-conformance check.

### Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Server state | TanStack Query |
| HTTP client | `openapi-fetch`, typed by the existing `paths` |
| Types | `openapi-typescript` output (`api-types.ts`, already generated) |
| Mocks | MSW with a stateful in-memory store |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Tests | Vitest (unit), Playwright (E2E) |

### The load-bearing rule

**Nothing outside `lib/api` knows that HTTP, tokens, or error codes exist.** Screens call typed hooks and receive either data or a normalized `AppError`. This is the seam that makes switching from mock to live backend an environment variable rather than a refactor.

### Project structure

The app is rooted at `/home/karpy/Lab/m1/frontend/`, alongside the existing contract documents (`openapi.json`, `api-types.ts`, the two guides) which stay at the `m1` root and are consumed from there.

```
m1/
  openapi.json · api-types.ts · api_*_guide.md    (contract, owned by the backend developer)
  docs/superpowers/specs/                          (this spec)
  frontend/
    src/
      app/
        (auth)/login/                       S01
        (app)/
          layout.tsx                        shell: nav, session guard, role gating
          page.tsx                          S02 dashboard
          pos/                              S03
          sales/                            S04 (+ [id] detail, reprint)
          customers/                        S05
          products/                         S06
          categories/                       S07
          suppliers/                        S08
          purchases/                        S09a list · S09b draft editor · S09c detail
          inventory/                        S10 stock · S11 counts · S12 movements
          reports/                          S13a-d
          users/                            S14
          profile/                          S15
      lib/
        api/        client.ts · session.ts · errors.ts · types.ts
        query/      keys.ts · invalidation.ts
        format/     money.ts · datetime.ts
        auth/       useRole · can() · <RequireRole>
      components/
        ui/           shadcn primitives
        data-table/   shared paginated table
      mocks/
        db.ts · seed.ts · rules.ts · handlers/ · browser.ts
```

---

## 4. Module design

### 4.1 `lib/api` — the server boundary

| File | Responsibility |
|---|---|
| `client.ts` | `openapi-fetch` instance typed with `paths`. Wrong query params or renamed fields fail the build, not the demo. Base URL and mock/live switch live here. |
| `session.ts` | Holds the access token; runs single-flight refresh. |
| `errors.ts` | Unwraps the response envelope into a typed `AppError` discriminated on `ErrorCode`, preserving `details`. |
| `types.ts` | Stable re-export of generated types, so regeneration does not churn imports. |

**Single-flight refresh is mandatory, not an optimisation.** The refresh token is one-time-use with reuse detection: if two requests receive `401` simultaneously and both call `/auth/refresh`, the second is treated as a stolen-token replay and **the entire session is revoked**, ejecting the cashier mid-sale. Exactly one refresh may be in flight; all other callers await the same promise.

**Error handling branches on `code`, never on `message`.** The server's `message` is Vietnamese and directly displayable, but UI logic must key off the code. The `details` payloads are what make errors actionable: `INSUFFICIENT_STOCK` carries per-product `requested`/`available`; `INVALID_DISCOUNT` carries `maxDiscountAmount`; `VALIDATION_ERROR` carries dotted field paths such as `items.0.quantity` that map onto form fields.

### 4.2 `lib/query` — cache keys and invalidation

Consistent query keys (`['products', {page, search}]`) plus a single invalidation map. The guides already specify what goes stale:

| After | Invalidate |
|---|---|
| `POST /sales` | inventory stock · sales list · that customer's points |
| `POST /purchases/{id}/receive` | products **and** inventory (cost *and* quantity changed) |
| `POST /inventory/stock-counts` | inventory stock · movement ledger |
| `activate` / `deactivate` / `lock` | the affected resource list |

Stale stock in the POS manufactures `INSUFFICIENT_STOCK` errors that did not need to happen.

**`POST /sales` must never auto-retry.** There is no server-side idempotency key (ID-1), so a library-level retry on timeout is how a customer gets charged twice. Retry is disabled for all mutations and enabled only for idempotent reads.

### 4.3 `lib/auth` — identity and visibility

Holds the current user (`{id, username, fullName, role}`, available from the login response — no extra `/auth/me` round trip). Provides `useRole()`, `can()` mapping roles onto the screen permission map, and `<RequireRole>` for hiding navigation and bouncing direct URL access. Owns post-login routing: `ADMIN` → dashboard, `CASHIER` → POS, `STOCKKEEPER` → stock.

Also owns **cost-price suppression**. Cashiers must not see `costPrice` or `unitCostSnapshot`; the server still returns the latter in sale details (AZ-1), so one helper enforces it rather than ten screens each reinventing the check.

**Role gating is UX, not security.** The server is the real gate; every screen must render a sane state on `403`.

### 4.4 `mocks` — the stateful fake backend

| File | Responsibility |
|---|---|
| `db.ts` | In-memory entities plus daily-sequence counters: `HD`/`PN`/`KK` + `yyyyMMdd` + 4-digit sequence, and `KH` + 6 digits |
| `seed.ts` | Deterministic Vietnamese mini-mart data: ~70 products across ~8 categories, suppliers, ~20 customers with points, 2–3 weeks of back-dated sales so reports are not empty, several low-stock items, a few `DRAFT` purchases |
| `rules.ts` | BR1–BR11, each annotated with its clause number |
| `handlers/` | One file per API tag, typed against `paths` |
| `browser.ts` | Worker bootstrap, active only when `NEXT_PUBLIC_API_MODE=mock` |

`rules.ts` implements: stock check and decrement, pro-rata discount allocation with the last line absorbing the rounding remainder, exact payment-sum validation, `floor(total / 10000)` points on the post-discount total, weighted-average cost on receive, and stock-count difference with conflict detection.

**Supporting behaviors:**

- **Mock database persisted to localStorage**, with a "Reset demo data" action. Without it, every page refresh erases the sale just made — which will happen during a demo. This is the *mock backend's* state, not the POS cart; cart persistence is deferred (§2).
- **Latency injection** (~150–400ms) so loading states are built honestly rather than discovered at integration.
- **Short access token in mock mode** (~60s) so single-flight refresh is exercised continuously during development.
- **Minimal forced-error toggle** to stage `403`, `409`, `503` for the error-path tests.

**Not faked**: real concurrency, row locking, rate limiting. A single browser cannot race itself.

**Drift control** — `mocks/rules.ts` deliberately duplicates backend logic, which can hide bugs until integration. Three mitigations:

1. Handlers are typed against `paths`, so when the backend developer regenerates `api-types.ts`, **shape drift becomes a compile error**.
2. Prism run against `openapi.json` checks mock responses for contract conformance.
3. Semantic drift (rounding, sequence formats) surfaces only against the real backend, so integration happens in **thin slices early** — see §7.

### 4.5 Shared components

| Component | Responsibility |
|---|---|
| `<DataTable>` | Server-side pagination, debounced search honouring the 100-character cap (30 for document numbers), filter slots, loading skeleton, empty state, and a `403` state reading "không có quyền" |
| `<ResourceForm>` | Create/edit dialog; zod schema mirroring DTO constraints; maps `VALIDATION_ERROR` dotted paths onto fields |
| `<Money>` | VND formatting; integers in practice |
| `<DateTime>` | UTC → `Asia/Ho_Chi_Minh`. **Every** timestamp renders through this, so the timezone defect cannot be reintroduced per screen |
| `<StatusBadge>` | `DRAFT`/`RECEIVED`/`CANCELLED`, `isActive`, `isLowStock` |

---

## 5. Screens

Ten of the screens share one pattern — paginated list, filters, detail/form, activate-deactivate — and are built as configuration over `<DataTable>` and `<ResourceForm>`: S04, S05, S06, S07, S08, S09a, S09c, S10, S12, S14.

Five are substantially bespoke and hold most of the effort: **S02** dashboard, **S03** POS, **S09b** purchase editor, **S11** stock count, **S13** reports. S01 login and S15 profile are one-off screens but trivial.

| ID | Screen | Roles | Pattern | Primary endpoints |
|----|--------|-------|---------|-------------------|
| S01 | Đăng nhập | public | bespoke (small) | `POST /auth/login` |
| S02 | Dashboard | all three, differing content | bespoke | `/auth/me`, `/reports/*`, `/inventory/low-stock`, `/sales`, `/purchases` |
| S03 | POS bán hàng | ADMIN, CASHIER | **bespoke** | `/products/lookup`, `/customers/lookup`, `POST /sales`, `/sales/{id}/print` |
| S04 | Lịch sử hóa đơn | ADMIN, CASHIER | list | `GET /sales`, `/sales/{id}`, `/sales/{id}/print` |
| S05 | Khách hàng | ADMIN, CASHIER | list + form | `/customers`, `/customers/lookup` |
| S06 | Sản phẩm | view all; edit ADMIN, STOCKKEEPER | list + form | `/products`, activate/deactivate |
| S07 | Danh mục | view all; edit ADMIN, STOCKKEEPER | list + form | `/categories`, activate/deactivate |
| S08 | Nhà cung cấp | ADMIN, STOCKKEEPER | list + form | `/suppliers`, activate/deactivate |
| S09a | Phiếu nhập: danh sách | ADMIN, STOCKKEEPER | list | `GET /purchases` |
| S09b | Phiếu nhập: tạo/sửa | ADMIN, STOCKKEEPER | **bespoke** | `POST /purchases`, `PATCH /purchases/{id}` |
| S09c | Phiếu nhập: chi tiết | ADMIN, STOCKKEEPER | detail | `/purchases/{id}`, `receive`, `cancel` |
| S10 | Tồn kho & cảnh báo | stock all; alerts ADMIN, STOCKKEEPER | list | `/inventory/stock`, `/inventory/low-stock` |
| S11 | Kiểm kê | ADMIN, STOCKKEEPER | **bespoke** | `POST /inventory/stock-counts` |
| S12 | Biến động kho | ADMIN, STOCKKEEPER | list | `/inventory/movements` |
| S13a-d | Báo cáo | ADMIN; tồn kho also STOCKKEEPER | **bespoke** | `/reports/revenue`, `top-products`, `gross-profit`, `inventory` |
| S14 | Quản lý nhân viên | ADMIN | list + form | `/users`, lock/unlock/reset-password |
| S15 | Hồ sơ cá nhân | all three | bespoke (small) | `/auth/me`, `POST /auth/logout` |

### 5.1 S03 POS — the screen that earns real attention

- **Scanner handling.** Barcode guns are keyboard-wedge devices: a burst of keystrokes followed by Enter. A focus-managed capture input routes that to `GET /products/lookup?code=` without stealing focus from quantity or discount fields.
- **Cart** is client state holding `{productId, quantity}`; duplicate scans merge. Maximum 200 lines, whole units only.
- **Checkout** sends cart + optional `customerId` + `discountAmount` + payments. Payments must sum exactly to the total; cash accepts a tendered amount and the server computes change.
- **Double-submit guard**: `disabled` while the mutation is pending, preventing the common double-click. It does **not** solve ID-1, which requires a server-side idempotency key.
- **Receipt** renders `GET /sales/{id}/print` through a print stylesheet. Reprint from history re-reads; it never re-posts.

### 5.2 S11 Kiểm kê

Sends the `expectedSystemQty` the operator actually saw on screen. On `409 STOCK_CONFLICT`, shows both numbers ("hệ thống 8, bạn thấy 10") and requires re-confirmation rather than silently retrying. A reason is mandatory.

### 5.3 S09b Phiếu nhập editor

`items` is a **full replace**, so the editor holds the complete line list and always submits all of it. Concurrent edits cannot be detected (CR-5) — the UI advises reloading before saving.

### 5.4 S13 Reports

Date-range picker defaulting to store-local today/this month. The **366-day cap is enforced client-side** before the request. Both `from` and `to` are required; `to` is inclusive.

---

## 6. Error handling

One mapping table from `ErrorCode` to UI behavior. Most codes surface the server's Vietnamese `message` in a toast. Six receive specific treatment because a use case demands it:

| Code | Behavior | Source |
|---|---|---|
| `401 UNAUTHENTICATED` | Single-flight refresh; on failure, return to login | UC-01 |
| `403 FORBIDDEN` | "Không có quyền" state; never a crash | UC-05 E2 |
| `409 INSUFFICIENT_STOCK` | Per-product `requested`/`available` shown in the cart for correction | UC-02 E2/E3 |
| `409 STOCK_CONFLICT` | Reload current stock, show both numbers, require re-confirm | UC-04 E2 |
| `422 INVALID_DISCOUNT` | Show `maxDiscountAmount` and allow re-entry | BR7 |
| `422 INVALID_PAYMENT` | Highlight the payment total against the amount due | UC-02 E4 |

`VALIDATION_ERROR` maps dotted field paths onto form fields. Everything else takes the generic toast path.

---

## 7. Integration strategy

Big-bang integration at the end is the main schedule risk of mock-first development. Instead, integrate in **thin vertical slices as the backend becomes available**:

1. **Slice 1 — auth.** Point `lib/api` at the real API, log in, verify token refresh and role routing. Smallest possible surface, catches envelope and CORS problems first.
2. **Slice 2 — read-only lists.** Products and inventory against real data. Catches pagination, filter, and field-shape drift.
3. **Slice 3 — one write path.** `POST /sales`, verified against the real transaction. Catches the semantic drift `rules.ts` cannot: rounding, discount allocation, points, document-number format.
4. **Slice 4 — remainder**, by screen group.

Each slice runs the same Playwright flows against live instead of mock. A flow that passes on mock and fails on live has located a drift bug precisely.

---

## 8. Testing and report evidence

**Five Playwright flows against the mock, one per use case**: UC-01 login, UC-02 sell and pay, UC-03 receive a purchase, UC-04 count stock, UC-05 view reports. Error-path variants cover the six codes in §6.

These serve double duty. Chương V ("Thử nghiệm") is currently unwritten; these runs produce a pass/fail table traced to UC-01–UC-05, and their screenshots supply Chương IV. One effort, two deliverables.

**Unit tests** only where logic is tricky and cheap to cover: VND formatting, UTC → store-timezone conversion, cart totals, discount display.

No coverage target. Tests exist to catch real defects and to produce report evidence.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Mock rules drift from backend behavior | Typed handlers catch shape drift at compile time; Prism checks conformance; early thin integration slices (§7) catch semantics |
| Backend contract changes mid-build | Regenerated `api-types.ts` breaks the build loudly rather than silently |
| `POST /sales` has no idempotency (ID-1, S1) | Frontend can only guard double-clicks; the real fix is server-side and belongs to the backend developer |
| No invoice void exists (LC-1, S1) | Out of SRS scope; the UI must not imply the action exists |
| 15 screens is a lot for one developer | Ten collapse into one configurable pattern; bespoke work is concentrated in five screens |

---

## 10. Open questions

1. **Deadline.** None was given. The implementation plan will sequence by dependency; supply a date and it can be sequenced by risk instead.
2. **Backend availability.** When will auth and products be callable? That date sets Slice 1 in §7.
3. ~~Repository location~~ — **resolved**: the frontend lives at `/home/karpy/Lab/m1/frontend/`. See §3. Note that `m1` is not currently a git repository; whether to `git init` at the `m1` root or inside `frontend/` is still undecided.
