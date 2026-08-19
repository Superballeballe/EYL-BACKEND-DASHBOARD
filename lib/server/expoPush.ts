import type { SupabaseClient } from "@supabase/supabase-js";

type OrderPushTarget = {
  user_id: string | null;
  order_code: string | null;
};

type PushTokenRow = {
  token: string | null;
};

type SendOrderAssignedOptions = {
  orderId: string;
  knightName: string;
  pickupScheduledAt?: string | null;
  deliveryScheduledAt?: string | null;
};

type OrderPushOptions = {
  orderId: string;
};

type PushPayload = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[[\w-]+\]$/.test(token) || /^ExpoPushToken\[[\w-]+\]$/.test(token);
}

function formatPushTime(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function isMissingPushTokenTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("Could not find the table 'public.app_push_tokens'") ||
    error.message?.includes("app_push_tokens' in the schema cache")
  );
}

async function loadOrderPushTokens(db: SupabaseClient, orderId: string) {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("user_id, order_code")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);

  const target = order as OrderPushTarget | null;
  if (!target?.user_id) return { target: null, pushTokens: [] as string[] };

  const { data: tokens, error: tokenError } = await db
    .from("app_push_tokens")
    .select("token")
    .eq("user_id", target.user_id)
    .eq("enabled", true);

  if (tokenError) {
    if (isMissingPushTokenTable(tokenError)) return { target, pushTokens: [] };
    throw new Error(tokenError.message);
  }

  const pushTokens = ((tokens ?? []) as PushTokenRow[])
    .map((row) => row.token)
    .filter((token): token is string => Boolean(token && isExpoPushToken(token)));

  return { target, pushTokens };
}

async function sendOrderPush(db: SupabaseClient, orderId: string, payloads: PushPayload[]) {
  if (payloads.length === 0) return { sent: 0 };

  const { target, pushTokens } = await loadOrderPushTokens(db, orderId);
  if (!target?.user_id || pushTokens.length === 0) return { sent: 0 };

  const messages = pushTokens.flatMap((to) =>
    payloads.map((payload) => ({
      to,
      sound: "default" as const,
      ...payload,
    })),
  );

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with ${response.status}`);
  }

  return { sent: messages.length };
}

function orderSuffix(orderCode: string | null | undefined) {
  return orderCode ? ` · ${orderCode}` : "";
}

/** Dashboard confirm — customer should pay within the in-app payment window. */
export async function sendOrderConfirmedNotification(db: SupabaseClient, { orderId }: OrderPushOptions) {
  const { target } = await loadOrderPushTokens(db, orderId);
  const suffix = orderSuffix(target?.order_code);

  return sendOrderPush(db, orderId, [
    {
      title: "Order confirmed",
      body: `Your order has been confirmed.${suffix}`,
      data: {
        type: "order_confirmed",
        orderId,
        orderCode: target?.order_code ?? null,
      },
    },
  ]);
}

/** @deprecated Use sendOrderConfirmedNotification — kept for callers during transition. */
export async function sendPaymentWindowNotification(db: SupabaseClient, { orderId }: OrderPushOptions) {
  return sendOrderConfirmedNotification(db, { orderId });
}

export async function sendOrderAssignedNotification(
  db: SupabaseClient,
  { orderId, knightName, pickupScheduledAt, deliveryScheduledAt }: SendOrderAssignedOptions,
) {
  const { target } = await loadOrderPushTokens(db, orderId);
  const suffix = orderSuffix(target?.order_code);
  const drop = formatPushTime(deliveryScheduledAt);
  const dropNote = drop ? ` Drop by ${drop}.` : "";

  return sendOrderPush(db, orderId, [
    {
      title: "Delivery knight assigned",
      body: `${knightName} has been assigned to your delivery.${dropNote}${suffix}`,
      data: {
        type: "order_assigned",
        orderId,
        orderCode: target?.order_code ?? null,
        pickupScheduledAt: pickupScheduledAt ?? null,
        deliveryScheduledAt: deliveryScheduledAt ?? null,
        dropScheduledAt: deliveryScheduledAt ?? null,
        pickupTime: formatPushTime(pickupScheduledAt),
        dropTime: drop,
      },
    },
  ]);
}

export async function sendPickupNotification(db: SupabaseClient, { orderId }: OrderPushOptions) {
  const { target } = await loadOrderPushTokens(db, orderId);
  const suffix = orderSuffix(target?.order_code);

  return sendOrderPush(db, orderId, [
    {
      title: "Picked up",
      body: `Your parcel has been picked up.${suffix}`,
      data: {
        type: "order_picked_up",
        orderId,
        orderCode: target?.order_code ?? null,
      },
    },
  ]);
}

export async function sendDeliveredNotification(db: SupabaseClient, { orderId }: OrderPushOptions) {
  const { target } = await loadOrderPushTokens(db, orderId);
  const suffix = orderSuffix(target?.order_code);

  return sendOrderPush(db, orderId, [
    {
      title: "Delivered",
      body: `Your order has been delivered.${suffix}`,
      data: {
        type: "order_delivered",
        orderId,
        orderCode: target?.order_code ?? null,
      },
    },
  ]);
}
