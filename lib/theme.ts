"use client";

import { createTheme } from "@mui/material/styles";
import { type Shadows } from "@mui/material/styles";
import { CONTROL_RADIUS, DIALOG_RADIUS, FOCUS, gray, ink, RADIUS, ROW_BAND, shadow, tint, weight } from "@/lib/surface";

/** Near-black ink on a gray frame. Soft by design: fills, tints and diffuse shadows instead of outlines and rules. */
export { gray, RADIUS } from "@/lib/surface";

/** Status chips are soft tints of their tone, not solid fills. */
const CHIP_TINTS = {
  primary: { bg: "#e0f0ff", fg: "#00527c", hover: "#cae6ff" },
  info: { bg: "#e0f0ff", fg: "#00527c", hover: "#cae6ff" },
  success: { bg: "#cdfee1", fg: "#0c5132", hover: "#b4fed2" },
  warning: { bg: "#ffd6a4", fg: "#5e4200", hover: "#ffc879" },
  error: { bg: "#fedad9", fg: "#8e0b21", hover: "#fec1c7" },
  default: { bg: "rgba(0, 0, 0, 0.06)", fg: gray.muted, hover: "rgba(0, 0, 0, 0.1)" },
} as const;

/** MUI's 25 elevations, remapped onto three soft shadows: resting (1–3), floating (4–12), modal (13–24). */
const SHADOWS = [
  "none",
  ...Array.from({ length: 24 }, (_, i) => (i < 3 ? shadow.sm : i < 12 ? shadow.md : shadow.lg)),
] as Shadows;

/** A filled field with no label above its value: its parent form control has no label, or it has no form control. */
// The leading `*` matters: a selector that starts with a pseudo-class is read as applying to the field itself.
const NO_LABEL = ".MuiFormControl-root:not(:has(> .MuiInputLabel-root)) > &, *:not(.MuiFormControl-root) > &";

