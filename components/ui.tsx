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
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        mb: 3,
        p: 2.5,
        borderRadius: 1,
        border: `1px solid ${gray.border}`,
        bgcolor: "#fff",
      }}
    >
      <Box>
        <Typography variant="h1">{title}</Typography>
        {subtitle ? (
          <Box sx={{ mt: 0.5, color: "text.secondary", typography: "body2" }}>{subtitle}</Box>
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
        transition: "border-color .15s, background-color .15s",
        bgcolor: "#fff",
        ...(href ? { "&:hover": { borderColor: "primary.light", bgcolor: gray.surface } } : null),
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "inline-block",
            px: 1,
            py: 0.25,
            mb: 1,
            borderRadius: 0.75,
            bgcolor: gray.surface,
            typography: "overline",
            color: "text.secondary",
            fontWeight: 700,
          }}
        >
          {label}
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: TONE_COLOR[tone],
          }}
        >
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
  const color = label === "paid" || label === "free" || label === "coupon" ? "primary" : "default";
  return (
    <Chip
      size="small"
      color={color as "primary" | "default"}
      label={label}
      variant={label === "unpaid" ? "outlined" : "filled"}
    />
  );
}

const FULFILLMENT_LABEL: Record<string, string> = {
  booked: "Booked",
  accepted: "Accepted",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function FulfillmentBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Chip size="small" label="—" variant="outlined" />;
  const label = FULFILLMENT_LABEL[status] ?? status;
  const strong = status === "booked" || status === "accepted" || status === "active";
  return (
    <Chip
      size="small"
      label={label}
      color={strong ? "primary" : "default"}
      variant={strong ? "filled" : "outlined"}
    />
  );
}

export function EmptyState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
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
    <Card sx={{ bgcolor: gray.surface, borderStyle: "dashed" }}>
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
    <Typography
      variant="overline"
      sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em", display: "block", mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}
