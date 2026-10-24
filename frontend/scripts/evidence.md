# Tạo minh chứng kiểm thử cho Chương V

Bộ kiểm thử end-to-end vừa là kiểm thử, vừa là minh chứng cho báo cáo.

## Chạy

```bash
cd frontend
npm run test:e2e            # chạy toàn bộ, in bảng kết quả
npm run test:e2e:report     # chạy và mở báo cáo HTML
```

## Lấy minh chứng

1. **Bảng kết quả cho Chương V** — mở `frontend/e2e-report/index.html`.
   Mỗi test được đặt tên theo use case và luồng, ví dụ
   `UC-02 Bán hàng và thanh toán › E2: số lượng vượt tồn bị từ chối kèm số tồn hiện tại`,
   nên có thể dán thẳng vào bảng với các cột:

   | Mã UC | Luồng | Kỳ vọng | Kết quả |
   |-------|-------|---------|---------|

2. **Ảnh chụp màn hình cho Chương IV** — thư mục `frontend/e2e-evidence/`:

   | Tệp | Màn hình / tình huống |
   |-----|------------------------|
   | `uc02-hoa-don.png` | S03 POS — hóa đơn sau khi thanh toán, có điểm tích lũy |
   | `uc02-e2-thieu-ton.png` | S03 POS — cảnh báo không đủ tồn kèm nút sửa số lượng |
   | `uc02-e4-giam-gia.png` | S03 POS — giảm giá vượt hạn mức thu ngân |
   | `uc03-nhan-hang.png` | S09c — phiếu nhập sau khi xác nhận nhận hàng |
   | `uc04-kiem-ke.png` | S11 — ghi nhận kiểm kê và lịch sử |
   | `uc04-e2-xung-dot.png` | S11 — xung đột tồn kho giữa hai máy |
   | `uc05-doanh-thu.png` | S13a — báo cáo doanh thu |
   | `uc05-e2-khong-quyen.png` | S13a — thu ngân bị từ chối |

## Truy vết use case

| Use case | Tệp kiểm thử |
|----------|--------------|
| UC-01 Đăng nhập | `e2e/uc01-login.spec.ts` |
| UC-02 Bán hàng và thanh toán | `e2e/uc02-ban-hang.spec.ts` |
| UC-03 Nhập hàng | `e2e/uc03-nhap-hang.spec.ts` |
| UC-04 Kiểm kê | `e2e/uc04-kiem-ke.spec.ts` |
| UC-05 Xem báo cáo | `e2e/uc05-bao-cao.spec.ts` |

Các màn hình còn lại có kiểm thử riêng: `s02`, `s04`, `s05-s08`, `s06`, `s10`, `s14`.

## Kiểm thử đơn vị

```bash
npm run verify    # kiểm tra kiểu + toàn bộ unit test
```
