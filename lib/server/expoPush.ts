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

export async function sendOrderAssignedNotification(
  db: SupabaseClient,
  { orderId, knightName, pickupScheduledAt, deliveryScheduledAt }: SendOrderAssignedOptions,
) {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("user_id, order_code")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);

  const target = order as OrderPushTarget | null;
  if (!target?.user_id) return { sent: 0 };

  const { data: tokens, error: tokenError } = await db
    .from("app_push_tokens")
    .select("token")
    .eq("user_id", target.user_id)
    .eq("enabled", true);

  if (tokenError) {
    if (isMissingPushTokenTable(tokenError)) return { sent: 0 };
    throw new Error(tokenError.message);
  }

  const pushTokens = ((tokens ?? []) as PushTokenRow[])
    .map((row) => row.token)
    .filter((token): token is string => Boolean(token && isExpoPushToken(token)));

  if (pushTokens.length === 0) return { sent: 0 };

  const messages = pushTokens.map((to) => ({
    to,
    sound: "default",
    title: "Delivery started",
    body: `${knightName} has been assigned to your order.`,
    data: {
      type: "order_assigned",
      orderId,
      orderCode: target.order_code,
      pickupScheduledAt: pickupScheduledAt ?? null,
      deliveryScheduledAt: deliveryScheduledAt ?? null,
      dropScheduledAt: deliveryScheduledAt ?? null,
      pickupTime: formatPushTime(pickupScheduledAt),
      dropTime: formatPushTime(deliveryScheduledAt)
    }
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messages)
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with ${response.status}`);
  }

  return { sent: messages.length };
}
