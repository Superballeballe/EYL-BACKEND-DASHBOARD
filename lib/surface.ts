/** Design tokens — dark top bar, gray frame, soft white panels: fills and shadows rather than outlines. */
export const RADIUS = 12;
/** Buttons, fields, nav items and badges. */
export const CONTROL_RADIUS = 12;
/** Dialogs get the roomiest corner. */
export const DIALOG_RADIUS = 20;

export const gray = {
  page: "#f1f1f1",
  sidebar: "#ebebeb",
  surface: "#f7f7f7",
  border: "#e3e3e3",
  muted: "#616161",
  stripe: "#ebebeb",
  hover: "#f1f1f1",
  /** A board lane: one step darker than the page so white cards sit on it. */
  lane: "#e7e7e7",
};

/** Near-black ink: body text and primary buttons. */
export const ink = {
  main: "#303030",
  dark: "#1a1a1a",
  icon: "#4a4a4a",
} as const;

/** The dark top bar and the controls that sit on it. */
export const chrome = {
  bar: "#1a1a1a",
  control: "#303030",
  border: "#4a4a4a",
  text: "#e3e3e3",
  muted: "#b5b5b5",
} as const;

/** Focus ring and links. */
export const FOCUS = "#005bd3";

/** Soft, diffuse shadows: a resting panel, a floating menu, a dialog. */
export const shadow = {
  sm: "0 1px 2px rgba(16, 24, 40, 0.04), 0 2px 12px rgba(16, 24, 40, 0.05)",
  md: "0 2px 6px rgba(16, 24, 40, 0.05), 0 8px 32px rgba(16, 24, 40, 0.12)",
  lg: "0 8px 24px rgba(16, 24, 40, 0.08), 0 24px 64px rgba(16, 24, 40, 0.2)",
} as const;

/** A light tint of the ink: the fill behind inputs and secondary buttons, and the ring a focused field wears. */
export const tint = {
  fill: "rgba(48, 48, 48, 0.06)",
  hover: "rgba(48, 48, 48, 0.1)",
  ring: "0 0 0 2px rgba(48, 48, 48, 0.22)",
} as const;

/** Chart marks: the measure being read in ink, a comparison measure in mid-gray behind it. */
export const chart = {
  main: "#1a1a1a",
  context: "#8a8a8a",
} as const;

/** The one surface every card, toolbar and table shell shares: white on the gray page, lifted by a soft shadow. */
export const panelSx = {
  borderRadius: 1,
  bgcolor: "background.paper",
  boxShadow: shadow.sm,
} as const;

/** Shared table container — a panel that clips its rows to the rounded corners. */
export const tableShellSx = {
  ...panelSx,
  overflow: "hidden",
} as const;

/** Type weights. Medium for controls and labels, semibold for titles and emphasis, bold for big figures only. */
export const weight = { medium: 500, semibold: 600, bold: 700 } as const;

/** Faint band on every other table row. */
export const ROW_BAND = "rgba(0, 0, 0, 0.03)";
