# Backend Integration — Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the existing frontend and the real backend running together on one machine, with all eight MVP acceptance flows passing on real data.

**Architecture:** The backend runs in Docker (MySQL 8 → `prisma migrate deploy` → NestJS API) on port 3001. The frontend's existing `lib/api` seam switches to it with one environment variable — no screen changes are expected, and needing one is itself a finding. Integration proceeds in four slices ordered cheapest-surface-first, so a failure is unambiguous about where it lives. Every divergence from the mock is triaged to an owner before it is acted on.

**Tech Stack:** Docker Compose, MySQL 8, NestJS 11 + Fastify, Prisma 6, Node ≥22 (26 present). Frontend unchanged: Next.js 16, TanStack Query, `openapi-fetch`, MSW, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-backend-integration-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Working directories.** Frontend: `/home/karpy/Lab/m1/frontend`. Backend: `/home/karpy/Lab/api-mini-store` — a **sibling** of `m1`, never nested inside it.
- **Never modify the backend repository's tracked files.** Only its untracked local `.env`. Findings are escalated, not patched by us.
- **Backend `.env` values that are not negotiable:** `PORT=3001`, `CORS_ORIGINS=http://localhost:3000`, `ACCESS_TOKEN_TTL_SECONDS=60`, `JWT_ACCESS_SECRET` ≥32 chars.
- **Contract is the source of truth.** `m1/api-types.ts` is generated. Never hand-edit it. Regenerate from the **running server** at `http://localhost:3001/api/docs-json` — not `/api/v1/openapi.json`, which does not exist.
- **Triage before fixing.** Every divergence sorts to exactly one owner (spec §7): contract drift → fix frontend; mock wrong → fix `mocks/rules.ts`; backend wrong → log and escalate, **never work around in the frontend**.
- **`npm --prefix frontend run verify` must be green before every commit.**
- **The mock stays the default.** Nothing in this phase may make `npm run dev` or the existing 153 unit / 61 e2e tests depend on a running backend.
- **Record as you go.** Each slice fills its section in `docs/integration-log.md` before its task is complete — including when the finding is "no divergence."
- Commit after every task. Conventional commits, Vietnamese bodies to match the repo's history.

## Review Focus

Five failure modes the spec implies that no slice's happy path would surface. Each has a check pinned to the task that owns it.

1. **CORS preflight passes for `GET` but fails for `POST`.** A JSON `POST` triggers an `OPTIONS` preflight that a `GET` does not. Reads can all work while every write silently fails — which reads as "checkout is broken" rather than "CORS is misconfigured." → Task 4.
2. **Login throttling during testing looks like an auth bug.** `LOGIN_THROTTLE_LIMIT=5` per 60s per IP. Repeated login attempts while poking at flows return `429`, which presents as "wrong password." → Task 4.
3. **Host/container clock disagreement breaks the store day.** MySQL runs `--default-time-zone=+00:00` while the store day is `Asia/Ho_Chi_Minh`. If they disagree, invoice numbers and "today's revenue" land on the wrong day — and only between 00:00 and 07:00 local, so a daytime test never sees it. → Task 6.
4. **Seeding silently produces an unusable admin.** `npm run prisma:seed` reads `SEED_ADMIN_PASSWORD`; if unset it may hash an empty string, leaving an account nobody can log into and no error to explain it. → Task 3.
5. **The 401 replay destroys a real session.** The whole-branch review's Critical 1 was fixed and tested under MSW, but MSW does not rotate refresh tokens for real. A bodied request hitting a genuine 401 is the untested path. → Task 4.

---

## File Structure

Phase 1 writes very little code. That is the point — the seam already exists.

| File | Responsibility | Task |
|---|---|---|
| `/home/karpy/Lab/api-mini-store/.env` | Backend local config. Untracked, ours, never committed to their repo. | 2 |
| `m1/api-types.ts` | Regenerated from the running server to prove the deployed build matches the contract. | 3 |
| `m1/docs/integration-log.md` | The deliverable of every slice: divergences, owners, credentials. | 2–8 |
| `m1/frontend/e2e/live-smoke.spec.ts` | Data-agnostic Playwright smoke covering MVP flows 1–7 against live. Created in Task 8. | 8 |
| `m1/frontend/src/mocks/rules.ts` | Modified **only** if a divergence triages to "mock is wrong." | 5–7 |
| `m1/frontend/src/lib/api/*` | Modified **only** if a divergence triages to "contract drift." | 4–7 |

