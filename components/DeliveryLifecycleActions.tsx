"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ScheduleDateTimeField from "@/components/ScheduleDateTimeField";
import {
  isScheduleInputBefore,
  isScheduleInputBeforeNow,
  isWithinWorkingHours,
  nowDatetimeLocalInput,
  scheduleInputToIso,
  toDatetimeLocalValue,
  workingHoursError,
} from "@/lib/format";

type KnightOpt = { id: string; display_name: string };
type AppOrderSummary = {
  id?: string;
  order_code?: string | null;
  status: string | null;
  rider_name?: string | null;
  pickup_scheduled_at?: string | null;
  delivery_scheduled_at?: string | null;
  accepted_at?: string | null;
  rider_assigned_at?: string | null;
};
type DeliverySnapshot = {
  id: string;
  app_order_id: string | null;
  knight_id: string | null;
  knight_name: string | null;
  fulfillment_status: string | null;
  task_date?: string | null;
  pickup_time_window?: string | null;
  drop_time_window?: string | null;
  app_order?: AppOrderSummary | null;
};

type ActionPayload =
  | {
      action: "assign";
      knight_id: string | null;
      knight_name: string;
      pickup_scheduled_at: string | null;
      delivery_scheduled_at: string | null;
    }
  | { action: "pickup" }
  | { action: "deliver" }
  | { action: "cancel" };

export type LifecycleResult = {
  delivery?: Partial<DeliverySnapshot> | null;
  app_order?: AppOrderSummary | null;
};

const statusRank: Record<string, number> = {
  registered: 0,
  placed: 0,
  accepted: 1,
  confirmed: 1,
  rider_assigned: 2,
  assigned: 2,
  picked_up: 3,
  in_transit: 3,
  delivered: 4,
  completed: 4,
  cancelled: -1,
  canceled: -1,
};

function defaultScheduleTimes() {
  const pickup = new Date();
  pickup.setSeconds(0, 0);
  pickup.setMinutes(Math.ceil(pickup.getMinutes() / 15) * 15);
  pickup.setMinutes(pickup.getMinutes() + 30);

  const startMins = 8 * 60;
  const endMins = 20 * 60 + 30;
  let mins = pickup.getHours() * 60 + pickup.getMinutes();
  if (mins < startMins) pickup.setHours(8, 0, 0, 0);
  else if (mins > endMins) {
    pickup.setDate(pickup.getDate() + 1);
    pickup.setHours(8, 0, 0, 0);
  }

  const drop = new Date(pickup);
  drop.setMinutes(drop.getMinutes() + 60);
  if (drop.getHours() * 60 + drop.getMinutes() > endMins) {
    drop.setHours(20, 30, 0, 0);
  }

  return {
    pickup: toDatetimeLocalValue(pickup.toISOString()),
    drop: toDatetimeLocalValue(drop.toISOString()),
  };
}

function resolveScheduleInput(
  primary: string | null | undefined,
  fallback: string | null | undefined,
  taskDate: string | null | undefined,
  defaultValue: string,
) {
  return (
    toDatetimeLocalValue(primary, taskDate) ||
    toDatetimeLocalValue(fallback, taskDate) ||
    defaultValue
  );
}

