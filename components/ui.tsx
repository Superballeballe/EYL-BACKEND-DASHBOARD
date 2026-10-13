import Link from "next/link";
import { Box, Card, CardContent, Chip, Typography } from "@mui/material";
import { gray } from "@/lib/surface";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mb: 2,
        minHeight: 32,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h1">{title}</Typography>
        {subtitle ? (
          <Box sx={{ mt: 0.25, color: "text.secondary", typography: "body2" }}>{subtitle}</Box>
        ) : null}
      </Box>
      {action}
    </Box>
  );
}

const TONE_COLOR = {
  default: "text.primary",
  green: "primary.main",
  red: "error.main",
  amber: "warning.main",
} as const;

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const card = (
    <Card
      sx={{
        height: "100%",
        transition: "background-color .15s",
        bgcolor: "#fff",
        ...(href ? { "&:hover": { bgcolor: gray.surface } } : null),
      }}
    >
      <CardContent sx={{ py: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color: TONE_COLOR[tone] }}>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary", display: "block" }}>
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return card;
  return (
    <Box
      component={Link}
      href={href}
      sx={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      {card}
    </Box>
  );
}

/** Money that has landed is green, a waiver is blue, a part-payment is amber; unpaid stays an outline. */
const PAYMENT_TONE: Record<string, "success" | "info" | "warning"> = {
  paid: "success",
  free: "info",
  coupon: "info",
  partial: "warning",
};

export function PaymentBadge({
  status,
  mode,
}: {
  status?: string | null;
  mode?: string | null;
}) {
  const modeLabel = mode?.trim().toLowerCase();
  const label =
    modeLabel === "coupon"
      ? "coupon"
      : modeLabel && !status
        ? modeLabel
        : status || modeLabel || null;
  if (!label) return <Chip size="small" label="—" variant="outlined" />;
  const tone = PAYMENT_TONE[label];
  return <Chip size="small" color={tone ?? "default"} label={label} variant={tone ? "filled" : "outlined"} />;
}

const FULFILLMENT_LABEL: Record<string, string> = {
  booked: "Booked",
  accepted: "Accepted",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Booked still needs someone to act; accepted is waiting; active is on the road. */
const FULFILLMENT_TONE = {
  booked: "warning",
  accepted: "default",
  active: "info",
  completed: "success",
  cancelled: "error",
} as const;

export function FulfillmentBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Chip size="small" label="—" variant="outlined" />;
  const tone = FULFILLMENT_TONE[status as keyof typeof FULFILLMENT_TONE];
  return (
    <Chip
      size="small"
      label={FULFILLMENT_LABEL[status] ?? status}
      color={tone ?? "default"}
      variant={tone ? "filled" : "outlined"}
    />
  );
}

export function EmptyState({
  message,
  compact = false,
  minHeight,
}: {
  message: string;
  compact?: boolean;
  /** Hold the box open to this height, with the message centred — for a table's place on the page. */
  minHeight?: number;
}) {
  if (compact) {
    return (
      <Box
        sx={{
          py: 2.5,
          px: 2,
          textAlign: "center",
          borderRadius: 1,
          border: "1px dashed",
          borderColor: "divider",
          bgcolor: gray.surface,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {message}
        </Typography>
      </Box>
    );
  }

  return (
    <Card
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        bgcolor: gray.surface,
        border: "1px dashed",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ py: 5, textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {message}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ color: "text.primary", display: "block", mb: 1.5 }}>
      {children}
    </Typography>
  );
}