---

## Task 1: Clone the backend

**Files:**
- Create: `/home/karpy/Lab/api-mini-store/` (clone)

**Interfaces:**
- Consumes: nothing.
- Produces: the backend source tree at a known path, for Tasks 2–8.

- [ ] **Step 1: Verify the target path is free**

```bash
ls -d /home/karpy/Lab/api-mini-store 2>/dev/null && echo "EXISTS — stop and inspect" || echo "free"
```

Expected: `free`. If it exists, stop: an existing clone may have local changes or be on a different commit.

- [ ] **Step 2: Clone**

```bash
cd /home/karpy/Lab
git clone https://github.com/tuanlinh1997/api-mini-store.git
cd api-mini-store && git log --oneline -1
```

Expected: a clone and one commit line. Record the SHA — every finding in this phase is relative to it.

- [ ] **Step 3: Confirm it is not nested inside our repo**

```bash
cd /home/karpy/Lab/api-mini-store && git rev-parse --show-toplevel
```

Expected: `/home/karpy/Lab/api-mini-store`. If it prints `/home/karpy/Lab/m1`, the clone landed inside our repository — delete it and redo Step 2 from `/home/karpy/Lab`.

- [ ] **Step 4: Record the baseline in the integration log**

Append under `## 5. Nhật ký các slice` in `m1/docs/integration-log.md`:

```markdown
### Môi trường

- Backend: `tuanlinh1997/api-mini-store` @ `<sha>` (clone tại `/home/karpy/Lab/api-mini-store`)
- Frontend: `m1` @ `<sha>`
- Ngày tích hợp: <date>
```

- [ ] **Step 5: Commit**

```bash
cd /home/karpy/Lab/m1
git add docs/integration-log.md
git commit -m "docs: ghi nhận phiên bản backend dùng để tích hợp"
```

---

## Task 2: Configure the backend

**Files:**
- Create: `/home/karpy/Lab/api-mini-store/.env`
- Modify: `m1/docs/integration-log.md`

**Interfaces:**
- Consumes: the clone from Task 1.
- Produces: a `.env` with `PORT=3001`, `CORS_ORIGINS=http://localhost:3000`, `ACCESS_TOKEN_TTL_SECONDS=60`, a generated `JWT_ACCESS_SECRET`, and known seed passwords.

- [ ] **Step 1: Verify the four defaults that must change**

```bash
cd /home/karpy/Lab/api-mini-store
grep -E "^(PORT|CORS_ORIGINS|ACCESS_TOKEN_TTL_SECONDS|JWT_ACCESS_SECRET)=" .env.example
```

Expected, and every line is a problem we must fix:

```
PORT=3000                      # collides with the frontend dev server
CORS_ORIGINS=http://localhost:5173,http://localhost:3001   # our origin absent
JWT_ACCESS_SECRET=change-me-...                            # rejected by config validation
ACCESS_TOKEN_TTL_SECONDS=900                               # too long to test refresh by hand
```

- [ ] **Step 2: Create `.env` from the example and apply the four changes**

```bash
cd /home/karpy/Lab/api-mini-store
cp .env.example .env
SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
python3 - "$SECRET" <<'PY'
import re, sys
secret = sys.argv[1]
p = ".env"
s = open(p, encoding="utf8").read()
def setkv(s, k, v):
    if re.search(rf"^{k}=.*$", s, re.M):
        return re.sub(rf"^{k}=.*$", f"{k}={v}", s, flags=re.M)
    return s + f"\n{k}={v}\n"
s = setkv(s, "PORT", "3001")
s = setkv(s, "CORS_ORIGINS", "http://localhost:3000")
s = setkv(s, "JWT_ACCESS_SECRET", secret)
s = setkv(s, "ACCESS_TOKEN_TTL_SECONDS", "60")
s = setkv(s, "SEED_ADMIN_USERNAME", "admin")
s = setkv(s, "SEED_ADMIN_PASSWORD", "Admin-Mvp-2026")
s = setkv(s, "SEED_DEMO_PASSWORD", "Demo-Mvp-2026")
open(p, "w", encoding="utf8").write(s)
PY
grep -E "^(PORT|CORS_ORIGINS|ACCESS_TOKEN_TTL_SECONDS|SEED_ADMIN_USERNAME|SEED_ADMIN_PASSWORD|SEED_DEMO_PASSWORD)=" .env
echo "secret length: $(grep '^JWT_ACCESS_SECRET=' .env | cut -d= -f2 | wc -c)"
```

