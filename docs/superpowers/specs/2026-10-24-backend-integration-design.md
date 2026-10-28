# Backend Integration — Design Spec

**Date**: 2026-10-24
**Status**: Draft for review
**Scope**: Integrating the existing frontend (`m1/frontend`) with the real backend API
**Backend**: https://github.com/tuanlinh1997/api-mini-store (public, NestJS 11 + Fastify + Prisma 6 + MySQL 8)
**Companion documents**: `docs/integration-log.md` · `2026-10-20-supermarket-frontend-design.md` · `edge-cases-and-failure-modes.md`

---

## 1. Intent

The frontend was built entirely against a stateful in-browser mock, deliberately, so that it
and the backend could be developed in parallel. This spec covers connecting the two for the
first time.

**What success looks like**: a working MVP. The backend runs locally in Docker, the frontend
talks to it through `npm run dev:live`, and every main flow can be demonstrated end to end on
real data — not a divergence count. Behavioural differences are recorded as they surface, but
finding them is not the goal; a running system is.

**Who it is for**: the two developers on this project — one on each side.

### Confirmed with the project owner

| Question | Answer |
|---|---|
| Target | **Local dev on one machine.** Not a deployment. |
| Verification approach | **Approach A** — slice-by-slice bring-up plus an API-level parity suite |
| Mock's future | Stays the default; live is opt-in |
| MVP scope | **Integration first, missing forms right after** — two phases with the running system reached before new UI surface is added |

### Findings from reading the backend (not assumptions)

These were established by reading the repository before designing, and they change the
risk profile substantially:

1. **The contracts are byte-identical.** The backend's generated
   `docs/backend/openapi.json` hashes to the same SHA-256 as our `openapi.json` — same 41
   paths, same 85 schemas, identical in detail. Structural drift is therefore already ruled
   out, and the seven corrections made during the frontend build were plan-vs-contract, not
   frontend-vs-backend.
2. **Behaviour matches the mock on every previously open question**: invoice numbers use the
   `Asia/Ho_Chi_Minh` day (ADR-005); the last-active-admin guard does cover role demotion
   (`users.service.ts:83-87`); discount ceilings are 10%/100% and points are 1 per 10.000 đ,
   both env-driven with those defaults.
3. **Three risk-register items are confirmed real and backend-side**: no idempotency on
   `POST /sales` (ID-1); `unitCostSnapshot` is written and returned without role filtering
   (AZ-1); `GET /sales` takes no acting user, so any cashier can list every sale (AZ-2 —
   previously unverified, now confirmed).

**The remaining risk is therefore semantic, not structural**: whether the backend computes
rounding, discount allocation, points, weighted-average cost and document numbers the way
the mock does.

### Assumptions (correct these if wrong)

- The backend's `main` branch is what we integrate against.
- We may run the backend locally and create our own `.env`; we do not modify their repository.
- MySQL via their `docker-compose.yml` is acceptable (no local MySQL required).

---

## 2. Scope

### In scope

**Phase 1 — reach the MVP (this is the priority):**

- Running the backend locally and configuring it to accept our frontend.
- Four integration slices: auth → reads → checkout → remainder.
- Recording divergences in `docs/integration-log.md` with an owner, as they surface.

**Phase 2 — make every screen usable:**

- The six missing flows: add/edit for products and categories, edit for suppliers, customers
  and staff, and the draft purchase editor (F3 `thêm`+`sửa`; F2, F4, F7 `sửa`; §5.3).
- A reset-password action for staff (the hook exists, unused).

**Phase 3 — harden:**

- The API-level parity suite, runnable against both the mock and the live backend.

Phases are gated: Phase 2 does not start until the MVP demonstrably runs, so a new form never
fails for a reason entangled with integration.

### Out of scope

- **Deployment.** Local only.
- **Modifying the backend repository.** Findings are escalated, not patched by us.
- **Retiring the mock.** It remains the default backend for the test suites.
- **Invoice void/return, batch & expiry, weighed goods, promotions.** Out of SRS scope for v1.

---

## 3. Bring-up and configuration

The backend is cloned to `/home/karpy/Lab/api-mini-store` — a **sibling** of `m1`, never
nested inside it. It is a separate repository with its own history; nesting would pollute ours.

### Configuration

Three values in the backend's local `.env` (created from their `.env.example`; their
repository is not modified):

| Setting | Value | Reason |
|---|---|---|
| `PORT` | `3001` | The backend defaults to `3000`, which the frontend dev server owns. Moving the backend is cheaper: our `3000` is fixed in `playwright.config.ts`, the README, and the `dev:live` default. |
| `CORS_ORIGINS` | `http://localhost:3000` | Their default allowlist is `http://localhost:5173,http://localhost:3001`. Our origin is absent, so every request would fail CORS before anything else could be learned. |
| `JWT_ACCESS_SECRET` | generated, ≥32 chars | Required by their config validation. |
| `ACCESS_TOKEN_TTL_SECONDS` | `60` | Default is 900. Sixty seconds makes the refresh path reachable by hand, matching what the mock already does. |

