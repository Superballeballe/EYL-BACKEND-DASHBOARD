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
import RefundCustomerButton from "@/components/RefundCustomerButton";
import { fmtDateTime, money } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { CancelledOrder } from "@/lib/types";

function refundChip(status: CancelledOrder["refund_status"]) {
  if (status === "pending") return <Chip size="small" color="warning" label="Refund pending" />;
  if (status === "refunded") return <Chip size="small" color="success" label="Refunded" />;
  return <Chip size="small" variant="outlined" label="No refund" />;
}

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
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Fee kept</TableCell>
            <TableCell align="right">Refund</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(row.cancelled_at)}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {row.order_code || "—"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {[row.pickup_address, row.delivery_address].filter(Boolean).join(" → ") || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.reason_label}</Typography>
                {row.reason_note ? (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {row.reason_note}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>{row.was_confirmed ? "Confirmed" : "Unconfirmed"}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {money(row.total_amount)}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {money(row.cancellation_fee)}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {money(row.refund_amount)}
              </TableCell>
              <TableCell>{refundChip(row.refund_status)}</TableCell>
              <TableCell>
                {row.refund_status === "pending" && row.refund_amount > 0 ? (
                  <RefundCustomerButton id={row.id} amount={row.refund_amount} />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