Expected: the six values echoed as set above, and a secret length over 32.

**Review Focus #4** is handled here: `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` are set explicitly rather than left empty, because an empty value hashes to an account nobody can log into and produces no error.

- [ ] **Step 3: Confirm the backend repo is still clean**

```bash
cd /home/karpy/Lab/api-mini-store && git status --short
```

Expected: **no output**. `.env` is in their `.gitignore`. Any tracked modification means we touched something we must not.

- [ ] **Step 4: Record the credentials in the integration log**

These are local dev credentials for a throwaway database; recording them is what makes the environment reproducible. Append to the `### Môi trường` block:

```markdown
- API: http://localhost:3001 · Swagger: http://localhost:3001/api/docs
- Tài khoản quản trị (seed): `admin` / `Admin-Mvp-2026`
- Mật khẩu dữ liệu demo: `Demo-Mvp-2026`
- `ACCESS_TOKEN_TTL_SECONDS=60` để kiểm tra làm mới token bằng tay
```

- [ ] **Step 5: Commit**

```bash
cd /home/karpy/Lab/m1
git add docs/integration-log.md
git commit -m "docs: ghi cấu hình backend cục bộ cho tích hợp"
```

---

## Task 3: Bring up the stack and seed it

**Files:**
- Modify: `m1/api-types.ts`, `m1/docs/integration-log.md`

**Interfaces:**
- Consumes: the configured `.env` from Task 2.
- Produces: a reachable API at `http://localhost:3001`, seeded data, and `api-types.ts` regenerated from the running server.

- [ ] **Step 1: Verify nothing is listening yet (the RED state)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://localhost:3001/api/v1/health || echo "000 (nothing listening)"
```

Expected: `000`. If it returns 200, something else owns 3001 — find it before continuing, or the rest of this plan tests the wrong server.

- [ ] **Step 2: Start the stack**

```bash
cd /home/karpy/Lab/api-mini-store
docker compose up -d --build
docker compose ps
```

Expected: `mysql` healthy, `migrate` exited `0`, `api` running. If `migrate` exited non-zero, read `docker compose logs migrate` — a failed migration leaves an empty schema and every later task fails confusingly.

- [ ] **Step 3: Verify the API answers (the GREEN state)**

```bash
curl -s -w "\nstatus=%{http_code}\n" --retry 30 --retry-delay 2 --retry-connrefused \
  http://localhost:3001/api/v1/health
```

Expected: `status=200` and a JSON body.

- [ ] **Step 4: Seed the database**

```bash
cd /home/karpy/Lab/api-mini-store
docker compose exec api npm run prisma:seed
docker compose exec api npm run seed:demo
```

Expected: both complete without error. If `prisma:seed` reports the admin already exists, that is fine and idempotent.

- [ ] **Step 5: Prove the seeded admin can actually log in**

This is the check that catches Review Focus #4 — a seeded-but-unusable account.

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin-Mvp-2026"}' \
 | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'data' not in d: print('LOGIN FAILED:', d); raise SystemExit(1)
u=d['data']['user']
print('ok — role:', u['role'], 'name:', u['fullName'])
print('access token present:', bool(d['data']['accessToken']))
"
```

Expected: `ok — role: ADMIN …` and `access token present: True`.

- [ ] **Step 6: Regenerate the contract types from the running server**

```bash
cd /home/karpy/Lab/m1
cp api-types.ts /tmp/api-types.before.ts
npx openapi-typescript http://localhost:3001/api/docs-json -o api-types.ts
diff -q /tmp/api-types.before.ts api-types.ts && echo "IDENTICAL — deployed build matches the committed contract" || echo "DIFFERS — inspect below"
diff /tmp/api-types.before.ts api-types.ts | head -40
```

