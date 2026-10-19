import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handlingFeeUpdateSchema } from "./schemas";
import { APP_HANDLING_FEE_CODES } from "./pricing/handlingFees";

const parse = (body: unknown) => handlingFeeUpdateSchema.safeParse(body);

describe("handlingFeeUpdateSchema", () => {
  it("accepts a free fee and a paid fee", () => {
    assert.deepEqual(parse({ amount: 0, is_current: true }).data, { amount: 0, is_current: true });
    assert.deepEqual(parse({ amount: 30, is_current: false }).data, { amount: 30, is_current: false });
  });

  it("refuses negative, fractional, empty and text fees", () => {
    for (const amount of [-1, 12.5, null, "30", undefined]) {
      assert.equal(parse({ amount, is_current: true }).success, false, `amount ${String(amount)}`);
    }
  });

  it("needs the on/off switch", () => {
    assert.equal(parse({ amount: 10 }).success, false);
  });
});

describe("APP_HANDLING_FEE_CODES", () => {
  it("covers Fragile, Liquid and Keep upright as the app's reprice_order charges them", () => {
    assert.deepEqual(APP_HANDLING_FEE_CODES, ["delicate_handling", "liquid", "keep_upright"]);
  });
});
