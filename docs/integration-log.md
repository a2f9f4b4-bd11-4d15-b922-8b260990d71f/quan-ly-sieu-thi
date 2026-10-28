# Nhật ký tích hợp frontend ↔ backend

Ghi lại mọi khác biệt phát hiện giữa **mock** (frontend) và **API thật** (backend).
Mỗi mục nêu rõ: phát hiện ở đâu, bên nào sai, và tệp cần sửa.

> Trạng thái: **Slice 1 chưa chạy được** — chưa có backend nào phản hồi ở
> `localhost:3001` (đã dò 3001, 3333, 4000, 5000, 8000, 8080, 9000).
> Phần dưới mục 1 là các sai lệch đã phát hiện **từ `openapi.json`** trong lúc
> xây frontend, chưa được xác nhận với server đang chạy.

---

## 1. Cách chạy slice 1

```bash
cd frontend
API_URL=http://<backend-host>:<port> npm run dev:live
```

> Next **không** đọc `.env.live`; biến môi trường phải đặt ngay trên dòng lệnh
> (hoặc sửa `scripts.dev:live` trong `package.json`).

Kiểm tra theo thứ tự:

1. **Đăng nhập** bằng tài khoản thật → phải chuyển trang theo vai trò, tên hiện ở thanh bên.
2. **Làm mới token**: mở DevTools, xóa `accessToken` trong
   `localStorage["mini-store.session"]`, rồi mở hai màn hình danh sách cùng lúc.
   Kỳ vọng: **đúng một** request `POST /auth/refresh` trong tab Network, cả hai
   request đều thành công. Nếu thấy **hai** lần refresh và bị đăng xuất thì
   cơ chế single-flight ở `src/lib/api/session.ts` đã hỏng.
3. **`GET /products`**: dữ liệu thật, phân trang và tìm kiếm hoạt động.
4. **Đăng nhập bằng tài khoản thu ngân**: phản hồi `/products` **không được** có
   khóa `costPrice`.

Sinh lại kiểu dữ liệu trước khi chạy:

```bash
cd /home/karpy/Lab/m1
npx openapi-typescript http://<backend-host>:<port>/api/docs-json -o api-types.ts
cd frontend && npm run verify
```

Lỗi biên dịch ở bước này **là tín hiệu cảnh báo sớm đang hoạt động** — hợp đồng
đã đổi, và dòng lỗi chỉ đúng nơi cần sửa.

---

## 2. Sai lệch đã phát hiện khi xây frontend (từ `openapi.json`)

Tất cả đã được sửa ở phía frontend. Cần **xác nhận lại với server thật** vì mock
được viết theo `openapi.json`, không theo code backend.

| # | Hạng mục | Kế hoạch ban đầu giả định | Hợp đồng thực tế | Đã sửa ở |
|---|----------|---------------------------|------------------|----------|
| 1 | Phong bì danh sách | `{ data: { items, meta } }` | `{ success, statusCode, code, message, data: T[], meta, requestId, timestamp }` — **`meta` ngang hàng với `data`** | `unwrapList()` trong `src/lib/api/client.ts` |
| 2 | Phong bì chi tiết | như trên | `data: T`, **không có `meta`** | `unwrap()` |
| 3 | Người dùng trong phiên | `UserResponse` | `SessionUserResponse` = `{id, username, fullName, role}`, **không có** `isActive`/`createdAt`/`updatedAt` | `src/lib/api/session.ts` |
| 4 | Đặt lại mật khẩu | body `{ password }`, trả `{ success }` | body `{ newPassword }`, phong bì **không có trường `data`** | `unwrapVoid()`, `src/features/users/api.ts` |
| 5 | Biến động kho | `type`, `quantity` | `movementType`, `quantityChange`, kèm `product`/`creator` lồng nhau | `src/features/inventory/api.ts` |
| 6 | Dòng hóa đơn in | `skuSnapshot`, `nameSnapshot`, có `id` | `sku`, `name`, **không có `id`**; `payments` cũng không có `id` | `src/components/pos/ReceiptDialog.tsx` |
| 7 | Tạo phiếu kiểm kê | trả thẳng bản ghi kiểm kê | `StockCountResultResponse` = `{ stockCount, product }` | `src/features/inventory/api.ts` |

---

## 3. Câu hỏi cần backend xác nhận

| # | Câu hỏi | Vì sao quan trọng | Mock hiện làm gì |
|---|---------|-------------------|------------------|
| 1 | `LAST_ACTIVE_ADMIN` có chặn **đổi vai trò** của quản lý cuối cùng không, hay chỉ chặn khóa tài khoản? | Nếu không chặn, một thao tác `PATCH` có thể khiến cửa hàng mất toàn bộ quyền quản trị vĩnh viễn (AZ-6 trong sổ rủi ro) | Mock **có** chặn — nghiêm hơn hợp đồng |
| 2 | `GET /sales` có giới hạn theo thu ngân đang đăng nhập không? | Nếu không, mọi thu ngân đều dựng lại được doanh thu toàn cửa hàng (AZ-2) | Mock **không** giới hạn — trả tất cả |
| 3 | Số hóa đơn `HDyyyyMMddNNNN` dùng ngày **giờ cửa hàng** hay **UTC**? | Nếu dùng UTC, mọi hóa đơn từ 00:00–07:00 giờ VN mang ngày hôm trước (TM-2) | Mock dùng **giờ cửa hàng** (`Asia/Ho_Chi_Minh`) |
| 4 | `PATCH /products/{id}` có kiểm tra lại `categoryId` khi giá trị không đổi không? | Nếu có, không sửa được sản phẩm thuộc danh mục đã ngừng dùng (LC-3) | Mock chỉ kiểm tra khi `categoryId` được gửi lên |