Expected: `IDENTICAL`. The committed contract hashes the same as theirs today, so a difference means the running build drifted from `docs/backend/openapi.json` — record it as **contract drift** and let Step 7 name the call sites.

- [ ] **Step 7: Verify the frontend still compiles against the regenerated types**

```bash
npm --prefix frontend run verify
```

Expected: `Tests 153 passed`, no TypeScript errors. Any error here is contract drift and must be fixed before any slice begins — the compiler names exactly which call sites.

- [ ] **Step 8: Record and commit**

Append to `docs/integration-log.md` under `### Môi trường`:

```markdown
- `docker compose up -d --build` → mysql healthy, migrate exit 0, api chạy
- `GET /api/v1/health` → 200
- Sinh lại `api-types.ts` từ server đang chạy: **giống hệt** bản đã commit
- `npm run verify` sau khi sinh lại: 153/153 xanh
```

```bash
cd /home/karpy/Lab/m1
git add api-types.ts docs/integration-log.md
git commit -m "chore: xác nhận hợp đồng API khớp với backend đang chạy"
```

---

## Task 4: Slice 1 — auth

**Files:**
- Modify: `m1/docs/integration-log.md`; `m1/frontend/src/lib/api/*` only on contract drift

**Interfaces:**
- Consumes: the running API from Task 3.
- Produces: a verified auth path — login, role routing, refresh, logout — against live.

This task owns **Review Focus #1, #2 and #5**.

- [ ] **Step 1: Prove CORS allows a simple GET**

```bash
curl -s -D- -o /dev/null -H 'Origin: http://localhost:3000' \
  http://localhost:3001/api/v1/health | grep -i "access-control-allow-origin" \
  || echo "NO CORS HEADER — the frontend cannot talk to this server"
```

Expected: `access-control-allow-origin: http://localhost:3000`.

- [ ] **Step 2: Prove the POST preflight also passes — Review Focus #1**

A JSON `POST` triggers an `OPTIONS` preflight that a `GET` never does. Reads can all succeed while every write fails, which presents as "checkout is broken."

```bash
curl -s -D- -o /dev/null -X OPTIONS http://localhost:3001/api/v1/sales \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization' \
 | grep -iE "^HTTP|access-control-allow-(origin|methods|headers)"
```

Expected: a 2xx status plus allow-origin, allow-methods including `POST`, and allow-headers including both `content-type` and `authorization`. A missing `authorization` here breaks every authenticated write while leaving login working.

- [ ] **Step 3: Note the login throttle before testing by hand — Review Focus #2**

```bash
grep -E "^LOGIN_THROTTLE_(LIMIT|TTL_SECONDS)=" /home/karpy/Lab/api-mini-store/.env
```

Expected: `LOGIN_THROTTLE_LIMIT=5`, `LOGIN_THROTTLE_TTL_SECONDS=60`. **Five failed logins per minute per IP returns `429`, which looks exactly like a wrong password.** If login starts failing during this task, wait 60 seconds before concluding anything.

- [ ] **Step 4: Start the frontend against live and log in as each role**

```bash
cd /home/karpy/Lab/m1/frontend
npm run dev:live
```

In the browser at `http://localhost:3000`:

| Check | Expected |
|---|---|
| Log in as `admin` / `Admin-Mvp-2026` | Lands on `/` with the name in the sidebar |
| Log in as a seeded cashier | Lands on `/pos` |
| Log in as a seeded stockkeeper | Lands on `/inventory` |
| Wrong password | One generic Vietnamese message, no hint about which field |

Seeded non-admin usernames come from the demo seed (`cashier2`, `cashier3`, `stockkeeper2`), password `Demo-Mvp-2026`. Record the ones that work.

- [ ] **Step 5: Verify single-flight refresh against real token rotation**

With `ACCESS_TOKEN_TTL_SECONDS=60`, log in, open DevTools → Network, filter to `auth/refresh`, wait 60+ seconds, then click two nav links in quick succession.

Expected: **exactly one** `POST /auth/refresh`, both screens load, no redirect to `/login`.

Two refreshes and a logout means the single-flight gate in `src/lib/api/session.ts` regressed — that is a frontend bug, not a backend one.

