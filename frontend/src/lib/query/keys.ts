export const qk = {
  auth: { me: () => ["auth", "me"] as const },
  products: {
    all: () => ["products"] as const,
    list: (params: unknown) => ["products", "list", params] as const,
    detail: (id: number) => ["products", "detail", id] as const,
    lookup: (code: string) => ["products", "lookup", code] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    list: (params: unknown) => ["categories", "list", params] as const,
  },
  suppliers: {
    all: () => ["suppliers"] as const,
    list: (params: unknown) => ["suppliers", "list", params] as const,
  },
  customers: {
    all: () => ["customers"] as const,
    list: (params: unknown) => ["customers", "list", params] as const,
    detail: (id: number) => ["customers", "detail", id] as const,
    lookup: (q: string) => ["customers", "lookup", q] as const,
  },
  users: {
    all: () => ["users"] as const,
    list: (params: unknown) => ["users", "list", params] as const,
  },
  sales: {
    all: () => ["sales"] as const,
    list: (params: unknown) => ["sales", "list", params] as const,
    detail: (id: number) => ["sales", "detail", id] as const,
    receipt: (id: number) => ["sales", "receipt", id] as const,
  },
  purchases: {
    all: () => ["purchases"] as const,
    list: (params: unknown) => ["purchases", "list", params] as const,
    detail: (id: number) => ["purchases", "detail", id] as const,
  },
  inventory: {
    all: () => ["inventory"] as const,
    stock: (params: unknown) => ["inventory", "stock", params] as const,
    lowStock: (params: unknown) => ["inventory", "low-stock", params] as const,
    movements: (params: unknown) => ["inventory", "movements", params] as const,
    counts: (params: unknown) => ["inventory", "counts", params] as const,
  },
  reports: {
    all: () => ["reports"] as const,
    revenue: (params: unknown) => ["reports", "revenue", params] as const,
    topProducts: (params: unknown) => ["reports", "top-products", params] as const,
    grossProfit: (params: unknown) => ["reports", "gross-profit", params] as const,
    inventory: (params: unknown) => ["reports", "inventory", params] as const,
  },
} as const;
