import type { paths, components } from "@contract";

export type { paths, components };

export type Schemas = components["schemas"];
export type ErrorCode = Schemas["ErrorCode"];
export type Role = Schemas["Role"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type PurchaseStatus = Schemas["PurchaseStatus"];
export type MovementType = Schemas["MovementType"];

export type ProductResponse = Schemas["ProductResponse"];
export type CategoryResponse = Schemas["CategoryResponse"];
export type SupplierResponse = Schemas["SupplierResponse"];
export type CustomerResponse = Schemas["CustomerResponse"];
export type UserResponse = Schemas["UserResponse"];
export type SessionUserResponse = Schemas["SessionUserResponse"];
export type SaleDetailResponse = Schemas["SaleDetailResponse"];
export type PurchaseDetailResponse = Schemas["PurchaseDetailResponse"];
export type StockItemResponse = Schemas["StockItemResponse"];
export type StockCountResponse = Schemas["StockCountResponse"];
export type PageMeta = Schemas["PageMetaDto"];

/** What every list screen consumes: the rows plus their pagination meta. */
export type Paged<T> = { items: T[]; meta: PageMeta };