- [ ] **Step 6: Verify the 401 replay with a real bodied request — Review Focus #5**

The whole-branch review's Critical 1: a 401 on a request *with a body* threw while rebuilding the replay, dropped the request, and cleared the freshly-rotated session. It is fixed and tested under MSW, but **MSW does not rotate refresh tokens for real** — this is the untested path.

1. Log in as a cashier, go to `/pos`, add a product to the cart.
2. Wait more than 60 seconds so the access token expires.
3. Complete the sale.

Expected: the sale **lands** — a receipt with a real `HD…` number — and you stay logged in. If you are bounced to `/login` with no invoice created, Critical 1 has regressed and Phase 1 stops here.

- [ ] **Step 7: Record the slice**

Fill in `### Slice 1 — auth + products` in `docs/integration-log.md`: the working credentials per role, CORS result, refresh behaviour, replay result, and any divergence with its owner. Write "không phát hiện sai lệch" explicitly if there is none — a blank section is indistinguishable from an unrun slice.

- [ ] **Step 8: Commit**

```bash
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
git add -A
git commit -m "docs: kết quả tích hợp slice 1 — xác thực và làm mới token"
```

---

## Task 5: Slice 2 — reads

**Files:**
- Modify: `m1/docs/integration-log.md`; `m1/frontend/src/mocks/rules.ts` only if a divergence triages to "mock is wrong"

**Interfaces:**
- Consumes: a verified auth path from Task 4.
- Produces: verified list screens against real data volume.

- [ ] **Step 1: Walk every list screen as admin**

With `npm run dev:live` running, visit each and confirm rows render, the count in the footer looks sane, and no error state appears:

`/products` · `/categories` · `/suppliers` · `/customers` · `/inventory` · `/inventory/movements` · `/purchases` · `/users`

- [ ] **Step 2: Exercise pagination and search at real volume**

The demo seed creates far more rows than the mock's 15 products, so this is the first time paging is real.

| Check | Expected |
|---|---|
| `/products` → page 2 | Different rows; the footer count stays constant |
| Type a product name fragment | List narrows; the request fires once, not per keystroke |
| Type 150 characters | No `400`; the input caps at 100 |
| Type only spaces | No request fires at all |

The last two are the debounce and search-capping work from the frontend build; this confirms they hold against a server that actually validates.

- [ ] **Step 3: Verify cost-price suppression on real responses**

Log in as a cashier, open `/products`, and in DevTools → Network inspect a `GET /api/v1/products` response body.

Expected: `costPrice` is **absent as a key**, not `null`. Then confirm the UI shows no "Giá vốn" column.

If the key is present for a cashier, that is a **backend** finding (AZ-1 family) — log it, do not filter client-side.

- [ ] **Step 4: Confirm role gating issues no forbidden requests**

As a cashier, with the Network tab open and filtered to `/api/v1/`, visit `/reports/revenue`, `/users` and `/suppliers`.

Expected: the Vietnamese "Không có quyền truy cập" screen and **zero `403` responses** — the queries are gated client-side, so no request should even be attempted. A `403` here means a screen regressed past the `enabled` capability gate that `e2e/no-forbidden-requests.spec.ts` guards.

- [ ] **Step 5: Record the slice**

Fill in `### Slice 2 — danh sách chỉ đọc` with results and any divergence plus owner.

- [ ] **Step 6: Commit**

```bash
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
git add -A
git commit -m "docs: kết quả tích hợp slice 2 — các màn hình danh sách"
```

---

## Task 6: Slice 3 — checkout

**Files:**
- Modify: `m1/docs/integration-log.md`; `m1/frontend/src/mocks/rules.ts` only if a divergence triages to "mock is wrong"

**Interfaces:**
- Consumes: verified reads from Task 5.
- Produces: a verified `POST /sales` against live, with its arithmetic checked.

This is the slice where semantic drift lives, and it owns **Review Focus #3**.

- [ ] **Step 1: Check the host and database agree on time — Review Focus #3**

MySQL runs with `--default-time-zone=+00:00` while the store day is `Asia/Ho_Chi_Minh` (UTC+7). If they disagree, invoice numbers and "today's revenue" land on the wrong day — and **only between 00:00 and 07:00 local**, so a daytime test never sees it.