/** Floating labels shrink to 12px rather than MUI's 0.75 of a 14px field. */
const LABEL_SHRINK = 0.857;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: ink.main, light: gray.muted, dark: ink.dark, contrastText: "#fff" },
    secondary: { main: gray.border, contrastText: ink.main },
    error: { main: "#c70a24" },
    warning: { main: "#b28400" },
    success: { main: "#047b5d" },
    info: { main: "#0094d5" },
    background: { default: gray.page, paper: "#ffffff" },
    text: { primary: ink.main, secondary: gray.muted, disabled: "#b5b5b5" },
    divider: gray.border,
    action: { hover: "rgba(0, 0, 0, 0.05)", selected: "rgba(0, 0, 0, 0.08)" },
  },
  shape: { borderRadius: RADIUS },
  shadows: SHADOWS,
  typography: {
    fontFamily: [
      "var(--font-sans)",
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "sans-serif",
    ].join(","),
    // h1 page title · h2 card and section title · h4 big figure · h6 dialog title and record name.
    h1: { fontSize: "1.25rem", fontWeight: weight.semibold, letterSpacing: "-0.0125em", lineHeight: 1.2 },
    h2: { fontSize: "0.875rem", fontWeight: weight.semibold, lineHeight: 1.43 },
    h4: { fontSize: "1.625rem", fontWeight: weight.bold, letterSpacing: "-0.02em", lineHeight: 1.15 },
    h5: { fontSize: "1.25rem", fontWeight: weight.semibold, letterSpacing: "-0.0125em", lineHeight: 1.3 },
    h6: { fontSize: "1.125rem", fontWeight: weight.semibold, letterSpacing: "-0.01em", lineHeight: 1.35 },
    subtitle1: { fontSize: "0.875rem", fontWeight: weight.semibold },
    subtitle2: { fontSize: "0.8125rem", fontWeight: weight.semibold },
    body1: { fontSize: "0.875rem" },
    body2: { fontSize: "0.8125rem" },
    button: { textTransform: "none", fontWeight: weight.semibold },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: gray.page },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": { outline: `2px solid ${FOCUS}`, outlineOffset: 1 },
        },
      },
    },
    MuiButton: {
      // Filled by default. `outlined` is the soft tonal secondary; `text` is the quiet one.
      defaultProps: { disableElevation: true, variant: "contained" },
      styleOverrides: {
        root: {
          borderRadius: CONTROL_RADIUS,
          minHeight: 36,
          paddingBlock: 6,
          paddingInline: 16,
          fontSize: "0.8125rem",
          lineHeight: "20px",
          "&.Mui-disabled": { opacity: 0.5 },
          variants: [
            {
              props: { variant: "outlined" },
              style: {
                border: "none",
                backgroundColor: tint.fill,
                color: ink.main,
                "&:hover": { border: "none", backgroundColor: tint.hover },
              },
            },
            {
              props: { variant: "outlined", color: "error" },
              style: {
                backgroundColor: "#fee9e8",
                color: "#8e0b21",
                "&:hover": { backgroundColor: "#fedad9" },
              },
            },
            {
              props: { variant: "text" },
              style: { "&:hover": { backgroundColor: tint.fill } },
            },
          ],
        },
        sizeSmall: { minHeight: 32, paddingBlock: 4, paddingInline: 12 },
        sizeLarge: { minHeight: 44, paddingInline: 20, fontSize: "0.875rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: CONTROL_RADIUS },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          border: "none",
          boxShadow: shadow.sm,
          backgroundColor: "#fff",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { "&:last-child": { paddingBottom: 16 } },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: RADIUS, backgroundImage: "none" },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        // Menus and popovers use an invisible backdrop; only real scrims get the tint and blur.
        root: {
          "&:not(.MuiBackdrop-invisible)": {
            backgroundColor: "rgba(26, 26, 26, 0.32)",
            backdropFilter: "blur(2px)",
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 14, boxShadow: shadow.md },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 14, boxShadow: shadow.md },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 36, paddingInline: 10, fontSize: "0.8125rem" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: ink.main, borderRadius: 8, fontSize: "0.75rem" },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: gray.stripe },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: DIALOG_RADIUS, boxShadow: shadow.lg },
      },
    },
    // Dialogs are spaced, not ruled: 24px gutters, and a clear gap between title, body and actions.
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: "24px 24px 12px" },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: "12px 24px 20px" },
        dividers: { borderTop: "none", borderBottom: "none" },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: { color: gray.muted, fontSize: "0.875rem" },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          gap: 4,
          padding: "4px 24px 24px",
          "& .MuiButton-root": { minHeight: 44, paddingInline: 20, fontSize: "0.875rem" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: CONTROL_RADIUS,
          height: 24,
          fontSize: "0.75rem",
          fontWeight: weight.medium,
          variants: (Object.keys(CHIP_TINTS) as (keyof typeof CHIP_TINTS)[]).map((color) => ({
            props: { variant: "filled" as const, color },
            style: {
              backgroundColor: CHIP_TINTS[color].bg,
              color: CHIP_TINTS[color].fg,
              "&.MuiChip-clickable:hover": { backgroundColor: CHIP_TINTS[color].hover },
            },
          })),
        },
        sizeSmall: { height: 20 },
        outlined: { borderColor: gray.border, backgroundColor: "transparent" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: 28,
          minWidth: 0,
          padding: "4px 12px",
          borderRadius: CONTROL_RADIUS,
          fontSize: "0.8125rem",
          fontWeight: weight.medium,
          color: gray.muted,
          "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.05)" },
          "&.Mui-selected": { backgroundColor: "rgba(0, 0, 0, 0.08)", color: ink.main },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 28 },
        list: { gap: 4 },
        indicator: { display: "none" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: "0.8125rem" },
        head: {
          fontSize: "0.75rem",
          fontWeight: weight.medium,
          color: gray.muted,
          backgroundColor: gray.surface,
          borderBottom: "none",
        },
        body: { borderColor: gray.stripe },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          ".MuiTableBody-root > &:nth-of-type(even):not(:hover):not(:focus-visible)": { backgroundColor: ROW_BAND },
          "&:hover": { backgroundColor: gray.surface },
          "&:last-of-type > .MuiTableCell-body": { borderBottom: "none" },
        },
      },
    },
    // Fields are filled, not outlined: a tinted ground, no border or underline, and a soft ring on focus.
    MuiTextField: { defaultProps: { variant: "filled" } },
    MuiFormControl: { defaultProps: { variant: "filled" } },
    MuiSelect: { defaultProps: { variant: "filled" } },
    MuiFilledInput: {
      defaultProps: { disableUnderline: true },
      styleOverrides: {
        root: {
          borderRadius: CONTROL_RADIUS,
          backgroundColor: tint.fill,
          transition: "background-color .15s, box-shadow .15s",
          "&:hover": { backgroundColor: tint.hover },
          "&.Mui-focused": { backgroundColor: "#fff", boxShadow: tint.ring },
          "&.Mui-error": { boxShadow: "0 0 0 2px rgba(199, 10, 36, 0.35)" },
          "&.Mui-disabled": { backgroundColor: tint.fill, opacity: 0.6 },
          // MUI reserves the top of a filled field for its label; without one, centre the value instead.
          [NO_LABEL]: {
            "& .MuiFilledInput-input:not(.MuiInputBase-inputMultiline)": { paddingTop: 14, paddingBottom: 14 },
            "&.MuiInputBase-sizeSmall .MuiFilledInput-input:not(.MuiInputBase-inputMultiline)": {
              paddingTop: 8,
              paddingBottom: 8,
            },
            "&.MuiInputBase-multiline": { paddingTop: 14, paddingBottom: 14 },
            "& .MuiInputAdornment-positionStart.MuiInputAdornment-filled": { marginTop: 0 },
          },
        },
      },
    },
    // Kept soft for any field that opts back into the outlined variant.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: CONTROL_RADIUS,
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: ink.main },
        },
        notchedOutline: {
          borderColor: gray.border,
          "& legend": { fontSize: `${LABEL_SHRINK}em` },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: gray.muted,
          "&.MuiInputLabel-filled.MuiInputLabel-shrink": { transform: `translate(12px, 7px) scale(${LABEL_SHRINK})` },
          "&.MuiInputLabel-filled.MuiInputLabel-shrink.MuiInputLabel-sizeSmall": {
            transform: `translate(12px, 4px) scale(${LABEL_SHRINK})`,
          },
          "&.MuiInputLabel-outlined.MuiInputLabel-shrink": {
            transform: `translate(14px, -9px) scale(${LABEL_SHRINK})`,
            maxWidth: `calc(${Math.round(100 / LABEL_SHRINK)}% - 32px)`,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        // MUI's own tinted fill per severity; no outline.
        root: { borderRadius: CONTROL_RADIUS, fontSize: "0.8125rem" },
      },
    },
  },
});
