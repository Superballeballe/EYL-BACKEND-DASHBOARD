"use client";

import { createTheme } from "@mui/material/styles";
import { gray, RADIUS } from "@/lib/surface";

/** White + blue accents, medium corners, soft gray surfaces. */
export { gray, RADIUS } from "@/lib/surface";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3b82f6", light: "#93c5fd", dark: "#2563eb", contrastText: "#fff" },
    secondary: { main: gray.surface, contrastText: "#334155" },
    error: { main: "#dc2626" },
    warning: { main: "#d97706" },
    background: { default: gray.page, paper: "#ffffff" },
    text: { primary: "#111827", secondary: gray.muted },
    divider: gray.border,
    action: { hover: gray.hover, selected: "#eff6ff" },
  },
  shape: { borderRadius: RADIUS },
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
    h1: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.125rem", fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: gray.page },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: RADIUS, paddingInline: 16 },
        contained: { boxShadow: "none" },
        outlined: {
          borderColor: gray.border,
          backgroundColor: "#fff",
          "&:hover": { backgroundColor: gray.surface, borderColor: "#cbd5e1" },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          border: `1px solid ${gray.border}`,
          boxShadow: "none",
          backgroundColor: "#fff",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: RADIUS, backgroundImage: "none" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: RADIUS,
          border: `1px solid ${gray.border}`,
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.12)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          backgroundColor: gray.surface,
          borderBottom: `1px solid ${gray.border}`,
          fontWeight: 700,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { backgroundColor: "#fff" },
        dividers: { borderColor: gray.border },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600 },
        outlined: { borderColor: gray.border, backgroundColor: "#fff" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, minHeight: 44 },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${gray.border}` },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: "0.72rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: gray.muted,
          backgroundColor: gray.surface,
          borderBottom: `1px solid ${gray.border}`,
        },
        body: { borderColor: gray.border },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:nth-of-type(even)": { backgroundColor: gray.stripe },
          "&:hover": { backgroundColor: gray.hover },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          backgroundColor: gray.surface,
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
        },
        notchedOutline: { borderColor: gray.border },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: gray.muted },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { backgroundColor: gray.surface },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          backgroundColor: gray.surface,
          border: `1px solid ${gray.border}`,
        },
      },
    },
  },
});
