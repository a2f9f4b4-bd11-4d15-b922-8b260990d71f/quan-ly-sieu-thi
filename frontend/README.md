# Frontend — Quản lý siêu thị

Giao diện web cho hệ thống quản lý siêu thị mini (Đề 09). Next.js 16 + React 19 +
TypeScript, gọi REST API đã có sẵn. Toàn bộ 15 màn hình chạy được **không cần backend**
nhờ một mock có trạng thái chạy ngay trong trình duyệt.

- Thiết kế: [`../docs/superpowers/specs/2026-10-20-supermarket-frontend-design.md`](../docs/superpowers/specs/2026-10-20-supermarket-frontend-design.md)
- Nhật ký tích hợp: [`../docs/integration-log.md`](../docs/integration-log.md)
- Minh chứng kiểm thử: [`scripts/evidence.md`](scripts/evidence.md)

## Chạy lần đầu

```bash
cp .env.example .env.local    # BẮT BUỘC — thiếu tệp này thì mock không khởi động
npm install
npm run dev                   # http://localhost:3000
```

## Tài khoản demo (chế độ mock)

| Tên đăng nhập | Mật khẩu | Vai trò | Vào thẳng |
|---------------|----------|---------|-----------|
| `admin` | `admin123` | Quản lý | Trang chủ |
| `thungan` | `cashier123` | Nhân viên bán hàng | POS |
| `thukho` | `stock123` | Nhân viên kho | Tồn kho |
| `nghiviec` | `locked123` | (đã khóa) | — bị từ chối |

Góc dưới bên phải có thanh công cụ chỉ hiện ở chế độ mock: **403 / 409 / 503** ép lời gọi
API kế tiếp thất bại, **Reset dữ liệu demo** đưa dữ liệu về trạng thái gốc. Dữ liệu mock
lưu ở `localStorage`, dùng chung giữa các tab — nên hai cửa sổ mô phỏng được hai máy bán hàng.

---

## Tính năng

Mã **F1–F10** là mã chức năng trong SRS; cột cuối cho biết phần nào đã làm xong.

### Bán hàng

| Màn hình | Đường dẫn | Vai trò | Nội dung | SRS |
|----------|-----------|---------|----------|-----|
| POS bán hàng | `/pos` | Quản lý, Thu ngân | Quét mã vạch/SKU, giỏ hàng, gắn khách, giảm giá theo hạn mức vai trò, thanh toán nhiều phương thức, in hóa đơn | F6 ✅ |
| Hóa đơn | `/sales` | Quản lý, Thu ngân | Lịch sử, lọc theo số hóa đơn / phương thức / khoảng ngày; mở chi tiết và **in lại** | F6, F10 ✅ |
| Khách hàng | `/customers` | Quản lý, Thu ngân | Danh sách, tìm theo tên/mã/SĐT, thêm khách, xem điểm tích lũy | F7 ⚠️ *thiếu sửa* |

**Quy trình thanh toán** chạy trong một giao dịch: khóa sản phẩm → kiểm tồn → chụp
tên/SKU/giá bán/giá vốn từng dòng → phân bổ giảm giá → kiểm tiền → ghi hóa đơn → trừ tồn →
ghi biến động kho → cộng điểm. Lỗi bất kỳ bước nào thì không ghi gì cả.

### Hàng hóa và tồn kho

| Màn hình | Đường dẫn | Vai trò | Nội dung | SRS |
|----------|-----------|---------|----------|-----|
| Sản phẩm | `/products` | Xem: cả 3 · Sửa: Quản lý, Kho | Danh sách, tìm theo tên/SKU/mã vạch, lọc danh mục, ngừng bán / bán lại | F3 ⚠️ *thiếu thêm + sửa* |
| Danh mục | `/categories` | Xem: cả 3 · Sửa: Quản lý, Kho | Danh sách, ngừng dùng / dùng lại | F3 ⚠️ *thiếu thêm + sửa* |
| Tồn kho | `/inventory` | Cả 3 (cảnh báo: Quản lý, Kho) | Tồn hiện tại, tab **Sắp hết hàng** theo ngưỡng cảnh báo | F9 ✅ |
| Kiểm kê | `/inventory/counts` | Quản lý, Kho | Đếm thực tế, bắt buộc nhập lý do, **phát hiện xung đột** khi tồn đã đổi | F9 ✅ |
| Biến động kho | `/inventory/movements` | Quản lý, Kho | Sổ mọi thay đổi tồn: nhập / bán / điều chỉnh, kèm chứng từ và người thực hiện | F9 ✅ |

### Nhập hàng

