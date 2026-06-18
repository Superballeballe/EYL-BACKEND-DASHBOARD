"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type KnightOpt = { id: string; display_name: string };
type AppOrderSummary = {
  status: string | null;
  pickup_scheduled_at?: string | null;
  delivery_scheduled_at?: string | null;
};
type DeliverySnapshot = {
  id: string;
  app_order_id: string | null;
  knight_id: string | null;
  knight_name: string | null;
  fulfillment_status: string | null;
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

const statusRank: Record<string, number> = {
  registered: 0,
  placed: 0,
  accepted: 1,
  rider_assigned: 2,
  picked_up: 3,
  in_transit: 3,
  delivered: 4,
  cancelled: -1,
};

function toInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function DeliveryLifecycleActions({
  delivery,
  knights,
}: {
  delivery: DeliverySnapshot;
  knights: KnightOpt[];
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ActionPayload["action"] | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKnightId, setSelectedKnightId] = useState(delivery.knight_id ?? "");
  const [customKnightName, setCustomKnightName] = useState(delivery.knight_id ? "" : delivery.knight_name ?? "");
  const [pickupAt, setPickupAt] = useState(toInputValue(delivery.app_order?.pickup_scheduled_at));
  const [deliveryAt, setDeliveryAt] = useState(toInputValue(delivery.app_order?.delivery_scheduled_at));

  const appStatus = delivery.app_order?.status ?? (delivery.app_order_id ? "registered" : null);
  const appRank = statusRank[appStatus ?? ""] ?? 0;
  const isAppOrder = Boolean(delivery.app_order_id);
  const hasKnight = Boolean(delivery.knight_name?.trim() || delivery.knight_id);
  const needsAssignmentConfirmation = isAppOrder && !hasKnight && appRank < statusRank.rider_assigned;
  const isCancelled = appStatus === "cancelled" || delivery.fulfillment_status === "cancelled";
  const isDelivered = appStatus === "delivered" || delivery.fulfillment_status === "delivered";
  const isPickedUp = delivery.fulfillment_status === "picked_up";

  const selectedKnightName = useMemo(() => {
    if (!selectedKnightId) return customKnightName.trim();
    return knights.find((knight) => knight.id === selectedKnightId)?.display_name ?? customKnightName.trim();
  }, [customKnightName, knights, selectedKnightId]);

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

      setAssignOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusyAction(null);
    }
  }

  function submitAssignment() {
    if (!selectedKnightName) {
      setError("Choose a knight or enter a provider name");
      return;
    }

    run({
      action: "assign",
      knight_id: selectedKnightId || null,
      knight_name: selectedKnightName,
      pickup_scheduled_at: toIso(pickupAt),
      delivery_scheduled_at: toIso(deliveryAt),
    });
  }

  return (
    <div className="min-w-[13rem]">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${needsAssignmentConfirmation ? "btn-primary" : "btn-secondary"} px-2 py-1 text-xs`}
          disabled={busyAction !== null || isCancelled || isDelivered}
          onClick={() => setAssignOpen(true)}
        >
          {needsAssignmentConfirmation ? "Assign knight & start" : "Assign knight"}
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          disabled={busyAction !== null || needsAssignmentConfirmation || isCancelled || isDelivered || isPickedUp}
          onClick={() => run({ action: "pickup" })}
        >
          {busyAction === "pickup" ? "Saving..." : "Pickup"}
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          disabled={busyAction !== null || isCancelled || isDelivered}
          onClick={() => run({ action: "deliver" })}
        >
          {busyAction === "deliver" ? "Saving..." : "Delivered"}
        </button>
      </div>

      {error ? <div className="mt-2 text-xs text-[#b42318]">{error}</div> : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="card w-full max-w-md bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-bold">
                {needsAssignmentConfirmation ? "Assign knight and start delivery" : "Assign knight and time"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {needsAssignmentConfirmation
                  ? "Choose who will handle this delivery. This confirms the booking and starts delivery in the app."
                  : "Update the delivery assignment and timing."}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Knight</label>
                <select
                  className="select"
                  value={selectedKnightId}
                  onChange={(event) => {
                    setSelectedKnightId(event.target.value);
                    if (event.target.value) setCustomKnightName("");
                  }}
                >
                  <option value="">Custom / external provider</option>
                  {knights.map((knight) => (
                    <option key={knight.id} value={knight.id}>
                      {knight.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedKnightId ? (
                <div>
                  <label className="label">Provider name</label>
                  <input
                    className="input"
                    value={customKnightName}
                    onChange={(event) => setCustomKnightName(event.target.value)}
                    placeholder="Type knight, vendor, or self"
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Pickup time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={pickupAt}
                    onChange={(event) => setPickupAt(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Delivery time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={deliveryAt}
                    onChange={(event) => setDeliveryAt(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busyAction !== null}
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyAction !== null || !selectedKnightName}
                onClick={submitAssignment}
              >
                {busyAction === "assign"
                  ? "Assigning..."
                  : needsAssignmentConfirmation
                    ? "Assign and start"
                    : "Assign and sync"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
