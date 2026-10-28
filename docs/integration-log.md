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

### Slice 1 — auth + products
- [ ] Chưa chạy. Chặn bởi: chưa có backend phản hồi.

### Slice 2 — danh sách chỉ đọc (danh mục, NCC, khách hàng, tồn kho)
- [ ] Chưa chạy.

### Slice 3 — `POST /sales`
- [ ] Chưa chạy. **Slice quan trọng nhất**: chỉ slice này mới phát hiện được sai lệch
      *ngữ nghĩa* mà mock không thể bắt — làm tròn, phân bổ giảm giá, quy tắc
      tích điểm, định dạng số chứng từ.

### Slice 4 — phiếu nhập, kiểm kê, báo cáo
- [ ] Chưa chạy.
