import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/loadGoogleMaps";

export type LatLng = { lat: number; lng: number };

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const q = address.trim();
  if (!q || !hasGoogleMapsKey()) return null;
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: q, region: "in" }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}

export async function resolveDeliveryCoords(delivery: {
  pickup_location: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_location: string | null;
  drop_lat: number | null;
  drop_lng: number | null;
}): Promise<{ pickup: LatLng | null; drop: LatLng | null }> {
  let pickup: LatLng | null =
    isValidCoord(delivery.pickup_lat, delivery.pickup_lng)
      ? { lat: delivery.pickup_lat as number, lng: delivery.pickup_lng as number }
      : null;
  let drop: LatLng | null =
    isValidCoord(delivery.drop_lat, delivery.drop_lng)
      ? { lat: delivery.drop_lat as number, lng: delivery.drop_lng as number }
      : null;

  if (!pickup && delivery.pickup_location) {
    pickup = await geocodeAddress(delivery.pickup_location);
  }
  if (!drop && delivery.drop_location) {
    drop = await geocodeAddress(delivery.drop_location);
  }

  return { pickup, drop };
}

export function drawRoute(
  map: google.maps.Map,
  pickup: LatLng,
  drop: LatLng,
  color: string,
): Promise<{ markers: google.maps.Marker[]; renderer: google.maps.DirectionsRenderer | null }> {
  const service = new google.maps.DirectionsService();
  return new Promise((resolve) => {
    service.route(
      {
        origin: pickup,
        destination: drop,
        travelMode: google.maps.TravelMode.DRIVING,
        region: "in",
      },
      (result, status) => {
        const markers: google.maps.Marker[] = [
          new google.maps.Marker({
            map,
            position: pickup,
            label: "P",
            title: "Pickup",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#16a34a",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          }),
          new google.maps.Marker({
            map,
            position: drop,
            label: "D",
            title: "Drop",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#dc2626",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          }),
        ];

        if (status !== "OK" || !result) {
          resolve({ markers, renderer: null });
          return;
        }

        const renderer = new google.maps.DirectionsRenderer({
          map,
          directions: result,
          suppressMarkers: true,
          polylineOptions: { strokeColor: color, strokeWeight: 4, strokeOpacity: 0.85 },
        });
        resolve({ markers, renderer });
      },
    );
  });
}
