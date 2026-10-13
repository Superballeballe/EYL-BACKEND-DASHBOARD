"use client";

import { Box, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import TwoWheelerOutlinedIcon from "@mui/icons-material/TwoWheelerOutlined";
import { DELIVERY_FORM_STEPS } from "@/components/DeliveryForm";
import { CONTROL_RADIUS, FOCUS, gray } from "@/lib/surface";

/** Shared size for the order dialogs: fixed, so the pane doesn't jump as the rail switches views. */
export const RAIL_DIALOG_HEIGHT = "min(760px, calc(100vh - 64px))";

/** The dialog body: rail beside the pane, or stacked above it on a narrow screen. */
export const railDialogSx = {
  display: "flex",
  flexDirection: { xs: "column", md: "row" },
  height: RAIL_DIALOG_HEIGHT,
  overflow: "hidden",
} as const;

/** The navigation rail down the left of a dialog; a horizontal strip on a narrow screen. */
export function DialogRail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      component="nav"
      aria-label={label}
      sx={{
        flexShrink: 0,
        width: { xs: "100%", md: 224 },
        display: "flex",
        flexDirection: { xs: "row", md: "column" },
        gap: { xs: 0.5, md: 0 },
        p: 1.5,
        overflow: "auto",
        bgcolor: gray.surface,
      }}
    >
      {children}
    </Box>
  );
}

export function RailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, gap: 0.5, mb: { md: 2 } }}>
      <Typography
        variant="caption"
        sx={{ display: { xs: "none", md: "block" }, px: 1, mb: 0.25, color: "text.secondary", fontWeight: 600 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function RailItem({
  icon,
  label,
  selected = false,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        flexShrink: 0,
        width: { md: "100%" },
        minHeight: 36,
        px: 1,
        border: "none",
        borderRadius: `${CONTROL_RADIUS}px`,
        bgcolor: selected ? "action.selected" : "transparent",
        color: danger ? "error.main" : "text.primary",
        font: "inherit",
        fontSize: "0.8125rem",
        fontWeight: selected ? 600 : 500,
        textAlign: "left",
        whiteSpace: "nowrap",
        cursor: "pointer",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
        "&:focus-visible": { outline: `2px solid ${FOCUS}`, outlineOffset: 1 },
        "& svg": { fontSize: 18, color: danger ? "error.main" : selected ? "text.primary" : "text.secondary" },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

const STEP_ICONS = [
  EventNoteOutlinedIcon,
  RouteOutlinedIcon,
  TwoWheelerOutlinedIcon,
  CurrencyRupeeOutlinedIcon,
  ReceiptLongOutlinedIcon,
] as const;

/** One rail item per delivery-form section. `doneBefore` ticks off the steps already passed in a wizard. */
export function DeliveryStepItems({
  current,
  doneBefore = 0,
  onSelect,
}: {
  current: number | null;
  doneBefore?: number;
  onSelect: (step: number) => void;
}) {
  return (
    <>
      {DELIVERY_FORM_STEPS.map((label, index) => {
        const Icon = index < doneBefore ? CheckCircleIcon : STEP_ICONS[index];
        return (
          <RailItem
            key={label}
            icon={<Icon />}
            label={label}
            selected={current === index}
            onClick={() => onSelect(index)}
          />
        );
      })}
    </>
  );
}
