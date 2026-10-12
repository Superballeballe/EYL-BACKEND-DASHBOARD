import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shownContact, sortContacts, whatsAppLink, whatsAppPreview } from "./hubContacts";

const row = (label: string, sort_order: number, active: boolean) => ({ label, sort_order, active });

describe("hub contacts", () => {
  it("builds the wa.me link from an E.164 number", () => {
    assert.equal(whatsAppLink("+918691911911"), "https://wa.me/918691911911");
    assert.equal(whatsAppLink("+91 86919 11911"), "https://wa.me/918691911911");
    assert.equal(whatsAppPreview("+918691911911"), "wa.me/918691911911");
  });

  it("sorts by sort_order, then label", () => {
    const sorted = sortContacts([row("B", 1, true), row("C", 0, true), row("A", 1, true)]);
    assert.deepEqual(
      sorted.map((c) => c.label),
      ["C", "A", "B"],
    );
  });

  it("shows the first active row in app order", () => {
    assert.equal(shownContact([row("Hidden", 0, false), row("Z", 2, true), row("Care", 1, true)])?.label, "Care");
    assert.equal(shownContact([row("Hidden", 0, false)]), null);
    assert.equal(shownContact([]), null);
  });
});