```bash
echo "host local : $(date '+%Y-%m-%d %H:%M %Z')"
echo "host UTC   : $(date -u '+%Y-%m-%d %H:%M')"
cd /home/karpy/Lab/api-mini-store
docker compose exec -T mysql mysql -uroot -e "SELECT NOW() AS db_now, @@global.time_zone AS tz;" 2>/dev/null
```

Expected: `tz` is `+00:00`, and `db_now` matches the host's **UTC** time within a minute. Record both. If an invoice later carries an unexpected day, this is the first thing to re-read.

- [ ] **Step 2: Sell something and verify every number**

As a cashier at `/pos`: scan a known product, set quantity 3, attach a customer by phone, pay cash with change due.

| Check | Expected |
|---|---|
| Invoice number | `HD` + today's **store-local** `yyyyMMdd` + 4 digits |
| Subtotal | unit price × 3, formatted as VND |
| Change | tendered − total |
| Points | `floor(total / 10000)`, and the customer's balance increased by that |
| Receipt lines | show the product name and SKU as sold |

- [ ] **Step 3: Verify the sale actually moved the system**

| Where | Expected |
|---|---|
| `/inventory`, that product | stock dropped by exactly 3 |
| `/inventory/movements` | a `SALE` row for `-3`, attributed to the cashier |
| `/sales` | the invoice appears with the right total |
| Reopen the customer | points increased |

- [ ] **Step 4: Verify the rules that reject**

| Attempt | Expected |
|---|---|
| Sell more than stock | `còn N, đang bán M` with a correction button; **no invoice created** |
| Cashier discount above 10% | refused, showing the maximum allowed |
| The same discount as admin | accepted |

After the oversell attempt, re-check `/sales` — the invoice count must be unchanged. A rejected sale that still wrote something is a backend transaction bug and stops the slice.

- [ ] **Step 5: Verify reprint does not re-post**

Open the invoice from `/sales`, click "In lại" three times, then re-check stock for the product sold.

Expected: stock unmoved, still one invoice. (UC-02 E7.)

- [ ] **Step 6: Record the slice — including matches**

Fill in `### Slice 3 — POST /sales`. This is the most valuable section in the log: record the **actual** values observed for discount allocation, points and the invoice number format, not just "worked." If the backend allocates a 997đ discount differently than the mock, this is where it shows.

- [ ] **Step 7: Commit**

```bash
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
git add -A
git commit -m "docs: kết quả tích hợp slice 3 — bán hàng và thanh toán"
```

---

## Task 7: Slice 4 — purchases, stock counts, reports

**Files:**
- Modify: `m1/docs/integration-log.md`; `m1/frontend/src/mocks/rules.ts` only on a "mock is wrong" divergence

**Interfaces:**
- Consumes: a verified checkout from Task 6.
- Produces: the remaining business areas verified against live.

- [ ] **Step 1: Receive a purchase and verify weighted-average cost**

As a stockkeeper, create a draft for a product whose current cost you noted, with a **different** unit cost, then receive it.

| Check | Expected |
|---|---|
| Status | `DRAFT` → `Đã nhận`; action buttons disappear |
| Stock | rose by the received quantity |
| Cost | `(oldQty × oldCost + inQty × inCost) / (oldQty + inQty)`, to 2 decimals |
| Movements | a `PURCHASE` row for the received quantity |

Compute the expected cost by hand and compare. This is BR11, and it is the arithmetic most likely to differ.

- [ ] **Step 2: Verify a received purchase cannot be received twice**

Reload the received purchase's detail page.

Expected: no "Xác nhận nhận hàng" button, and stock unchanged. (BR3.)

- [ ] **Step 3: Verify the stock-count conflict against a real race**

Open `/inventory/counts` in one window and select a product, noting the system quantity. In a second window, log in as a cashier and sell one unit of that product. Return to the first window, enter a count and a reason, and submit.

Expected: the amber conflict panel showing both numbers, and **nothing adjusted**. Then click "Tải lại số tồn và đếm lại" and submit again — it succeeds.

This is UC-04 E2 against a real database rather than shared `localStorage`, so it is the first genuine test of the `expectedSystemQty` guard.

