"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
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
import DeliveryLifecycleActions from "@/components/DeliveryLifecycleActions";
import { DeliveryPreviewModal } from "@/components/DeliveryTable";
import { FulfillmentBadge, PageHeader } from "@/components/ui";
import { deliverySchedule } from "@/lib/deliverySchedule";
import { effectiveFulfillmentStatus, lifecycleStage } from "@/lib/deliveryStatus";
import { activateOnKey } from "@/lib/keyboard";
import { drawRoute, resolveDeliveryCoords } from "@/lib/mapsClient";
import { GoogleMapsLoadError, hasGoogleMapsKey, loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { formatDeliveryOrderId } from "@/lib/serial";
import { areaLabel, fmtShortDate } from "@/lib/format";
import { FOCUS, gray, ink, shadow, tint } from "@/lib/surface";
import type { Delivery } from "@/lib/types";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTierOpt = { min_km: number | null; max_km: number | null; fee: number | null };

/** The two ends of a route, in the same colours as the map's P and D markers. */
const STOP_TONE = {
  pickup: { letter: "P", bg: "#dcfce7", fg: "#166534" },
  drop: { letter: "D", bg: "#fee2e2", fg: "#991b1b" },
} as const;

const ROUTE_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#4f46e5"];

function RouteStopLine({ end, location }: { end: keyof typeof STOP_TONE; location: string | null }) {
  const tone = STOP_TONE[end];
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{
          width: 18,
          height: 18,
          mt: "1px",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          bgcolor: tone.bg,
          color: tone.fg,
          fontSize: "0.625rem",
          fontWeight: 700,
        }}
      >
        {tone.letter}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {areaLabel(location)}
        </Typography>
        <Typography variant="caption" noWrap title={location ?? undefined} sx={{ color: "text.secondary", display: "block" }}>
          {location ?? "—"}
        </Typography>
      </Box>
    </Stack>
  );
}

/** One delivery in the route list: click to find it on the map, or open the order from the footer. */
function RouteCard({
  delivery: d,
  color,
  active,
  knights,
  onSelect,
  onOpen,
}: {
  delivery: Delivery;
  color: string;
  active: boolean;
  knights: KnightOpt[];
  onSelect: () => void;
  onOpen: () => void;
}) {
  const orderId = formatDeliveryOrderId(d);
  const stage = lifecycleStage(d.fulfillment_status);
  const slot = deliverySchedule(d).pickup;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`Show ${orderId} on the map`}
      onClick={onSelect}
      onKeyDown={(event) => activateOnKey(event, onSelect)}
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: active ? tint.fill : gray.surface,
        boxShadow: active ? `inset 0 0 0 2px ${ink.main}` : "none",
        cursor: "pointer",
        transition: "background-color .15s, box-shadow .15s",
        "&:hover": { bgcolor: tint.fill },
        "&:focus-visible": { outline: `2px solid ${FOCUS}`, outlineOffset: 1 },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
        <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {orderId}
        </Typography>
        <FulfillmentBadge status={effectiveFulfillmentStatus(d)} />
      </Stack>
      <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
        {fmtShortDate(d.task_date)}
        {d.knight_name?.trim() ? ` · ${d.knight_name}` : " · Unassigned"}
        {d.sender_name ? ` · ${d.sender_name}` : ""}
      </Typography>

      <Stack spacing={0.75} sx={{ mt: 1.25 }}>
        <RouteStopLine end="pickup" location={d.pickup_location} />
        <RouteStopLine end="drop" location={d.drop_location} />
      </Stack>
      {slot ? (
        <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          Scheduled · {slot}
        </Typography>
      ) : null}

      {/* Stacked, not side by side: the lifecycle actions can carry a line of explanation under their buttons. */}
      <Stack spacing={1} sx={{ mt: 1.25, cursor: "default" }} onClick={(event) => event.stopPropagation()}>
        {stage ? (
          <DeliveryLifecycleActions delivery={d} knights={knights} compact variant={stage} onEditFull={onOpen} />
        ) : null}
        <Button size="small" variant="outlined" fullWidth onClick={onOpen}>
          Open order
        </Button>
      </Stack>
    </Box>
  );
}

export default function PlottingMapBoard({
  deliveries,
  knights,
  assignableKnights,
  clients,
  rateTiers,
  isAdmin = false,
  initialMonth,
  initialKnightId = "",
}: {
  deliveries: Delivery[];
  /** Partners that appear on this month's routes — the filter's options. */
  knights: KnightOpt[];
  /** Every active knight — who an order can be assigned to. */
  assignableKnights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  isAdmin?: boolean;
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
  const [openDelivery, setOpenDelivery] = useState<Delivery | null>(null);
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
        <Card>
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
                  assigned.map((d, i) => (
                    <RouteCard
                      key={d.id}
                      delivery={d}
                      color={ROUTE_COLORS[i % ROUTE_COLORS.length]}
                      active={selectedId === d.id}
                      knights={assignableKnights}
                      onSelect={() => setSelectedId(d.id)}
                      onOpen={() => {
                        setSelectedId(d.id);
                        setOpenDelivery(d);
                      }}
                    />
                  ))
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ overflow: "hidden" }}>
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
                boxShadow: shadow.sm,
              }}
            >
              <Chip size="small" label="Pickup" sx={{ bgcolor: STOP_TONE.pickup.bg, color: STOP_TONE.pickup.fg }} />
              <Chip size="small" label="Drop" sx={{ bgcolor: STOP_TONE.drop.bg, color: STOP_TONE.drop.fg }} />
              <Chip size="small" label="Route" sx={{ bgcolor: "#dbeafe", color: "#1e40af" }} />
            </Stack>
          </Box>
        </Card>
      </Box>

      {openDelivery ? (
        <DeliveryPreviewModal
          delivery={openDelivery}
          knights={assignableKnights}
          clients={clients}
          rateTiers={rateTiers}
          isAdmin={isAdmin}
          onClose={() => setOpenDelivery(null)}
          onSaved={(delivery) => {
            setOpenDelivery(delivery);
            router.refresh();
          }}
          onDeleted={() => {
            setOpenDelivery(null);
            router.refresh();
          }}
        />
      ) : null}
    </Box>
  );
}
