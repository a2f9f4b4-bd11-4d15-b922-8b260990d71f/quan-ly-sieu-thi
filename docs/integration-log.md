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
| 8 | **Phong bì lỗi** | `{ error: { code, message, details } }` | **`ErrorEnvelopeDto` phẳng**: `{ success:false, statusCode, code, message, data:null, details, requestId, timestamp }` | `readEnvelope()` trong `src/lib/api/errors.ts` và `fail()` trong `src/mocks/handlers/_shared.ts` |

> **Mục 8 là lỗi nghiêm trọng, chỉ lộ ra khi gọi API thật.** Frontend tự nghĩ ra lớp
> lồng `error`; mock cũng phát ra đúng hình dạng sai đó, nên 153 unit test và 61 e2e
> test đều mã hóa cái sai. Hậu quả: **mọi** mã lỗi từ backend đều rơi về
> `INTERNAL_ERROR` kèm thông báo chung — mất toàn bộ giao diện riêng cho
> `INSUFFICIENT_STOCK`, `INVALID_DISCOUNT`, `STOCK_CONFLICT`, `INVALID_PAYMENT`,
> `FORBIDDEN`, `VALIDATION_ERROR` và mọi `details` đi kèm. Slice 1 và 2 không phát
> hiện được vì chúng không chạm vào đường xử lý lỗi. Đã sửa cả frontend lẫn mock.

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
- [x] **Đạt.** Không phát hiện sai lệch.

| Kiểm tra | Kết quả |
|---|---|
| 8 màn hình danh sách | Đều có dữ liệu: sản phẩm, danh mục, NCC, khách hàng, tồn kho, biến động, phiếu nhập, nhân viên |
| Phân trang thật | 117 sản phẩm / 6 trang; tổng số bản ghi không đổi giữa các trang |
| Tìm kiếm | Lọc đúng; ô tìm kiếm `maxlength=100` |
| Chỉ nhập khoảng trắng | **Không** gửi request nào có `search=` |
| Giá vốn với thu ngân | Khóa `costPrice` **vắng mặt trong payload thật**, không chỉ ẩn trên giao diện |
| Chặn quyền bằng URL | `/reports/revenue`, `/users`, `/suppliers` → màn hình từ chối, **0 lần 403** |

### Slice 3 — `POST /sales`
- [x] **Đạt, sau khi sửa một lỗi nghiêm trọng ở frontend** (xem mục 2, dòng 8).

Số liệu quan sát thực tế (sản phẩm `DU-006`, đơn giá 10.000 đ, SL 3, giảm 997 đ):

| Quy tắc | Kỳ vọng | Thực tế |
|---|---|---|
| Tạm tính / phải trả | 30.000 / 29.003 | **khớp** |
| Số hóa đơn | `HD` + ngày giờ cửa hàng + 4 số | `HD202610280015` |
| BR6 tích điểm | `floor(29003/10000)` = 2 | **2** |
| BR7 phân bổ giảm giá | tổng các dòng = 997 | **997** |
| BR5 chụp dữ liệu | SKU, tên, giá vốn | **đủ cả ba** |
| Tồn kho sau bán | 41 → 38 | **khớp** |
| Điểm khách sau bán | 2 → 4 | **khớp** |
| BR1 bán vượt tồn | 409 + chi tiết từng sản phẩm, không ghi gì | `INSUFFICIENT_STOCK`, `requested:88 available:38`, tồn không đổi |
| Thanh toán không khớp | 422 | `INVALID_PAYMENT` |
| BR7 trần giảm giá thu ngân | 422 + mức tối đa | `INVALID_DISCOUNT`, `maxDiscountPercent:10, maxDiscountAmount:1000` |
| Cùng mức giảm với quản lý | Chấp nhận | 201 |
| In lại 3 lần | Tồn không đổi | 36 → 36 |

