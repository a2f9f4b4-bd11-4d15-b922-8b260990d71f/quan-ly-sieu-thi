import { http } from "msw";
import { BASE, takeForcedFailure } from "./_shared";
import { authHandlers } from "./auth";
import { productHandlers } from "./products";
import { categoryHandlers } from "./categories";

/** Returns a response only while a failure is armed; otherwise falls through. */
const forcedFailureHandler = http.all(`${BASE}/*`, () => takeForcedFailure());

export const handlers = [
  forcedFailureHandler,
  ...authHandlers,
  ...productHandlers,
  ...categoryHandlers,
];
