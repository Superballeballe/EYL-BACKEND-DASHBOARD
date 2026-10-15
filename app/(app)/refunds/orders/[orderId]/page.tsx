import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import AutoRefresh from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui";
import OrderRefundButton from "@/components/OrderRefundButton";
import RetryRefundButton from "@/components/RetryRefundButton";
import { fmtDateTime, money } from "@/lib/format";
import {
  cancelledRefundPaise,
  formatPaise,
  ledgerStatusInfo,
  manualRefundAction,
  originOfCancellation,
  refundOriginLabel,
  refundStatusInfo,
  reviewKindLabel,
  reviewStatusInfo,
} from "@/lib/refunds";
import { loadOrderRefund } from "@/lib/server/refundsData";
import { buildPaymentLedger, type LedgerRow } from "@/lib/paymentLedger";

export const dynamic = "force-dynamic";

const LEDGER_STATUS: Record<string, { label: string; color: "success" | "warning" | "default" }> = {
  paid: { label: "Paid", color: "success" },
  applied: { label: "Applied", color: "success" },
  needs_review: { label: "Needs review", color: "warning" },
  refunded: { label: "Refunded", color: "default" },
  resolved: { label: "Resolved", color: "default" },
};

function ledgerKindLabel(row: LedgerRow) {
  if (row.kind === "booking") return "Booking";
  if (row.kind === "address_change") return "Address change";
  return "Under review";
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ typography: "body2", minWidth: 0, wordBreak: "break-word" }}>{children}</Box>
    </Stack>
  );
}

export default async function OrderRefundPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const { order, invoice, cancelled, ledger, reviews, extras } = await loadOrderRefund(orderId);
  const payments = buildPaymentLedger({ invoice, extras, reviews });
  if (!order && !cancelled && reviews.length === 0) notFound();

  const code = order?.order_code ?? cancelled?.order_code ?? reviews[0]?.order_code ?? null;
  const refundStatus = refundStatusInfo(cancelled?.refund_status);
  const manual = manualRefundAction({
    orderStatus: order?.status ?? (cancelled ? "cancelled" : null),
    paymentStatus: invoice?.payment_status ?? null,
    refundStatus: cancelled?.refund_status ?? null,
  });

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        title={`Order ${code ?? ""}`.trim()}
        subtitle={<Link href="/refunds">← Refunds</Link>}
      />
      <Stack spacing={2.5}>
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 1 }}>
              Order
            </Typography>
            <Line label="Status">{order?.status ?? "—"}</Line>
            <Line label="Confirmed">{order?.confirmed_at ? fmtDateTime(order.confirmed_at) : "No"}</Line>
            <Line label="Payment">
              {invoice?.payment_status ?? "—"} · {money(invoice?.total_amount ?? null)}
            </Line>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 1 }}>
              Payments
            </Typography>
            {payments.rows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No payments on this order.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payment</TableCell>
                    <TableCell>Razorpay id</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell align="right">Running total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.rows.map((row) => {
                    const status = LEDGER_STATUS[row.status] ?? { label: String(row.status), color: "default" as const };
                    return (
                      <TableRow key={`${row.kind}-${row.razorpayPaymentId ?? "none"}`}>
                        <TableCell>
                          {ledgerKindLabel(row)}
                          {row.kind === "review" && row.note ? (
                            <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                              {row.note}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <code>{row.razorpayPaymentId ?? "—"}</code>
                        </TableCell>
                        <TableCell align="right">{formatPaise(row.amountPaise)}</TableCell>
                        <TableCell>
                          <Chip size="small" color={status.color} label={status.label} />
                        </TableCell>
                        <TableCell>{row.at ? fmtDateTime(row.at) : "—"}</TableCell>
                        <TableCell align="right">
                          {row.runningTotalPaise === null ? "not counted" : formatPaise(row.runningTotalPaise)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} sx={{ fontWeight: 600 }}>
                      Total paid for this order
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatPaise(payments.totalPaise)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
            {payments.reviewPaise > 0 ? (
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                {formatPaise(payments.reviewPaise)} captured but not applied: resolve it under Refunds → Needs review.
              </Typography>
            ) : null}
            {!payments.balanced ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                Payments do not add up to the invoice total ({formatPaise(payments.invoiceTotalPaise)}). Check this order.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <Typography variant="h2">Refund</Typography>
              {cancelled ? <Chip size="small" color={refundStatus.color} label={refundStatus.label} /> : null}
            </Stack>
            {cancelled ? (
              <>
                <Line label="Cancelled">{fmtDateTime(cancelled.cancelled_at)}</Line>
                <Line label="Reason">
                  {cancelled.reason_label} · {refundOriginLabel(originOfCancellation(cancelled))}
                </Line>
                <Line label="Amount">
                  {cancelled.refund_status === "none" ? "No refund due" : formatPaise(cancelledRefundPaise(cancelled))}
                </Line>
                <Line label="Razorpay refund id">
                  <code>{cancelled.refund_ref ?? "—"}</code>
                </Line>
                {cancelled.refunded_at ? <Line label="Refunded at">{fmtDateTime(cancelled.refunded_at)}</Line> : null}
                {cancelled.refund_attempts ? <Line label="Attempts">{cancelled.refund_attempts}</Line> : null}
                {cancelled.refund_status === "failed" && cancelled.refund_last_error ? (
                  <Line label="Last error">
                    <Typography variant="body2" sx={{ color: "error.main" }}>
                      {cancelled.refund_last_error}
                    </Typography>
                  </Line>
                ) : null}
                {cancelled.refund_resolution_note ? (
                  <Line label="Resolution">
                    {cancelled.refund_resolution_note}
                    {cancelled.refund_resolved_by ? ` · ${cancelled.refund_resolved_by}` : ""}
                  </Line>
                ) : null}
              </>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No cancellation refund for this order.
              </Typography>
            )}
            <Box sx={{ mt: 2 }}>
              {manual === "retry" && cancelled ? (
                <RetryRefundButton id={cancelled.id} amountPaise={cancelledRefundPaise(cancelled)} />
              ) : manual && manual !== "retry" ? (
                <OrderRefundButton orderId={orderId} kind={manual} amountRupees={invoice?.total_amount ?? null} />
              ) : cancelled && ["pending", "processing"].includes(cancelled.refund_status) ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  This refund is sent automatically. Nothing to do.
                </Typography>
              ) : null}
            </Box>
          </CardContent>
        </Card>

        {ledger.length ? (
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Refund records
              </Typography>
              {ledger.map((l) => {
                const s = ledgerStatusInfo(l.status);
                return (
                  <Line key={l.razorpay_payment_id} label={fmtDateTime(l.created_at)}>
                    <code>{l.razorpay_payment_id}</code> · {refundOriginLabel(l.origin)} · {formatPaise(l.amount_paise)}{" "}
                    <Chip size="small" color={s.color} label={s.label} />
                  </Line>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {reviews.length ? (
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Payment reviews
              </Typography>
              {reviews.map((r) => {
                const s = reviewStatusInfo(r.status);
                return (
                  <Line key={r.id} label={reviewKindLabel(r.kind)}>
                    <code>{r.razorpay_payment_id}</code> · captured {formatPaise(r.captured_paise)} of{" "}
                    {formatPaise(r.expected_paise)} <Chip size="small" color={s.color} label={s.label} />{" "}
                    {r.status === "open" ? <Link href="/refunds?tab=review">Review</Link> : null}
                  </Line>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </div>
  );
}