- [ ] **Step 4: Verify reports reflect the day's activity**

As admin, open `/reports/revenue` for today.

Expected: the invoice count and net revenue include the sale from Task 6. Then check `/reports/inventory` shows the stock changes from Steps 1 and 3.

- [ ] **Step 5: Verify the date-range guard against the real server**

| Attempt | Expected |
|---|---|
| `to` one day **before** `from` | Vietnamese error, **no request fires** |
| A range over 366 days | Vietnamese error, no request |
| A range with no data | "Không có dữ liệu trong khoảng thời gian đã chọn" — not an error |

The one-day inversion is the boundary the whole-branch review found open (`span === 0`, neither negative nor over the cap). The frontend now rejects it; if curiosity warrants, send it directly with `curl` to learn whether the backend also rejects it, and record the answer — it belongs to Phase 3's parity suite either way.

- [ ] **Step 6: Record the slice**

Fill in `### Slice 4 — phiếu nhập, kiểm kê, báo cáo` with the computed-vs-observed cost figures and the conflict result.

- [ ] **Step 7: Commit**

```bash
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
git add -A
git commit -m "docs: kết quả tích hợp slice 4 — nhập hàng, kiểm kê, báo cáo"
```

---

## Task 8: MVP acceptance and a repeatable live smoke test

**Files:**
- Create: `m1/frontend/e2e/live-smoke.spec.ts`
- Modify: `m1/frontend/package.json`, `m1/docs/integration-log.md`, `m1/README.md`

**Interfaces:**
- Consumes: all four verified slices.
- Produces: `npm run test:e2e:live` — a data-agnostic smoke covering MVP flows 1–7, plus the signed-off acceptance record.

The manual walkthroughs proved it works once. This makes it repeatable, so "the MVP still runs" is a command rather than an afternoon.

- [ ] **Step 1: Write the live smoke spec**

It must be **data-agnostic** — the backend's seed differs from the mock's, so it asserts on *relationships* (stock went down by what was sold) rather than fixed values.

Create `frontend/e2e/live-smoke.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * MVP acceptance flows 1-7 against the LIVE backend.
 *
 * Data-agnostic: the backend's seed differs from the mock's, so every
 * assertion is relational (stock fell by what was sold) rather than absolute.
 * Skips cleanly when no backend is listening, so it never fails for the
 * wrong reason.
 */
const BASE = process.env.LIVE_API_URL ?? "http://localhost:3001";
const ADMIN = { u: process.env.LIVE_ADMIN_USER ?? "admin", p: process.env.LIVE_ADMIN_PASS ?? "Admin-Mvp-2026" };

test.beforeAll(async () => {
  const res = await fetch(`${BASE}/api/v1/health`).catch(() => null);
  test.skip(!res || !res.ok, `No backend at ${BASE} — run docker compose up in api-mini-store`);
});

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("flow 1: admin logs in and lands on the dashboard", async ({ page }) => {
  await login(page, ADMIN.u, ADMIN.p);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("flow 7: a wrong password is refused with one generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(ADMIN.u);
  await page.getByLabel("Mật khẩu").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("flows 2+3: selling moves stock, invoice and movements together", async ({ page }) => {
  await login(page, ADMIN.u, ADMIN.p);

  // Pick whatever the first in-stock product happens to be — no fixed SKUs.
  await page.goto("/inventory");
  const firstRow = page.getByTestId("stock-row").first();
  await expect(firstRow).toBeVisible();
  const name = (await firstRow.locator("td").nth(1).textContent())?.trim() ?? "";
  const before = Number((await firstRow.locator("td").nth(4).textContent())?.trim());
  expect(Number.isFinite(before)).toBe(true);
  test.skip(before < 1, "first product has no stock to sell");

  await page.goto("/products");
  await page.getByLabel("Tìm kiếm").fill(name);
  const sku = (await page.getByTestId("product-row").first().locator("td").first().textContent())?.trim() ?? "";

  await page.goto("/pos");
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill(sku);
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
  await expect(page.getByTestId("cart-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();

  const invoiceNo = await page.getByTestId("receipt-invoice-no").textContent();
  expect(invoiceNo).toMatch(/^HD\d{12}$/);
  await page.getByRole("button", { name: "Đóng" }).click();

  // stock fell by exactly one
  await page.goto("/inventory");
  await page.getByLabel("Tìm kiếm").fill(name);
  const after = Number(
    (await page.getByTestId("stock-row").first().locator("td").nth(4).textContent())?.trim(),
  );
  expect(after).toBe(before - 1);

  // and the invoice is in history
  await page.goto("/sales");
  await expect(page.getByTestId("sale-row").first()).toContainText(invoiceNo!.trim());
});

test("flow 6: today's revenue report includes the day's sales", async ({ page }) => {
  await login(page, ADMIN.u, ADMIN.p);
  await page.goto("/reports/revenue");
  const invoices = Number((await page.getByTestId("total-invoices").textContent())?.trim());
  expect(Number.isFinite(invoices)).toBe(true);
  expect(invoices).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Add the script**

```bash
cd /home/karpy/Lab/m1/frontend
node -e "
const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.scripts['test:e2e:live']='NEXT_PUBLIC_API_MODE=live playwright test live-smoke';
fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');
"
node -e "console.log(require('./package.json').scripts['test:e2e:live'])"
```

Expected: the script echoed.

- [ ] **Step 3: Verify it skips cleanly with no backend**

```bash
cd /home/karpy/Lab/api-mini-store && docker compose stop api
cd /home/karpy/Lab/m1/frontend && npm run test:e2e:live 2>&1 | tail -5
```

Expected: tests **skipped** with the "No backend at …" message — not failed. A smoke test that fails when the backend is simply absent trains people to ignore it.

- [ ] **Step 4: Verify it passes with the backend running**

```bash
cd /home/karpy/Lab/api-mini-store && docker compose start api
sleep 5 2>/dev/null || true
cd /home/karpy/Lab/m1/frontend && npm run test:e2e:live 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Confirm the mock suite is untouched**

