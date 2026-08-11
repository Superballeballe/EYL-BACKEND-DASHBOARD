"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { EmptyState } from "@/components/ui";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fmtDateTime, money } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { AppInvoice } from "@/lib/types";

const SELLER_GSTIN = "27AAECE3280H1ZO";

function isTaxInvoice(inv: AppInvoice) {
  return inv.invoice_type === "tax_invoice" || inv.is_gst === true || (inv.tax_amount ?? 0) > 0;
}

function taxSummary(inv: AppInvoice) {
  if (inv.is_interstate) {
    return inv.igst_amount ? `IGST ${money(inv.igst_amount)}` : "IGST";
  }
  const parts: string[] = [];
  if (inv.cgst_amount) parts.push(`CGST ${money(inv.cgst_amount)}`);
  if (inv.sgst_amount) parts.push(`SGST ${money(inv.sgst_amount)}`);
  return parts.length ? parts.join(" · ") : "—";
}

function taxTypeLabel(inv: AppInvoice) {
  return isTaxInvoice(inv) ? "Tax Invoice" : inv.invoice_type ?? "Receipt";
}

function amount(n: number | null | undefined) {
  if (n == null) return "";
  return String(Math.round(Number(n) || 0));
}

function exportInvoicesCsv(rows: AppInvoice[], filter: "all" | "tax") {
  const header = [
    "Invoice Number",
    "Order Code",
    "Invoice Type",
    "Issued At (IST)",
    "Payment Method",
    "Payment Status",
    "Seller GSTIN",
    "Buyer GSTIN",
    "Supply Type",
    "Taxable Value (INR)",
    "CGST (INR)",
    "SGST (INR)",
    "IGST (INR)",
    "Total Tax (INR)",
    "Discount (INR)",
    "Invoice Total (INR)",
    "Coupon Code",
    "Coupon Discount (INR)",
  ];

  const body = rows.map((inv) => [
    inv.invoice_number,
    inv.orders?.order_code ?? "",
    taxTypeLabel(inv),
    fmtDateTime(inv.issued_at),
    inv.metadata?.payment_label ?? inv.payment_method ?? "",
    inv.payment_status ?? "",
    inv.seller_gstin ?? "",
    inv.buyer_gstin ?? "",
    inv.is_interstate ? "Inter-State" : "Intra-State",
    amount(inv.taxable_value ?? inv.subtotal),
    amount(inv.cgst_amount),
    amount(inv.sgst_amount),
    amount(inv.igst_amount),
    amount(inv.tax_amount),
    amount(inv.discount_amount),
    amount(inv.total_amount),
    inv.metadata?.coupon?.code ?? "",
    amount(inv.metadata?.coupon?.discount),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const scope = filter === "tax" ? "tax-invoices" : "all-invoices";
  downloadCsv(`eyl-${scope}-${today}.csv`, toCsv([header, ...body]));
}

export default function InvoicesBoard({ invoices }: { invoices: AppInvoice[] }) {
  const [filter, setFilter] = useState<"all" | "tax">("tax");

  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter(isTaxInvoice);
  }, [filter, invoices]);

  const taxCount = useMemo(() => invoices.filter(isTaxInvoice).length, [invoices]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          mb: 2.5,
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Source: Supabase <code>public.invoices</code>
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Seller GSTIN {SELLER_GSTIN} · {taxCount} tax invoice{taxCount === 1 ? "" : "s"} · {invoices.length} total
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="invoice-filter-label">Show</InputLabel>
            <Select
              labelId="invoice-filter-label"
              label="Show"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "tax")}
            >
              <MenuItem value="tax">Tax invoices only</MenuItem>
              <MenuItem value="all">All invoices</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TableChartOutlinedIcon />}
            disabled={filtered.length === 0}
            onClick={() => exportInvoicesCsv(filtered, filter)}
          >
            Download CSV ({filtered.length})
          </Button>
        </Stack>
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState message="No invoices match this filter." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell>Tax</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Coupon</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell align="right" sx={{ width: 96 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id} hover sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    <Link href={`/invoices/${inv.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {inv.orders?.order_code ?? "—"}
                  </TableCell>
                  <TableCell>
                    {isTaxInvoice(inv) ? (
                      <Chip size="small" color="primary" label="tax invoice" />
                    ) : (
                      <Chip size="small" variant="outlined" label={inv.invoice_type ?? "receipt"} />
                    )}
                  </TableCell>
                  <TableCell align="right">{money(inv.taxable_value ?? inv.subtotal)}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>{taxSummary(inv)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {money(inv.total_amount)}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {inv.metadata?.coupon?.code ?? "—"}
                  </TableCell>
                  <TableCell>{fmtDateTime(inv.issued_at)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="View invoice">
                        <IconButton
                          size="small"
                          component={Link}
                          href={`/invoices/${inv.id}`}
                          aria-label={`View ${inv.invoice_number}`}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download HTML">
                        <IconButton
                          size="small"
                          component="a"
                          href={`/api/invoices/${inv.id}/html?download=1`}
                          aria-label={`Download ${inv.invoice_number}`}
                        >
                          <DownloadOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
