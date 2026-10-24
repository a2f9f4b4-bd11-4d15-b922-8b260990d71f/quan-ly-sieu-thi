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

## Lệnh

| Lệnh | Việc |
|------|------|
| `npm run dev` | Chạy ở chế độ mock |
| `npm run dev:live` | Chạy với API thật. Đổi host: `API_URL=http://10.0.0.5:3001 npm run dev:live` |
| `npm run verify` | Kiểm tra kiểu (`tsc --noEmit`) + toàn bộ unit test. **Chạy trước mỗi commit.** |
| `npm run test:e2e` | Playwright, toàn bộ luồng UC-01…UC-05 |
| `npm run test:e2e:report` | Như trên, kèm báo cáo HTML |
| `npm run build` | Build production |

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

## Giới hạn đã biết

- Chưa tích hợp với backend thật (xem `../docs/integration-log.md`).
- Chưa có form **sửa** cho sản phẩm, danh mục, nhà cung cấp, khách hàng, nhân viên; chưa
  có form **thêm** cho sản phẩm và danh mục; chưa có nút đặt lại mật khẩu và sửa phiếu nhập nháp.
  Tầng dữ liệu và mock đã sẵn sàng cho tất cả các thao tác này.
- Giỏ hàng POS không lưu lại khi đóng tab; giá được máy chủ chốt lúc thanh toán.
