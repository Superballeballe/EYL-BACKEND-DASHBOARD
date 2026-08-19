import {
  calculateBikerFare,
  calculateWalkerFare,
  quoteDelivery,
} from "./deliveryQuote";

let failed = 0;

if (calculateBikerFare(1.2) !== 50) {
  console.error("FAIL biker flat band");
  failed += 1;
}
if (calculateBikerFare(2) !== 63) {
  console.error("FAIL biker progressive 2km");
  failed += 1;
}
if (calculateBikerFare(10) !== 251) {
  console.error("FAIL biker 10km progressive");
  failed += 1;
}

const walker = calculateWalkerFare(10, { mode: "public_transit", publicTransportPerKm: 12 });
if (walker.base !== 90 || walker.transportAddon !== 120) {
  console.error("FAIL walker public transit");
  failed += 1;
}

const cakeQuote = quoteDelivery({
  distanceKm: 5,
  handling: { isCake: true },
});
if (cakeQuote.recommendedCarrier !== "walker") {
  console.error("FAIL cake should prefer walker");
  failed += 1;
}

const shortQuote = quoteDelivery({ distanceKm: 4 });
if (shortQuote.recommendedCarrier !== "biker") {
  console.error("FAIL short standard should prefer biker");
  failed += 1;
}

const pendingWalker = quoteDelivery({ distanceKm: 15 });
if (!pendingWalker.transportPending || pendingWalker.transportAddon !== 0) {
  console.error("FAIL walker quote should wait for knight transport choice");
  failed += 1;
}

if (failed) process.exit(1);
console.log("ok delivery quote");
