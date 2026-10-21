import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DeliveryStop } from "./deliveryRouteDetails";
import { formatRecipients, formatRoutePeople } from "./deliveryTaskBadges";

function stop(label: string, contactName: string | null, location: string | null): DeliveryStop {
  return { label, location, contactName, contactPhone: null, instructions: null, isReturn: false };
}

describe("route heading by people", () => {
  it("names the sender at pickup, then each drop's recipient", () => {
    assert.equal(
      formatRoutePeople({ name: "Sachin", location: "Flat 1203, 12th floor, Nesco IT Park, Goregaon East" }, [
        stop("Drop 1", "Sachin", "Flat 217, 2nd floor, Kuber Complex, Andheri West"),
        stop("Drop 2", "Sachin Naik", "Flat 501, 5th floor, Shri Krishna Complex, Andheri West"),
        stop("Drop 3", "Riya", "Flat 202, 2nd floor, Sheetal Chhaya, Mahim West"),
      ]),
      "Pickup · Sachin → Drop 1 · Sachin → Drop 2 · Sachin Naik → Drop 3 · Riya",
    );
  });

  it("reads the same for a single drop", () => {
    assert.equal(
      formatRoutePeople({ name: "Asha", location: "Bandra West, Mumbai" }, [stop("Drop", "Ravi", "Andheri East, Mumbai")]),
      "Pickup · Asha → Drop · Ravi",
    );
  });

  it("falls back to the first address part when a name is missing or blank", () => {
    assert.equal(
      formatRoutePeople({ name: "  ", location: "Flat 1203, 12th floor, Nesco" }, [
        stop("Drop 1", null, "Flat 217, 2nd floor, Kuber Complex"),
        stop("Drop 2", null, null),
      ]),
      "Pickup · Flat 1203 → Drop 1 · Flat 217 → Drop 2 · —",
    );
  });
});

describe("recipients line", () => {
  it("lists every named recipient in route order", () => {
    assert.equal(
      formatRecipients([stop("Drop 1", "Sachin", null), stop("Drop 2", " Sachin Naik ", null), stop("Drop 3", "Riya", null)]),
      "Sachin, Sachin Naik, Riya",
    );
  });

  it("skips unnamed stops and is empty when nobody is named", () => {
    assert.equal(formatRecipients([stop("Drop 1", null, "Flat 217"), stop("Drop 2", "Riya", null)]), "Riya");
    assert.equal(formatRecipients([stop("Drop", "  ", null)]), "");
    assert.equal(formatRecipients([]), "");
  });
});
