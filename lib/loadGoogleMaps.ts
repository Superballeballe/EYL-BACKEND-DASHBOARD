/** Lazy-load Google Maps JS once per page. */
let loadPromise: Promise<void> | null = null;

export class GoogleMapsLoadError extends Error {
  constructor(
    message: string,
    readonly code: "MISSING_KEY" | "BLOCKED" | "LOAD_FAILED" = "LOAD_FAILED",
  ) {
    super(message);
    this.name = "GoogleMapsLoadError";
  }
}

export function hasGoogleMapsKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new GoogleMapsLoadError("Google Maps is browser-only"));
  }
  if (window.google?.maps?.Map) return Promise.resolve();

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return Promise.reject(new GoogleMapsLoadError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set", "MISSING_KEY"));
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const fail = (code: GoogleMapsLoadError["code"], message: string) => {
        loadPromise = null;
        reject(new GoogleMapsLoadError(message, code));
      };

      window.gm_authFailure = () => {
        fail(
          "BLOCKED",
          "Google Maps blocked this API key (ApiTargetBlockedMapError). Enable Maps JavaScript, Directions, Geocoding, and Places APIs, and allow this site in your key’s HTTP referrer restrictions.",
        );
      };

      const callbackName = "__eylGoogleMapsInit";
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        delete (window as unknown as Record<string, unknown>)[callbackName];
        resolve();
      };

      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="1"]');
      if (existing) {
        if (window.google?.maps?.Map) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          fail("LOAD_FAILED", "Google Maps script failed to load. Check ad blockers and network."),
        );
        return;
      }

      const script = document.createElement("script");
      script.dataset.googleMaps = "1";
      script.async = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
        `&libraries=places&loading=async&callback=${callbackName}`;
      script.onerror = () =>
        fail("LOAD_FAILED", "Google Maps script failed to load. Disable ad blockers for localhost.");
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
