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
};

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[[\w-]+\]$/.test(token) || /^ExpoPushToken\[[\w-]+\]$/.test(token);
}

export async function sendOrderAssignedNotification(
  db: SupabaseClient,
  { orderId, knightName }: SendOrderAssignedOptions,
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

  if (tokenError) throw new Error(tokenError.message);

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
      orderCode: target.order_code
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