| Màn hình | Đường dẫn | Vai trò | Nội dung | SRS |
|----------|-----------|---------|----------|-----|
| Phiếu nhập | `/purchases` | Quản lý, Kho | Danh sách, lọc theo trạng thái Nháp / Đã nhận / Đã hủy | F5 ✅ |
| Tạo phiếu nhập | `/purchases/new` | Quản lý, Kho | Chọn NCC, thêm dòng hàng, lưu nháp hoặc lưu và nhận luôn | F5 ✅ |
| Chi tiết phiếu | `/purchases/[id]` | Quản lý, Kho | Xác nhận nhận hàng, hủy phiếu nháp | F5 ⚠️ *thiếu sửa nháp* |
| Nhà cung cấp | `/suppliers` | Quản lý, Kho | Danh sách, tìm kiếm, thêm, ngừng hợp tác | F4 ⚠️ *thiếu sửa* |

**Xác nhận nhận hàng** là thao tác duy nhất làm tăng tồn: chuyển `DRAFT → RECEIVED`, cộng
tồn, tính lại **giá vốn bình quân gia quyền**, ghi biến động. Phiếu đã nhận không sửa,
không nhận lại, không xóa.

### Báo cáo

| Màn hình | Đường dẫn | Vai trò | Nội dung | SRS |
|----------|-----------|---------|----------|-----|
| Doanh thu | `/reports/revenue` | Quản lý | Theo ngày hoặc tháng: số hóa đơn, tiền hàng, giảm giá, doanh thu thuần | F8 ✅ |
| Sản phẩm bán chạy | `/reports/top-products` | Quản lý | Xếp hạng theo số lượng hoặc doanh thu | F8 ✅ |
| Lợi nhuận gộp | `/reports/gross-profit` | Quản lý | Doanh thu trừ giá vốn **chụp lúc bán**, kèm tỷ suất | F8 ✅ |
| Tồn kho | `/reports/inventory` | Quản lý, Kho | Giá trị tồn, nhập/xuất/điều chỉnh trong kỳ, cảnh báo tồn thấp | F8 ✅ |

Mọi báo cáo bắt buộc cả hai đầu ngày, `đến ngày` tính cả ngày đó, tối đa **366 ngày** —
kiểm tra ngay ở client nên khoảng sai không gửi request nào.

### Hệ thống

| Màn hình | Đường dẫn | Vai trò | Nội dung | SRS |
|----------|-----------|---------|----------|-----|
| Đăng nhập | `/login` | Công khai | Xác thực, điều hướng theo vai trò, từ chối tài khoản bị khóa | F1 ✅ |
| Trang chủ | `/` | Cả 3 (nội dung khác nhau) | Doanh thu hôm nay, cảnh báo tồn, hóa đơn gần đây, phiếu nháp | F8, F9 ✅ |
| Nhân viên | `/users` | Quản lý | Thêm tài khoản, gán vai trò, khóa / mở khóa | F2 ⚠️ *thiếu sửa* |
| Hồ sơ | `/profile` | Cả 3 | Thông tin tài khoản, đăng xuất | F1 ✅ |

**Phân quyền** kiểm tra ở máy chủ; giao diện chỉ ẩn cho gọn. Gõ thẳng đường dẫn không có
quyền sẽ ra màn hình "Không có quyền truy cập", và màn hình đó **không gọi API** nào.

### Quy tắc nghiệp vụ đã hiện thực

| Mã | Quy tắc | Thấy ở đâu |
|----|---------|------------|
| BR1 | Không bán vượt tồn | POS báo "còn N, đang bán M" kèm nút sửa nhanh |
| BR3 | Chỉ `DRAFT → RECEIVED` mới tăng tồn | Phiếu đã nhận mất hết nút thao tác |
| BR5 | Chụp giá bán và giá vốn lúc bán | Chi tiết hóa đơn giữ nguyên dù giá sản phẩm đổi |
| BR6 | 1 điểm / 10.000 đ, làm tròn xuống | Hóa đơn 36.000 đ → 3 điểm |
| BR7 | Giảm giá: thu ngân 10%, quản lý 100% | Thu ngân vượt mức → báo mức tối đa |
| BR9 | SKU, mã vạch, SĐT là duy nhất | Lỗi hiện ngay trên đúng trường |
| BR10 | Ngừng hoạt động thay vì xóa | Không có nút xóa ở bất kỳ đâu |
| BR11 | Giá vốn bình quân gia quyền khi nhận hàng | Nhận 14 @ 180.000 lên 14 @ 152.000 → 166.000 |

---

## Lệnh

| Lệnh | Việc |
|------|------|
| `npm run dev` | Chạy ở chế độ mock |
| `npm run dev:live` | Chạy với API thật. Đổi host: `API_URL=http://10.0.0.5:3001 npm run dev:live` |
| `npm run verify` | Kiểm tra kiểu (`tsc --noEmit`) + toàn bộ unit test. **Chạy trước mỗi commit.** |
| `npm run test:e2e` | Playwright, toàn bộ luồng UC-01…UC-05 |
| `npm run test:e2e:report` | Như trên, kèm báo cáo HTML |
| `npm run test:e2e:live` | 4 bài trên **API thật**, phủ 8 luồng nghiệm thu. Tự bỏ qua nếu backend chưa chạy |
| `npm run screenshots` | Sinh lại ảnh trong `docs/screenshots/`. Chỉ chạy khi chủ động muốn |
| `npm run build` | Build production |

