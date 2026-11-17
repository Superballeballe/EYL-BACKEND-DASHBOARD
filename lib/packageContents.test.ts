import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packageContents } from "./packageContents";

const order = (items: NonNullable<NonNullable<Parameters<typeof packageContents>[0]["app_order"]>["items"]>) => ({
  id: "o1",
  order_code: "EYL-1",
  status: "registered",
  items,
});

describe("package contents", () => {
  it("shows the app order's item description, weight and delicate flag", () => {
    assert.equal(
      packageContents({
        content: null,
        app_order: order([{ description: " Birthday cake ", category: "food", weight_kg: 2.5, delicate_handling: true }]),
      }),
      "Birthday cake · Food · 2.5 kg · Delicate",
    );
  });

  it("prefers the app order's items over the synced content column", () => {
    assert.equal(
      packageContents({ content: "standard", app_order: order([{ description: "Documents" }]) }),
      "Documents",
    );
  });

  it("lists every item of a multi-item order", () => {
    assert.equal(
      packageContents({ content: null, app_order: order([{ description: "Keys" }, { description: "Laptop", weight_kg: "3" }]) }),
      "Keys; Laptop · 3 kg",
    );
  });

  it("falls back to the content column when the order has no described item", () => {
    assert.equal(packageContents({ content: " Flowers ", app_order: order([]) }), "Flowers");
    assert.equal(
      packageContents({
        content: "Flowers",
        app_order: order([{ description: "  ", category: null, weight_kg: null, delicate_handling: false }]),
      }),
      "Flowers",
    );
    assert.equal(packageContents({ content: "Flowers", app_order: null }), "Flowers");
    assert.equal(packageContents({ content: "Flowers" }), "Flowers");
  });

  it("is null when nothing is known", () => {
    assert.equal(packageContents({ content: null, app_order: null }), null);
    assert.equal(packageContents({ content: "  ", app_order: order([{ weight_kg: 0 }]) }), null);
  });

  it("does not repeat a category that is the description", () => {
    assert.equal(packageContents({ content: null, app_order: order([{ description: "Food", category: "food" }]) }), "Food");
  });
});
