"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeAddress, type LatLng } from "@/lib/mapsClient";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/loadGoogleMaps";

export default function LocationPicker({
  value,
  lat,
  lng,
  onChange,
  placeholder = "Search address on Google Maps",
}: {
  value: string;
  lat?: number | null;
  lng?: number | null;
  onChange: (address: string, coords?: LatLng | null) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [ready, setReady] = useState<boolean | null>(hasGoogleMapsKey() ? null : false);
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return;
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "geometry", "name"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const address = place.formatted_address || place.name || "";
      const loc = place.geometry?.location;
      const coords = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
      if (address) onChange(address, coords);
      if (coords) setPosition(coords);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [ready, onChange]);

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

  if (ready === false) {
    return (
      <div>
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value, null)}
          placeholder={placeholder}
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
    <div>
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value, null);
          setPosition(null);
        }}
        placeholder={ready ? placeholder : "Loading maps…"}
        autoComplete="off"
      />
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