**Giới hạn của lần kiểm tra này**: chạy lúc 20:09 giờ VN, khi ngày giờ cửa hàng và
ngày UTC trùng nhau (`20261028`), nên số hóa đơn **chưa phân biệt được** hai cách
tính. Chỉ kiểm tra trong khoảng 00:00–07:00 giờ VN mới kết luận được.
Đồng hồ host và MySQL khớp nhau (cùng 13:09 UTC, `@@global.time_zone = +00:00`).

### Slice 4 — phiếu nhập, kiểm kê, báo cáo
- [x] **Đạt.** Không phát hiện sai lệch ngữ nghĩa.

| Quy tắc | Kỳ vọng | Thực tế |
|---|---|---|
| BR11 giá vốn bình quân gia quyền | `(46×8643,59 + 10×12965)/56` = **9415,27** | **9415,27** (khớp tới 2 chữ số thập phân) |
| Tồn sau nhận hàng | 46 → 56 | **khớp** |
| BR3 nhận hàng lần hai | Từ chối, tồn không đổi | `409 PURCHASE_ALREADY_RECEIVED` |
| UC-04 E2 kiểm kê lệch | 409 kèm cả hai con số | `STOCK_CONFLICT`, `expectedSystemQty:56, currentStockQty:55`, **không điều chỉnh gì** |
| Kiểm kê lại sau khi tải lại | Thành công | 201, tồn đúng |
| Báo cáo doanh thu hôm nay | Phản ánh các hóa đơn vừa tạo | 18 hóa đơn, 1.336.006 đ |
| Báo cáo tồn kho | Có số liệu | 117 sản phẩm, giá trị 112.453.241,91 đ, 10 mặt hàng dưới ngưỡng |
| Khoảng ngày đảo **một ngày** | 400 | `INVALID_DATE_RANGE` — **backend không dính lỗi off-by-one** mà frontend từng mắc |
| Khoảng quá 366 ngày | 400 | `INVALID_DATE_RANGE` |

**Lưu ý**: `POST /purchases/{id}/receive` trả **200** (không phải 201) — đúng theo hợp
đồng, vì nhận hàng không tạo tài nguyên mới.


---

## 6. Nghiệm thu MVP

Chạy bằng `npm run test:e2e:live` (trừ ghi chú thủ công). Tất cả **đạt**.

| # | Luồng | Kết quả | Bằng chứng |
|---|-------|---------|------------|
| 1 | Đăng nhập theo ba vai trò | Đạt | `admin`→`/`, `cashier`→`/pos`, `stockkeeper`→`/inventory`; `cashier.cu` bị từ chối |
| 2 | Bán hàng tại POS | Đạt | Hóa đơn `HD202610280015`, phân bổ giảm giá 997 đ khớp tuyệt đối |
| 3 | Giao dịch có thật | Đạt | Tồn 41→38, hóa đơn vào lịch sử, điểm khách 2→4 |
| 4 | Nhận hàng | Đạt | Tồn 46→56, giá vốn 8643,59→**9415,27** đúng bình quân gia quyền |
| 5 | Kiểm kê | Đạt | Lệch tồn → `STOCK_CONFLICT` (56 vs 55), không điều chỉnh; đếm lại thành công |
| 6 | Báo cáo phản ánh thực tế | Đạt | 18 hóa đơn / 1.336.006 đ trong ngày |
| 7 | Phân quyền | Đạt | Thu ngân không thấy giá vốn, bị chặn ở `/reports/revenue` và `/users`, **0 lần 403** |
| 8 | Phiên sống qua hạn token | Đạt | Hết hạn 60s → **đúng 1** lần refresh, không bị đăng xuất |

### Kiểm thử còn chạy lại được

```bash
npm run test:e2e:live    # 4 bài, phủ cả 8 luồng; tự bỏ qua nếu backend chưa chạy
```

Bộ kiểm thử trên mock **không phụ thuộc** backend: với backend tắt hoàn toàn,
`npm run verify` → 154/154 và `npm run test:e2e` → 61 đạt, 4 bỏ qua.
