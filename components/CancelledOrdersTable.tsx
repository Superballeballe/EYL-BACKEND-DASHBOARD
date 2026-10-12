import Link from "next/link";
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/ui";
import RetryRefundButton from "@/components/RetryRefundButton";
import { fmtDateTime, money } from "@/lib/format";
import { cancelledRefundPaise, formatPaise, originOfCancellation, refundOriginLabel, refundStatusInfo } from "@/lib/refunds";
import { tableShellSx } from "@/lib/surface";
import type { CancelledOrder } from "@/lib/types";

export default function CancelledOrdersTable({
  rows,
  emptyMessage = "No cancelled orders.",
}: {
  rows: CancelledOrder[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 220,
          borderRadius: 1,
          border: `1px dashed`,
          borderColor: "divider",
        }}
      >
        <EmptyState message={emptyMessage} compact />
      </Box>
    );
  }

  return (
    <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Cancelled</TableCell>
            <TableCell>Order · route</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Stage</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell align="right">Refund</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const status = refundStatusInfo(row.refund_status);
            const refundPaise = cancelledRefundPaise(row);
            return (
              <TableRow key={row.id}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(row.cancelled_at)}</TableCell>
                <TableCell>
                  {row.order_id ? (
                    <Link href={`/refunds/orders/${row.order_id}`} style={{ fontWeight: 600 }}>
                      {row.order_code || "—"}
                    </Link>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.order_code || "—"}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {[row.pickup_address, row.delivery_address].filter(Boolean).join(" → ") || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.reason_label}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {refundOriginLabel(originOfCancellation(row))}
                    {row.reason_note ? ` · ${row.reason_note}` : ""}
                  </Typography>
                </TableCell>
                <TableCell>{row.was_confirmed ? "Confirmed" : "Unconfirmed"}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {money(row.total_amount)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {row.refund_status === "none" ? "—" : formatPaise(refundPaise)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={status.color}
                    variant={status.color === "default" ? "outlined" : "filled"}
                    label={status.label}
                  />
                  {row.refund_ref ? (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                      {row.refund_ref}
                    </Typography>
                  ) : null}
                  {row.refund_status === "failed" && row.refund_last_error ? (
                    <Typography variant="caption" sx={{ color: "error.main", display: "block" }}>
                      {row.refund_last_error}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.refund_status === "failed" ? <RetryRefundButton id={row.id} amountPaise={refundPaise} /> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