---

## 4. Khoảng trống chỉ backend sửa được

Frontend đã làm hết phần của mình; hai mục này **không** khắc phục được từ phía client:

| # | Vấn đề | Mã rủi ro | Frontend đang làm gì |
|---|--------|-----------|----------------------|
| 1 | `POST /sales` **không có khóa idempotency** — mất phản hồi do timeout có thể tạo hóa đơn thứ hai và trừ tồn hai lần | ID-1 (S1) | Chặn nhấn đúp (`disabled` khi đang gửi) và **không bao giờ** tự động thử lại mutation. Không đủ để chống mất phản hồi. |
| 2 | `GET /sales/{id}` vẫn trả `unitCostSnapshot` cho `CASHIER` | AZ-1 (S2) | Ẩn cột giá vốn theo vai trò; dữ liệu **vẫn** về tới trình duyệt. Chỉ chặn ở server mới xử lý được. |

---

## 5. Nhật ký các slice

### Môi trường

- Backend: `tuanlinh1997/api-mini-store` @ `ea21e93` (clone tại `/home/karpy/Lab/api-mini-store`)
- Frontend: `m1` @ `4ced98e` (nhánh `feat/backend-integration`)
- Ngày tích hợp: 2026-10-28
- API: http://localhost:3001 · Swagger: http://localhost:3001/api/docs
- Tài khoản quản trị (seed): `admin` / `Admin-Mvp-2026`
- Mật khẩu dữ liệu demo: `Demo-Mvp-2026`
- `ACCESS_TOKEN_TTL_SECONDS=60` để kiểm tra làm mới token bằng tay
- `CORS_ORIGINS=http://localhost:3000` (mặc định của backend là 5173,3001 — không có origin của ta)
- **Cách chạy thực tế**: `docker compose up -d mysql` + chạy API bằng npm (xem Ruling T3).
  Dockerfile dùng `RUN --mount=type=cache` nên cần BuildKit; máy này không có `docker buildx`.
- Dữ liệu: `npm run prisma:seed` rồi `npm run seed:demo -- --reset`
  → 117 sản phẩm, 1200 hóa đơn, 60 khách, 54 phiếu nhập, 14 mặt hàng dưới ngưỡng
- Tài khoản đăng nhập được (đã kiểm chứng):
  `admin`/`Admin-Mvp-2026` · `cashier`, `stockkeeper`, `cashier2`/`Demo-Mvp-2026`
  (`cashier.cu` bị khóa — dùng để kiểm thử từ chối đăng nhập)
- `GET /api/v1/health` → 200; API listening on http://127.0.0.1:3001/api/v1
- Sinh lại `api-types.ts` từ `http://localhost:3001/api/docs-json`: **giống hệt** bản đã commit
- `npm run verify` sau khi sinh lại: 153/153 xanh

### Slice 1 — auth + products
- [x] **Đạt.** Không phát hiện sai lệch giữa mock và API thật.

| Kiểm tra | Kết quả |
|---|---|
| CORS cho `GET` | `access-control-allow-origin: http://localhost:3000` |
| CORS preflight cho `POST /sales` | 204, cho phép `POST` và header `Authorization` |
| Điều hướng theo vai trò | `admin`→`/` · `cashier`→`/pos` · `stockkeeper`→`/inventory` |
| Sai mật khẩu | Một thông báo chung, không lộ tài khoản có tồn tại hay không |
| Tài khoản bị khóa (`cashier.cu`) | Bị từ chối |
| Làm mới token single-flight | Hết hạn 60s → **đúng 1** lần `POST /auth/refresh`, không bị đăng xuất |
| Phát lại request có body sau 401 | `POST /sales` 2 lần (lần 2 là replay), 1 refresh, hóa đơn `HD202610280013` **được tạo**, phiên còn nguyên |

**Lưu ý vận hành**: giới hạn đăng nhập 5 lần/60 giây/IP. Khi chạy nhiều kiểm thử
đăng nhập liên tiếp sẽ gặp `429`, biểu hiện **giống hệt sai mật khẩu**. Đã gặp
trong lúc kiểm thử; chờ hết 60 giây là bình thường trở lại.

### Slice 2 — danh sách chỉ đọc (danh mục, NCC, khách hàng, tồn kho)
- [ ] Chưa chạy.

### Slice 3 — `POST /sales`
- [ ] Chưa chạy. **Slice quan trọng nhất**: chỉ slice này mới phát hiện được sai lệch
      *ngữ nghĩa* mà mock không thể bắt — làm tròn, phân bổ giảm giá, quy tắc
      tích điểm, định dạng số chứng từ.

### Slice 4 — phiếu nhập, kiểm kê, báo cáo
- [ ] Chưa chạy.
