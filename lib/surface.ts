/** Design tokens — medium radius, soft gray surfaces. */
export const RADIUS = 8;

export const gray = {
  page: "#f4f6f8",
  surface: "#f8fafc",
  border: "#e2e8f0",
  muted: "#64748b",
  stripe: "#f1f5f9",
  hover: "#eef2f6",
};

/** Chart blues — match theme primary scale. */
export const chart = {
  main: "#3b82f6",
  light: "#93c5fd",
  soft: "#bfdbfe",
} as const;

/** Shared table container — medium radius, gray border. */
export const tableShellSx = {
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  overflow: "hidden",
} as const;
