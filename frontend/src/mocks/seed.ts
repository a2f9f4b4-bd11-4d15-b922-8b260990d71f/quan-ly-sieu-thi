import type { MockDb } from "./db";

const NOW = "2026-10-20T03:00:00.000Z";

const CATEGORY_NAMES = [
  "Nước giải khát", "Bánh kẹo", "Mì - Gạo", "Gia vị",
  "Sữa", "Hóa phẩm", "Đồ hộp", "Vệ sinh cá nhân",
];

const PRODUCT_SEED: Array<[string, string, string, number, number, number, number]> = [
  // sku, name, unit, salePrice, costPrice, stockQty, reorderLevel
  ["COCA-330", "Coca-Cola lon 330ml", "lon", 12000, 8000, 96, 24],
  ["PEPSI-330", "Pepsi lon 330ml", "lon", 11000, 7500, 8, 24],
  ["LAVIE-500", "Nước suối Lavie 500ml", "chai", 5000, 3200, 240, 48],
  ["OISHI-BG", "Bánh gạo Oishi 120g", "gói", 15000, 10500, 42, 12],
  ["CHOCO-PIE", "Chocopie hộp 12 cái", "hộp", 55000, 41000, 18, 6],
  ["HAOHAO-TC", "Mì Hảo Hảo tôm chua cay", "gói", 4500, 3100, 300, 60],
  ["GAO-ST25-5", "Gạo ST25 túi 5kg", "túi", 185000, 152000, 14, 5],
  ["NMAM-CN", "Nước mắm Chin-su 500ml", "chai", 38000, 28000, 26, 8],
  ["DAU-NEPTUNE", "Dầu ăn Neptune 1L", "chai", 62000, 49000, 20, 6],
  ["SUA-VNM-180", "Sữa tươi Vinamilk 180ml", "hộp", 8000, 5600, 144, 36],
  ["SUA-ONG-THO", "Sữa đặc Ông Thọ 380g", "lon", 27000, 20000, 3, 10],
  ["OMO-800", "Bột giặt Omo 800g", "túi", 52000, 40000, 22, 8],
  ["SUNLIGHT-750", "Nước rửa chén Sunlight 750ml", "chai", 34000, 25000, 30, 10],
  ["CA-HL-185", "Cá hộp Hạ Long 185g", "hộp", 24000, 17500, 36, 12],
  ["PS-TRA-XANH", "Kem đánh răng P/S trà xanh", "tuýp", 28000, 20500, 0, 6],
];

const CUSTOMER_SEED: Array<[string, string, number]> = [
  ["Nguyễn Thị Lan", "0901234567", 42],
  ["Trần Văn Minh", "0912345678", 17],
  ["Lê Thị Hoa", "0987654321", 8],
  ["Phạm Quốc Bảo", "0933221144", 103],
  ["Võ Thị Mai", "0978112233", 0],
];

export function seed(): MockDb {
  const categories = CATEGORY_NAMES.map((name, i) => ({
    id: i + 1, name, description: "", isActive: true, createdAt: NOW, updatedAt: NOW,
  }));

  const products = PRODUCT_SEED.map(
    ([sku, name, unit, salePrice, costPrice, stockQty, reorderLevel], i) => ({
      id: i + 1,
      categoryId: (i % CATEGORY_NAMES.length) + 1,
      category: { id: (i % CATEGORY_NAMES.length) + 1, name: CATEGORY_NAMES[i % CATEGORY_NAMES.length] },
      sku, barcode: `893${String(1000000 + i)}`, name, unit,
      salePrice, costPrice, stockQty, reorderLevel,
      isActive: true, createdAt: NOW, updatedAt: NOW,
    }),
  );

  return {
    users: [
      { id: 1, username: "admin", password: "admin123", fullName: "Nguyễn Thái Bình", role: "ADMIN", isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: 2, username: "thungan", password: "cashier123", fullName: "Lê Tuấn Linh", role: "CASHIER", isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: 3, username: "thukho", password: "stock123", fullName: "Quản Trọng Hùng", role: "STOCKKEEPER", isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: 4, username: "nghiviec", password: "locked123", fullName: "Nguyễn Danh Thái", role: "CASHIER", isActive: false, createdAt: NOW, updatedAt: NOW },
    ],
    categories,
    products,
    suppliers: [
      { id: 1, name: "Công ty TNHH Phân phối Miền Nam", phone: "02838220011", email: "sales@pmn.vn", address: "12 Lê Lợi, Q.1, TP.HCM", note: "", isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: 2, name: "Đại lý Tân Bình", phone: "0903344556", email: "", address: "45 Cộng Hòa, Tân Bình", note: "Giao thứ 3 và thứ 6", isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: 3, name: "NCC Ngừng hợp tác", phone: "0900000000", email: "", address: "", note: "", isActive: false, createdAt: NOW, updatedAt: NOW },
    ],
    customers: CUSTOMER_SEED.map(([fullName, phone, loyaltyPoints], i) => ({
      id: i + 1, customerCode: `KH${String(i + 1).padStart(6, "0")}`,
      fullName, phone, email: "", loyaltyPoints, createdAt: NOW, updatedAt: NOW,
    })),
    sales: [],
    purchases: [
      { id: 1, purchaseNo: "PN202610190001", supplierId: 1, createdBy: 3, status: "DRAFT",
        subtotal: 1_520_000, total: 1_520_000, note: "Bổ sung hàng cuối tuần",
        receivedAt: null, receivedBy: null, createdAt: "2026-10-19T02:00:00.000Z",
        items: [{ id: 1, productId: 7, quantity: 10, unitCost: 152_000, lineTotal: 1_520_000 }] },
    ],
    movements: [],
    stockCounts: [],
    sequences: {},
    tokens: {},
  } as MockDb;
}
