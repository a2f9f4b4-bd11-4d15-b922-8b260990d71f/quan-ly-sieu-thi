import { http } from "msw";
import { BASE, takeForcedFailure } from "./_shared";
import { authHandlers } from "./auth";
import { productHandlers } from "./products";
import { categoryHandlers } from "./categories";
import { customerHandlers } from "./customers";
import { supplierHandlers } from "./suppliers";
import { userHandlers } from "./users";
import { inventoryHandlers } from "./inventory";
import { saleHandlers } from "./sales";
import { purchaseHandlers } from "./purchases";
import { reportHandlers } from "./reports";

/** Returns a response only while a failure is armed; otherwise falls through. */
const forcedFailureHandler = http.all(`${BASE}/*`, () => takeForcedFailure());

export const handlers = [
  forcedFailureHandler,
  ...authHandlers,
  ...productHandlers,
  ...categoryHandlers,
  ...customerHandlers,
  ...supplierHandlers,
  ...userHandlers,
  ...inventoryHandlers,
  ...saleHandlers,
  ...purchaseHandlers,
  ...reportHandlers,
];