export default function DeliveryLifecycleActions({
  delivery,
  knights,
  compact = false,
  variant = "default",
  onUpdated,
}: {
  delivery: DeliverySnapshot;
  knights: KnightOpt[];
  compact?: boolean;
  /** pending = assign only; running = edit + pickup/done by stage; default = all actions */
  variant?: "default" | "pending" | "running";
  onUpdated?: (result: LifecycleResult) => void;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ActionPayload["action"] | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKnightId, setSelectedKnightId] = useState(delivery.knight_id ?? "");
  const [customKnightName, setCustomKnightName] = useState(delivery.knight_id ? "" : delivery.knight_name ?? "");
  const [pickupAt, setPickupAt] = useState(
    toDatetimeLocalValue(delivery.app_order?.pickup_scheduled_at, delivery.task_date),
  );
  const [deliveryAt, setDeliveryAt] = useState(
    toDatetimeLocalValue(delivery.app_order?.delivery_scheduled_at, delivery.task_date),
  );
  const [minPickupAt, setMinPickupAt] = useState(nowDatetimeLocalInput);

  const appStatus = delivery.app_order?.status ?? (delivery.app_order_id ? "registered" : null);
  const appRank = statusRank[appStatus ?? ""] ?? 0;
  const isAppOrder = Boolean(delivery.app_order_id);
  const hasKnight = Boolean(delivery.knight_name?.trim() || delivery.knight_id);
  const needsAssignmentConfirmation = isAppOrder && !hasKnight && appRank < statusRank.rider_assigned;
  const isCancelled = appStatus === "cancelled" || delivery.fulfillment_status === "cancelled";

  const selectedKnightName = useMemo(() => {
    if (!selectedKnightId) return customKnightName.trim();
    return knights.find((knight) => knight.id === selectedKnightId)?.display_name ?? customKnightName.trim();
  }, [customKnightName, knights, selectedKnightId]);

  const assignLabel = needsAssignmentConfirmation
    ? compact
      ? "Assign & start"
      : "Assign knight & start"
    : compact
      ? "Assign"
      : "Assign knight";

  async function run(payload: ActionPayload) {
    setBusyAction(payload.action);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}/lifecycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Action failed");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as LifecycleResult;
      onUpdated?.(data);
      setAssignOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusyAction(null);
    }
  }

  function openAssignment() {
    setError(null);
    setMinPickupAt(nowDatetimeLocalInput());
    setSelectedKnightId(delivery.knight_id ?? "");
    setCustomKnightName(delivery.knight_id ? "" : (delivery.knight_name ?? ""));

    const defaults = defaultScheduleTimes();
    const taskDate = delivery.task_date ?? null;
    setPickupAt(
      resolveScheduleInput(
        delivery.app_order?.pickup_scheduled_at,
        delivery.pickup_time_window,
        taskDate,
        defaults.pickup,
      ),
    );
    setDeliveryAt(
      resolveScheduleInput(
        delivery.app_order?.delivery_scheduled_at,
        delivery.drop_time_window,
        taskDate,
        defaults.drop,
      ),
    );
    setAssignOpen(true);
  }

  function submitAssignment() {
    const currentMinute = nowDatetimeLocalInput();
    setMinPickupAt(currentMinute);

    if (!selectedKnightName) {
      setError("Choose a knight or enter a provider name");
      return;
    }
    if (pickupAt && variant !== "running" && isScheduleInputBeforeNow(pickupAt)) {
      setError("Pickup time cannot be earlier than the current time.");
      return;
    }
    if (pickupAt && !isWithinWorkingHours(pickupAt)) {
      setError(workingHoursError());
      return;
    }
    if (deliveryAt && !isWithinWorkingHours(deliveryAt)) {
      setError(workingHoursError());
      return;
    }
    if (pickupAt && deliveryAt && isScheduleInputBefore(deliveryAt, pickupAt)) {
      setError("Delivery time cannot be earlier than pickup time.");
      return;
    }

    run({
      action: "assign",
      knight_id: selectedKnightId || null,
      knight_name: selectedKnightName,
      pickup_scheduled_at: scheduleInputToIso(pickupAt),
      delivery_scheduled_at: scheduleInputToIso(deliveryAt),
    });
  }

  const isPickedUp = delivery.fulfillment_status === "active";
  const compactBtnSx = compact
    ? { px: 1, minWidth: 0, fontSize: "0.8125rem", whiteSpace: "nowrap" as const }
    : undefined;

  return (
    <Box sx={compact ? { width: "100%" } : { minWidth: 168 }}>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          flexWrap: "nowrap",
          justifyContent: compact ? "flex-end" : "flex-start",
          gap: 0.5,
        }}
      >
        {variant === "pending" ? (
          <Button
            size="small"
            variant={needsAssignmentConfirmation ? "contained" : "outlined"}
            disabled={busyAction !== null || isCancelled}
            onClick={openAssignment}
            sx={compactBtnSx}
          >
            {assignLabel}
          </Button>
        ) : null}

        {variant === "running" ? (
          <>
            <Button
              size="small"
              variant="outlined"
              disabled={busyAction !== null || isCancelled}
              onClick={openAssignment}
              sx={compactBtnSx}
            >
              Edit
            </Button>
            {isPickedUp ? (
              <Button
                size="small"
                variant="contained"
                disabled={busyAction !== null || isCancelled}
                onClick={() => run({ action: "deliver" })}
                sx={compactBtnSx}
              >
                {busyAction === "deliver" ? "…" : "Done"}
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                disabled={busyAction !== null || isCancelled}
                onClick={() => run({ action: "pickup" })}
                sx={compactBtnSx}
              >
                {busyAction === "pickup" ? "…" : "Pickup"}
              </Button>
            )}
          </>
        ) : null}

        {variant === "default" ? (
          <>
            <Button
              size="small"
              variant={needsAssignmentConfirmation ? "contained" : "outlined"}
              disabled={busyAction !== null || isCancelled}
              onClick={openAssignment}
              sx={compactBtnSx}
            >
              {assignLabel}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busyAction !== null || isCancelled}
              onClick={() => run({ action: "pickup" })}
              sx={compactBtnSx}
            >
              {busyAction === "pickup" ? "…" : "Pickup"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busyAction !== null || isCancelled}
              onClick={() => run({ action: "deliver" })}
              sx={compactBtnSx}
            >
              {busyAction === "deliver" ? "…" : compact ? "Done" : "Delivered"}
            </Button>
          </>
        ) : null}
      </Stack>

      {error && !assignOpen ? (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75 }}>
          {error}
        </Typography>
      ) : null}

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          {variant === "running"
            ? "Edit assignment"
            : needsAssignmentConfirmation
              ? "Assign knight and start delivery"
              : "Assign knight and time"}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {variant === "running"
              ? "Change the knight or scheduled pickup/delivery times."
              : needsAssignmentConfirmation
                ? "Choose who will handle this delivery. This confirms the booking and starts delivery in the app."
                : "Update the delivery assignment and timing."}
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 0.5, display: "block" }}>
                Knight
              </Typography>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={selectedKnightId}
                renderValue={(value) => {
                  if (!value) return "Custom / external provider";
                  return knights.find((knight) => knight.id === value)?.display_name ?? "Knight";
                }}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedKnightId(next);
                  if (next) {
                    setCustomKnightName("");
                  } else {
                    setCustomKnightName(
                      (prev) => prev.trim() || delivery.knight_name?.trim() || "",
                    );
                  }
                }}
              >
                <MenuItem value="">Custom / external provider</MenuItem>
                {knights.map((knight) => (
                  <MenuItem key={knight.id} value={knight.id}>
                    {knight.display_name}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {!selectedKnightId ? (
              <TextField
                size="small"
                fullWidth
                required
                label="Provider name"
                value={customKnightName}
                onChange={(e) => setCustomKnightName(e.target.value)}
                placeholder="e.g. WeFast, Uber, self, or knight name"
                helperText="Required for external / third-party providers"
              />
            ) : null}

            <ScheduleDateTimeField
              label="Pickup scheduled"
              value={pickupAt}
              min={minPickupAt}
              onChange={setPickupAt}
              helperText="When the partner should collect the parcel"
            />
            <ScheduleDateTimeField
              label="Delivery scheduled"
              value={deliveryAt}
              min={pickupAt || minPickupAt}
              onChange={setDeliveryAt}
              helperText="Expected drop-off time"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" disabled={busyAction !== null} onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busyAction !== null || !selectedKnightName}
            onClick={submitAssignment}
          >
            {busyAction === "assign"
              ? "Saving…"
              : variant === "running"
                ? "Save"
                : needsAssignmentConfirmation
                  ? "Assign and start"
                  : "Assign and sync"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
