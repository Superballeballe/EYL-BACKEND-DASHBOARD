"use client";

import { Chip, Stack } from "@mui/material";
import { getDeliveryTaskBadges } from "@/lib/deliveryTaskBadges";
import type { Delivery } from "@/lib/types";

const BADGE_COLOR = {
  round_trip: "info",
  multidrop: "secondary",
} as const;

export default function DeliveryTaskBadges({
  delivery,
  inline = false,
}: {
  delivery: Pick<
    Delivery,
    "raw" | "app_order" | "drop_location" | "drop_recipient_name" | "recipient_phone"
  >;
  /** When true, render chips only (for use inside an existing Stack). */
  inline?: boolean;
}) {
  const badges = getDeliveryTaskBadges(delivery);
  if (!badges.length) return null;

  const chips = badges.map((badge) => (
    <Chip
      key={badge.key}
      size="small"
      variant="outlined"
      color={BADGE_COLOR[badge.key]}
      label={badge.label}
    />
  ));

  if (inline) return <>{chips}</>;

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
      {chips}
    </Stack>
  );
}
