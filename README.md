# Quản lý siêu thị — Đề 09

Hệ thống quản lý siêu thị mini: bán hàng tại quầy, quản lý hàng hóa và tồn kho, nhập hàng,
khách hàng thân thiết và báo cáo doanh thu.

Repo này chứa **frontend** (Next.js) cùng toàn bộ tài liệu phân tích — thiết kế. Backend
(NestJS + Prisma + MySQL) nằm ở repo riêng; frontend chạy độc lập được nhờ một mock có
trạng thái ngay trong trình duyệt.

```bash
cd frontend
cp .env.example .env.local
npm install && npm run dev        # http://localhost:3000
```

Đăng nhập: `admin` / `admin123` · `thungan` / `cashier123` · `thukho` / `stock123`

---

## Tính năng

Ba vai trò: **Quản lý** (toàn quyền), **Nhân viên bán hàng** (bán hàng, khách hàng),
**Nhân viên kho** (nhập hàng, tồn kho). Phân quyền kiểm tra ở máy chủ.

### Bán hàng tại quầy

Quét mã vạch hoặc SKU, thêm vào giỏ, gắn khách hàng, áp giảm giá trong hạn mức của vai
trò, thanh toán **nhiều phương thức** (tiền mặt / thẻ / chuyển khoản), in hóa đơn.

Toàn bộ thao tác chốt đơn chạy trong **một giao dịch**: kiểm tồn → chụp giá bán và giá vốn
từng dòng → phân bổ giảm giá → ghi hóa đơn → trừ tồn → ghi biến động kho → cộng điểm.
Thiếu tồn thì báo rõ *"còn 8, đang bán 20"* kèm nút sửa nhanh, và không ghi gì cả.

### Hàng hóa và tồn kho

Danh mục sản phẩm với SKU, mã vạch, đơn vị tính, giá bán và ngưỡng cảnh báo. Xem tồn hiện
tại, cảnh báo **sắp hết hàng**, và **kiểm kê** có phát hiện xung đột — nếu tồn thay đổi
trong lúc đang đếm, hệ thống từ chối và bắt xác nhận lại thay vì ghi đè. Mọi thay đổi tồn
đều vào **sổ biến động kho** kèm chứng từ và người thực hiện.

### Nhập hàng

Lập phiếu nhập theo nhà cung cấp, lưu nháp rồi xác nhận sau. **Chỉ thao tác xác nhận nhận
hàng mới làm tăng tồn** — đồng thời tính lại **giá vốn bình quân gia quyền**. Phiếu đã nhận
là bản ghi lịch sử: không sửa, không nhận lại, không xóa.

### Khách hàng

Tra cứu theo số điện thoại hoặc mã khách ngay tại quầy, gắn vào hóa đơn, **tự động cộng
điểm** sau khi thanh toán thành công (1 điểm cho mỗi 10.000 đ, làm tròn xuống).

### Báo cáo

Doanh thu theo ngày/tháng, sản phẩm bán chạy, **lợi nhuận gộp** (doanh thu trừ giá vốn đã
chụp lúc bán), và giá trị tồn kho. Giá vốn được chụp tại thời điểm bán nên đổi giá hôm nay
không làm sai lệch báo cáo quá khứ.

### Quản trị

Tạo tài khoản nhân viên, gán vai trò, khóa/mở khóa. Không có xóa cứng ở bất kỳ đâu — mọi
thứ đều là *ngừng hoạt động* để giữ lịch sử giao dịch.

> Chi tiết từng màn hình, đường dẫn, vai trò truy cập và truy vết tới mã SRS (F1–F10):
> [`frontend/README.md`](frontend/README.md#tính-năng)

---

## Cấu trúc repo

| Đường dẫn | Nội dung |
|-----------|----------|
| `frontend/` | Ứng dụng Next.js + mock backend. 153 unit test, 60 kiểm thử đầu-cuối. |
| `openapi.json` | Hợp đồng API — **nguồn sự thật**. |
| `api-types.ts` | Kiểu TypeScript sinh tự động từ hợp đồng. Không sửa tay. |
| `api_integration_guide.md` | Hình dạng request/response, luồng token, mã lỗi. |
| `api_usage_guide.md` | API nào dùng khi nào, ở màn hình nào, ai được gọi. |
| `docs/integration-log.md` | **Cần đọc trước khi tích hợp**: 7 sai lệch hợp đồng đã phát hiện, 4 câu hỏi cho backend. |
| `edge-cases-and-failure-modes.md` | Sổ rủi ro: 67 tình huống biên, đã phân loại mức độ. |
| `docs/superpowers/specs/` | Đặc tả thiết kế frontend. |
| `docs/superpowers/plans/` | Kế hoạch triển khai. |
| `Báo cáo đồ án CNPM_Đề 09…docx` | Tài liệu phân tích — thiết kế (SRS). |

## Trạng thái

Mười lăm màn hình đã chạy được trên mock. **Chưa tích hợp với backend thật** — xem
[`docs/integration-log.md`](docs/integration-log.md).

Còn thiếu phần **sửa** của bốn chức năng (F2 nhân viên, F3 sản phẩm và danh mục, F4 nhà
cung cấp, F7 khách hàng), phần **thêm** của F3, và sửa phiếu nhập nháp. Tầng dữ liệu và
mock đã sẵn sàng cho tất cả — chi tiết ở [`frontend/README.md`](frontend/README.md#chưa-làm).
