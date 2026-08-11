"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/ui";
import { drawRoute, resolveDeliveryCoords } from "@/lib/mapsClient";
import { GoogleMapsLoadError, hasGoogleMapsKey, loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { formatDeliveryOrderId } from "@/lib/serial";
import { fmtShortDate } from "@/lib/format";
import type { Delivery } from "@/lib/types";

type KnightOpt = { id: string; display_name: string };

type MapDelivery = Pick<
  Delivery,
  | "id"
  | "serial_no"
  | "sender_name"
  | "pickup_location"
  | "drop_location"
  | "pickup_lat"
  | "pickup_lng"
  | "drop_lat"
  | "drop_lng"
  | "knight_name"
  | "knight_id"
  | "fulfillment_status"
  | "mode_of_booking"
  | "app_order_id"
  | "app_order"
  | "task_date"
>;

const ROUTE_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#4f46e5"];

export default function PlottingMapBoard({
  deliveries,
  knights,
  initialMonth,
  initialKnightId = "",
}: {
  deliveries: MapDelivery[];
  knights: KnightOpt[];
  initialMonth: string;
  initialKnightId?: string;
}) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<
    Array<{ markers: google.maps.Marker[]; renderer: google.maps.DirectionsRenderer | null }>
  >([]);
  const [ready, setReady] = useState<boolean | null>(hasGoogleMapsKey() ? null : false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState(initialMonth);
  const [knightId, setKnightId] = useState(initialKnightId);

  const assigned = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          d.pickup_location?.trim() &&
          d.drop_location?.trim() &&
          d.fulfillment_status !== "cancelled",
      ),
    [deliveries],
  );

  useEffect(() => {
    setMonth(initialMonth);
    setKnightId(initialKnightId);
  }, [initialMonth, initialKnightId]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return;
    loadGoogleMaps()
      .then(() => {
        setMapError(null);
        setReady(true);
      })
      .catch((err: unknown) => {
        setReady(false);
        if (err instanceof GoogleMapsLoadError) {
          setMapError(err.message);
        } else {
          setMapError("Google Maps failed to load.");
        }
      });
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.209 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
    }
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapInstance.current || !selectedId) return;
    const d = assigned.find((x) => x.id === selectedId);
    if (!d) return;
    let cancelled = false;
    resolveDeliveryCoords(d).then(({ pickup, drop }) => {
      if (cancelled || !pickup || !drop || !mapInstance.current) return;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(drop);
      mapInstance.current.fitBounds(bounds);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, selectedId, assigned]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    let cancelled = false;

    async function plot() {
      setLoadingRoutes(true);
      overlaysRef.current.forEach(({ markers, renderer }) => {
        markers.forEach((m) => m.setMap(null));
        renderer?.setMap(null);
      });
      overlaysRef.current = [];

      const bounds = new google.maps.LatLngBounds();
      let plotted = 0;

      for (let i = 0; i < assigned.length; i++) {
        if (cancelled) return;
        const d = assigned[i];
        const { pickup, drop } = await resolveDeliveryCoords(d);
        if (!pickup || !drop) continue;

        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
        const overlay = await drawRoute(mapInstance.current!, pickup, drop, color);
        overlaysRef.current.push(overlay);
        bounds.extend(pickup);
        bounds.extend(drop);
        plotted++;
      }

      if (!cancelled && plotted > 0) {
        mapInstance.current!.fitBounds(bounds);
      }
      if (!cancelled) setLoadingRoutes(false);
    }

    plot();
    return () => {
      cancelled = true;
    };
  }, [ready, assigned]);

  function applyFilters(nextMonth: string, nextKnightId: string) {
    const params = new URLSearchParams();
    if (nextMonth) params.set("month", nextMonth);
    if (nextKnightId) params.set("knight_id", nextKnightId);
    router.replace(`/map?${params.toString()}`, { scroll: false });
  }

  function serialLabel(d: MapDelivery) {
    return formatDeliveryOrderId(d);
  }

  if (ready === false) {
    return (
      <Box>
        <PageHeader title="Plotting map" subtitle="Assign routes and preview partner deliveries on the map." />
        <Alert severity="warning" sx={{ mb: 2 }}>
          {mapError ?? (
            <>
              Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your <code>.env</code> and enable Maps
              JavaScript, Places (New), Directions, and Geocoding APIs in Google Cloud Console.
            </>
          )}
        </Alert>
        <Alert severity="info">
          <Typography variant="body2" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
            Fix ApiTargetBlockedMapError
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>Google Cloud → APIs &amp; Services → enable <strong>Maps JavaScript API</strong>,{" "}
              <strong>Directions API</strong>, <strong>Geocoding API</strong>,{" "}
              <strong>Places API (New)</strong>
            </li>
            <li>API key → Application restrictions → HTTP referrers → add{" "}
              <code>http://localhost:3000/*</code> and your production domain
            </li>
            <li>Disable ad blockers for localhost (they block <code>maps.googleapis.com</code>)</li>
            <li>Ensure billing is enabled on the Google Cloud project</li>
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Plotting map"
        subtitle="Monthly routes from deliveries — pickup to drop, filtered by partner."
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "340px 1fr" },
          gap: 2,
          minHeight: { lg: "calc(100vh - 180px)" },
        }}
      >
        <Card sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                size="small"
                type="month"
                label="Month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  applyFilters(e.target.value, knightId);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel id="map-knight-label">Delivery partner</InputLabel>
                <Select
                  labelId="map-knight-label"
                  label="Delivery partner"
                  value={knightId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setKnightId(next);
                    applyFilters(month, next);
                  }}
                >
                  <MenuItem value="">All deliveries</MenuItem>
                  {knights.map((k) => (
                    <MenuItem key={k.id} value={k.id}>
                      {k.display_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {assigned.length} route{assigned.length === 1 ? "" : "s"}
                </Typography>
                {loadingRoutes ? <Chip size="small" label="Plotting…" /> : null}
              </Stack>

              <Stack spacing={1} sx={{ maxHeight: { lg: "calc(100vh - 320px)" }, overflowY: "auto" }}>
                {assigned.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                    No deliveries with pickup/drop for {month}. Pick another month, or fill addresses on
                    the delivery.
                  </Typography>
                ) : (
                  assigned.map((d, i) => {
                    const active = selectedId === d.id;
                    return (
                      <Box
                        key={d.id}
                        component="button"
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        sx={{
                          textAlign: "left",
                          width: "100%",
                          p: 1.5,
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: active ? "primary.main" : "divider",
                          bgcolor: active ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: ROUTE_COLORS[i % ROUTE_COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {serialLabel(d)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          {fmtShortDate(d.task_date)}
                          {d.knight_name?.trim() ? ` · ${d.knight_name}` : " · Unassigned"}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {d.sender_name ?? "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          {d.pickup_location}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          → {d.drop_location}
                        </Typography>
                      </Box>
                    );
                  })
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Box sx={{ position: "relative", height: { xs: 420, lg: "100%" }, minHeight: 420 }}>
            {!ready ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "grey.50",
                }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Loading map…
                </Typography>
              </Box>
            ) : null}
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: "absolute",
                bottom: 12,
                left: 12,
                bgcolor: "rgba(255,255,255,0.92)",
                borderRadius: 1,
                px: 1.5,
                py: 0.75,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Chip size="small" label="Pickup" sx={{ bgcolor: "#dcfce7", fontWeight: 600 }} />
              <Chip size="small" label="Drop" sx={{ bgcolor: "#fee2e2", fontWeight: 600 }} />
              <Chip size="small" label="Route" sx={{ bgcolor: "#dbeafe", fontWeight: 600 }} />
            </Stack>
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
