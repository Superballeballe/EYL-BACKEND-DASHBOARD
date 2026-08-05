declare namespace google.maps.places {
  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
    addListener(event: string, fn: () => void): google.maps.MapsEventListener;
    getPlace(): PlaceResult;
  }
  interface AutocompleteOptions {
    componentRestrictions?: { country: string | string[] };
    fields?: string[];
  }
  interface PlaceResult {
    formatted_address?: string;
    name?: string;
    geometry?: { location?: { lat(): number; lng(): number } };
  }
}

declare namespace google.maps {
  enum TravelMode {
    DRIVING = "DRIVING",
  }
  enum SymbolPath {
    CIRCLE = 0,
  }
  class Map {
    constructor(el: HTMLElement, opts: MapOptions);
    setCenter(pos: LatLngLiteral): void;
    fitBounds(bounds: LatLngBounds): void;
  }
  class Marker {
    constructor(opts: MarkerOptions);
    setPosition(pos: LatLngLiteral): void;
    setMap(map: Map | null): void;
  }
  class Geocoder {
    geocode(
      request: GeocoderRequest,
      callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void,
    ): void;
  }
  class LatLngBounds {
    extend(point: LatLngLiteral): void;
  }
  class DirectionsService {
    route(
      request: DirectionsRequest,
      callback: (result: DirectionsResult | null, status: DirectionsStatus) => void,
    ): void;
  }
  class DirectionsRenderer {
    constructor(opts?: DirectionsRendererOptions);
    setMap(map: Map | null): void;
  }
  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  }
  interface MarkerOptions {
    map?: Map | null;
    position?: LatLngLiteral;
    label?: string;
    title?: string;
    icon?: {
      path?: SymbolPath | string;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
    };
  }
  interface GeocoderRequest {
    address?: string;
    region?: string;
  }
  interface GeocoderResult {
    geometry: { location: { lat(): number; lng(): number } };
  }
  type GeocoderStatus = "OK" | string;
  interface DirectionsRequest {
    origin: LatLngLiteral;
    destination: LatLngLiteral;
    travelMode: TravelMode;
    region?: string;
  }
  type DirectionsStatus = "OK" | string;
  interface DirectionsResult {}
  interface DirectionsRendererOptions {
    map?: Map;
    directions?: DirectionsResult;
    suppressMarkers?: boolean;
    polylineOptions?: {
      strokeColor?: string;
      strokeWeight?: number;
      strokeOpacity?: number;
    };
  }
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }
  interface MapsEventListener {}
  namespace event {
    function removeListener(listener: MapsEventListener): void;
  }
}

interface Window {
  google?: { maps: typeof google.maps };
  gm_authFailure?: () => void;
  __eylGoogleMapsInit?: () => void;
}
