"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeAddress, type LatLng } from "@/lib/mapsClient";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/loadGoogleMaps";

type SuggestionRow = {
  key: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

export default function LocationPicker({
  value,
  lat,
  lng,
  onChange,
  placeholder = "Search address on Google Maps",
  disabled = false,
}: {
  value: string;
  lat?: number | null;
  lng?: number | null;
  onChange: (address: string, coords?: LatLng | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);
  const suppressSearch = useRef(false);
  const [ready, setReady] = useState<boolean | null>(hasGoogleMapsKey() ? null : false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return;
    loadGoogleMaps()
      .then(async () => {
        if (google.maps.importLibrary) await google.maps.importLibrary("places");
        setReady(true);
      })
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const id = ++requestId.current;
      try {
        if (!sessionToken.current) {
          sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        }
        const { suggestions: next } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            includedRegionCodes: ["in"],
            sessionToken: sessionToken.current,
          });
        if (id !== requestId.current) return;
        const rows: SuggestionRow[] = [];
        next.forEach((item, index) => {
          const prediction = item.placePrediction;
          if (!prediction) return;
          const label = prediction.text?.text ?? String(prediction.text ?? "");
          if (!label) return;
          rows.push({ key: `${index}:${label}`, label, prediction });
        });
        setSuggestions(rows);
        setOpen(rows.length > 0);
      } catch {
        if (id === requestId.current) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [ready, value]);

  useEffect(() => {
    if (!ready || !value.trim()) {
      setPosition(null);
      return;
    }
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      setPosition({ lat, lng });
      return;
    }
    let cancelled = false;
    geocodeAddress(value).then((coords) => {
      if (!cancelled) setPosition(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, value, lat, lng]);

  useEffect(() => {
    if (!ready || !position || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      markerRef.current = new google.maps.Marker({
        map: mapInstance.current,
        position,
      });
      return;
    }

    mapInstance.current.setCenter(position);
    markerRef.current?.setPosition(position);
  }, [ready, position]);

  async function pickSuggestion(row: SuggestionRow) {
    setOpen(false);
    setSuggestions([]);
    suppressSearch.current = true;
    try {
      const place = row.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      sessionToken.current = null;
      const address = place.formattedAddress || row.label;
      const loc = place.location;
      const coords =
        loc && typeof loc.lat === "function" && typeof loc.lng === "function"
          ? { lat: loc.lat(), lng: loc.lng() }
          : null;
      onChange(address, coords);
      if (coords) setPosition(coords);
    } catch {
      onChange(row.label, null);
    }
  }

  if (ready === false) {
    return (
      <div>
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value, null)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {!hasGoogleMapsKey() ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable map search.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value, null);
          setPosition(null);
        }}
        onBlur={() => {
          // Let suggestion click fire first.
          window.setTimeout(() => setOpen(false), 150);
        }}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        placeholder={ready ? placeholder : "Loading maps…"}
        autoComplete="off"
        disabled={disabled}
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute z-[1400] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pickSuggestion(row)}
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {position ? (
        <div
          ref={mapRef}
          className="mt-2 overflow-hidden rounded-lg border border-[var(--border)]"
          style={{ height: 160, width: "100%" }}
        />
      ) : null}
    </div>
  );
}