Port `3001` is where `npm run dev:live` already points, so no frontend configuration changes.

### Startup

`docker compose up -d --build` brings up MySQL 8, runs `prisma migrate deploy` as a one-shot,
then starts the API. Node ≥22 required (26 present).

Data: `npm run prisma:seed` creates the base admin from `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`;
`npm run seed:demo` adds realistic volume. Their demo accounts (`cashier2`, `cashier3`,
`stockkeeper2`, `cashier.cu`) differ from the mock's — the real credentials are recorded in
`integration-log.md` rather than assumed to match.

### Gate before touching the frontend

1. `GET http://localhost:3001/api/v1/health` returns 200.
2. Regenerate types **from the running server**, not from the committed file:
   `npx openapi-typescript http://localhost:3001/api/docs-json -o api-types.ts`
3. `npm --prefix frontend run verify` stays green.

Step 2 matters even though the hashes match today: it proves the *deployed build* agrees with
the contract we hold, and if it ever stops agreeing, `tsc` names the affected call sites.

---

## 4. The four slices

Each slice points the frontend at live, exercises a narrow surface, and records what differs.
Ordered so the cheapest surface fails first.

| Slice | Surface | What it proves |
|---|---|---|
| 1 — Auth | `login`, `refresh`, `me`, `logout` | CORS, response envelope, bearer flow, role routing |
| 2 — Reads | products, categories, suppliers, customers, inventory | Pagination, filters, search at real volume; `costPrice` genuinely absent for a cashier |
| 3 — Checkout | `POST /sales` | Rounding, discount allocation, points, cost snapshots, document numbers |
| 4 — Remainder | purchases, stock counts, reports | Weighted-average cost, stock-count conflict, report aggregation |

### Two checks in Slice 1 that carry disproportionate weight

**Single-flight refresh against real token rotation.** Both the mock and the backend issue
single-use refresh tokens and revoke the session on replay. With `ACCESS_TOKEN_TTL_SECONDS=60`,
let the token expire, then open two list screens at once. The network tab must show **exactly
one** `POST /auth/refresh`, both requests must succeed, and the session must survive. Two
refreshes and a logout means the single-flight gate in `src/lib/api/session.ts` has regressed.

**The 401-replay fix against a real bodied request.** The whole-branch review found that a 401
on any request *with a body* threw while reconstructing the replay, discarded the request, and
cleared the session that had just been refreshed. It is fixed and covered under MSW — but MSW
is not what rotates tokens for real. Let the access token expire, then submit a sale. The sale
must land and the session must survive.

### Stopping rule

If a slice fails and cannot be resolved, work stops there rather than cascading. Later slices
build on earlier ones; chasing a checkout bug while auth is unreliable wastes the session. The
log records where it stopped and why.

### Recording

Each slice fills in its section of `docs/integration-log.md` (already stubbed). A slice is not
done until its section is written, **even when the entry is "no divergence found"** — a silent
section is indistinguishable from an unrun slice.

---

## 5. MVP acceptance

The MVP is reached when these run against the **live backend**, by hand, on real data.
Not "no divergences found" — these specific flows working.

| # | Flow | Passes when |
|---|---|---|
| 1 | Log in as each of the three roles | Each lands on its own home screen; a locked account is refused |
| 2 | Sell at the POS | Scan by SKU, attach a customer by phone, pay, receipt shows a real `HD…` number and the points earned |
| 3 | The sale is real | Stock dropped by what was sold; the invoice appears in Hóa đơn; the customer's points went up |
| 4 | Receive a purchase | A draft moves to Đã nhận, stock rises, a `PURCHASE` row appears in Biến động kho |
| 5 | Count stock | Recording a difference adjusts stock and writes an `ADJUSTMENT` movement with a reason |
| 6 | Reports reflect reality | Today's revenue report shows the sale from step 2, with the right total |
| 7 | Roles hold | A cashier sees no cost price and is refused at `/reports/revenue` and `/users` |
| 8 | Sessions survive | With a 60s access token, working past expiry refreshes once and does not log you out |

Flow 8 is listed last but is the one most likely to fail, because it is the only one that
exercises real token rotation. Flows 1–7 can all pass while 8 is broken, and a POS that
ejects the cashier every minute is not an MVP.

**Anything that fails here stops Phase 1.** Anything that merely *differs* from the mock,
without breaking a flow, is logged and carried into Phase 3.

---

## 6. The parity suite — Phase 3

**This comes after the MVP runs.** It is a quality investment, not a gate: a parity assertion
failing on a rule nobody demos is a logged finding, not a blocker.

One test file, run twice: once against the mock, once against live, with identical assertions.
A rule that passes on mock and fails on live *is* the integration bug, named precisely.