The whole point of keeping the mock default is that normal work needs no Docker.

```bash
cd /home/karpy/Lab/api-mini-store && docker compose stop
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
npm --prefix frontend run test:e2e 2>&1 | tail -3
```

Expected: `153 passed` and `61 passed` with the backend fully stopped. If either needs the backend, the mock default regressed.

- [ ] **Step 6: Sign off the eight acceptance flows**

Restart the backend, then record the result of each spec §5 flow in `docs/integration-log.md` under a new `## 6. Nghiệm thu MVP` heading — pass/fail and the evidence (invoice number, stock before/after, report figures). Flow 8 (token refresh past expiry) is manual; the rest are covered by `test:e2e:live`.

**The MVP is reached when all eight pass.** Any failure stops Phase 1 and is recorded with its owner.

- [ ] **Step 7: Document how to run the integrated stack**

Add to `m1/README.md` under `## Trạng thái`:

```markdown
### Chạy cùng backend thật

```bash
# 1. Backend (repo riêng, clone cạnh m1)
cd ../api-mini-store && docker compose up -d --build

# 2. Frontend
cd m1/frontend && npm run dev:live

# 3. Kiểm thử khói trên API thật (tự bỏ qua nếu backend chưa chạy)
npm run test:e2e:live
```

Tài khoản và cấu hình: [`docs/integration-log.md`](docs/integration-log.md).
```

- [ ] **Step 8: Commit**

```bash
cd /home/karpy/Lab/m1
npm --prefix frontend run verify
git add -A
git commit -m "test: kiểm thử khói trên API thật và nghiệm thu MVP

Bộ kiểm thử không phụ thuộc dữ liệu mẫu: khẳng định theo quan hệ (tồn giảm
đúng số đã bán) thay vì giá trị cố định, và tự bỏ qua khi backend chưa chạy."
```

---

## Appendix: what is not in this plan

| Item | Where it belongs |
|---|---|
| The six missing `thêm`/`sửa` flows (F2, F3, F4, F7, §5.3) | Phase 2 — its own plan, after the MVP runs |
| The API-level parity suite | Phase 3 — its own plan |
| Deployment | Out of scope; this phase is local only |
| Fixing ID-1 (checkout idempotency), AZ-1 (cost leak), AZ-2 (unscoped sales) | Backend repository. Escalate via `docs/integration-log.md` §4. |