> Playwright dùng lại server đang mở ở cổng 3000. Nếu còn `npm run dev:live` chạy nền,
> `npm run test:e2e` sẽ âm thầm chạy ở **chế độ live** chứ không phải mock. Kiểm tra
> cổng 3000 trống trước khi tin vào kết quả một lần chạy.

Hiện có **154 unit test**, **60 kiểm thử đầu-cuối trên mock** và **4 kiểm thử trên API thật**.

`npm run test:e2e` cho **60 passed, 5 skipped**. Năm bài skip là bình thường: 4 bài
`live-smoke` cần API thật, 1 bài chụp ảnh chỉ chạy qua `npm run screenshots`.

## Cấu trúc

```
src/
  lib/api/      Ranh giới DUY NHẤT nói chuyện với máy chủ: client, session, errors.
                Không nơi nào khác được dùng fetch hay biết tới token.
  lib/query/    Khóa cache và bảng invalidation sau mỗi mutation.
  lib/auth/     Ma trận quyền, context đăng nhập, <RequireRole>.
  lib/format/   Tiền VND và quy đổi UTC → giờ cửa hàng. Mọi ngày giờ đi qua đây.
  features/     Hook dữ liệu theo nghiệp vụ.
  components/   DataTable, ResourceForm, Money, DateTime, POS.
  mocks/        Backend giả có trạng thái: db, seed, rules (BR1–BR11), handlers.
  app/          Màn hình, một thư mục mỗi route.
```

## Quy tắc bắt buộc khi sửa code

Những điểm này đã gây lỗi thật trong quá trình xây dựng:

1. **Không bao giờ tự động thử lại mutation.** `POST /sales` không có khóa idempotency —
   thử lại là tạo hóa đơn thứ hai và trừ tồn hai lần. `Providers.tsx` đặt `retry: false`.
2. **Mọi mốc thời gian render qua `<DateTime>`**, mọi số tiền qua `<Money>`. Máy chủ trả
   UTC; cửa hàng ở `Asia/Ho_Chi_Minh`. Tự format là sai ngày nghiệp vụ.
3. **Phân nhánh theo `AppError.code`, không bao giờ theo `message`.**
4. **Chặn cả truy vấn, không chỉ giao diện.** Màn hình không được gọi API mà vai trò hiện
   tại không có quyền — dùng `enabled` của hook. `e2e/no-forbidden-requests.spec.ts` kiểm
   tra điều này cho mọi màn hình × vai trò.
5. **Không sửa `../api-types.ts`** — tệp sinh tự động từ `openapi.json`. Sinh lại khi hợp
   đồng đổi; lỗi biên dịch chính là cảnh báo sớm.
6. **Không ghi đè `next.config.ts`** — `cacheComponents` là bắt buộc cho
   `export const instant = false`. Chỉ sửa, đừng viết lại.
7. **Mock phải phát ra đúng hình dạng trong hợp đồng, không phải hình dạng ta tưởng.**
   Phong bì lỗi là **phẳng** (`{ success:false, statusCode, code, message, data, details,
   requestId, timestamp }`). Frontend từng tự nghĩ ra lớp lồng `error`, mock phát ra đúng
   cái sai đó, nên toàn bộ test đều xanh trong khi mọi mã lỗi từ API thật rơi về
   `INTERNAL_ERROR`. Khi nghi ngờ hình dạng, đọc `openapi.json` — đừng suy đoán.

## Chưa làm

Theo SRS, bốn chức năng còn thiếu phần **sửa**; tầng dữ liệu và mock đã sẵn sàng cho tất cả:

| SRS | Còn thiếu |
|-----|-----------|
| F2 | Sửa thông tin nhân viên; nút đặt lại mật khẩu |
| F3 | **Thêm** và **sửa** sản phẩm, danh mục |
| F4 | Sửa nhà cung cấp |
| F7 | Sửa khách hàng |
| §5.3 | Sửa phiếu nhập còn ở trạng thái nháp |

Ngoài ra:

- **Đã tích hợp xong với backend thật** (giai đoạn 1): cả 8 luồng nghiệm thu đều đạt trên
  dữ liệu thật. Xem [`../docs/integration-log.md`](../docs/integration-log.md) để biết 8 sai
  lệch hợp đồng đã xử lý và 4 câu hỏi còn chờ backend trả lời.
- Ảnh `docs/screenshots/trang-chu.png` đang trống vì chụp trúng lúc dữ liệu đang tải —
  lỗi đã biết của khâu chụp ảnh, không phải lỗi chức năng.
- Giỏ hàng POS không lưu lại khi đóng tab; giá do máy chủ chốt lúc thanh toán.
- Không có hủy/hoàn hóa đơn, không quản lý lô và hạn sử dụng, không bán hàng cân lẻ —
  đều nằm ngoài phạm vi phiên bản đầu theo SRS.