### Data-agnostic by construction

The suite creates its own fixtures through the API — a category, a product with known prices,
stock via a received purchase, a customer — using unique identifiers per run
(`PARITY-<timestamp>`). It therefore does not care that the backend's demo seed differs from
the mock's fixed seed, which is what makes it runnable against both.

### Assertions

| Rule | Assertion |
|---|---|
| BR7 | Per-line discounts sum back exactly to the invoice discount |
| BR7 | Cashier refused above 10%; admin accepted at the same value; `maxDiscountAmount` returned |
| BR6 | Points `= floor(total / 10000)` on the post-discount total; 0 with no customer attached |
| BR1 | Oversell → `409 INSUFFICIENT_STOCK` carrying `requested`/`available`, and nothing written |
| BR5 | Sale lines carry `skuSnapshot`, `nameSnapshot`, `unitCostSnapshot` |
| BR11 | Receiving at a different price yields weighted-average cost, rounded to 2 decimals |
| — | Payments must sum exactly to the total; a wrong sum → `422 INVALID_PAYMENT` |
| — | Invoice number matches `HD` + store-local `yyyyMMdd` + a 4-digit sequence |
| UC-04 E2 | A stale `expectedSystemQty` → `409 STOCK_CONFLICT`, with nothing adjusted |
| UC-02 E7 | Reprinting three times leaves one invoice and unmoved stock |
| Critical 2 | `to` exactly one day before `from` → `400 INVALID_DATE_RANGE` |

The final row is deliberate. The whole-branch review found the client-side guard let a
**one-day** inversion through, because the inclusive span is `0` rather than negative. That is
fixed in the frontend and the mock; if the backend shares the off-by-one, this assertion finds
it rather than a user finding it later.

### Running it

- `npm run test:parity` — against the mock; part of normal verification.
- `npm run test:parity:live` — against the backend; **skips with an explanatory message** when
  nothing answers on the base URL, so an absent backend never fails the suite for the wrong
  reason.

### Accepted cost

The API has no delete endpoints — BR10 is deactivate-only — so each live run leaves fixtures
behind. Unique identifiers keep runs independent, but a dev database accumulates `PARITY-*`
records over time. This is acceptable for a resettable dev database and is preferable to
building teardown the API does not support.

---

## 7. Divergence triage

Every difference sorts into exactly one bucket, and the bucket determines the owner.

| Bucket | How it is recognised | Action |
|---|---|---|
| **Contract drift** | `tsc` fails after regenerating types | Fix the frontend; the compiler names the call sites |
| **Mock is wrong** | Backend behaviour is defensible and the contract permits it | Fix `mocks/rules.ts` — a mock that lies is worse than none, because 153 unit and 61 e2e tests then encode the lie |
| **Backend is wrong** | Behaviour contradicts the SRS or the contract | Record and escalate. **Do not work around it in the frontend.** |

### Expected frontend changes: close to zero

The `lib/api` seam exists so that switching backends is an environment variable. If a *screen*
requires modification to work against live, that is itself a finding: the seam leaked, and the
fix belongs in `lib/api`, not in the screen.

### Items that stay on the backend's side of the line

| Item | Risk ID | Why the frontend cannot fix it |
|---|---|---|
| No idempotency key on `POST /sales` | ID-1 (S1) | The double-submit guard stops a double click; it cannot stop a lost response. Only a server-side key can. |
| `unitCostSnapshot` returned to cashiers | AZ-1 (S2) | The column is already hidden by role; the data still reaches the browser. |
| `GET /sales` not scoped to the calling cashier | AZ-2 (S2) | Filtering client-side would be security theatre — the data has already arrived. |

---

## 8. The mock's role after integration

The mock remains the **default** backend. It serves 153 unit tests and 61 end-to-end tests,
runs with no Docker and no database, and is what keeps the suite fast and deterministic. Live
is opt-in through `dev:live` and `test:parity:live`.

Integration does not retire the mock — it **calibrates** it. Every divergence resolved in the
mock's favour makes the mock a more accurate stand-in, which raises the value of every test
that runs against it.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Semantic drift the parity suite does not cover | The suite targets the arithmetic the SRS specifies. Anything found outside it gets an assertion added, so coverage grows with discovery. |
| Live runs accumulate fixtures in the dev database | Unique per-run identifiers; the database is resettable. Documented rather than engineered around. |
| Backend changes after integration | `openapi:check` exists in their repo; regenerating types makes drift a compile error on our side. |
| The backend's demo seed changes | The parity suite creates its own fixtures and does not depend on seeded data. |

---

## 10. Open questions

1. **Backend credentials.** `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` are set by whoever
   seeds the database. These need recording in `integration-log.md` once chosen.
2. **How the three escalations reach the backend developer.** GitHub issues on their repo, or
   informally? This spec records them; it does not assume a channel.
