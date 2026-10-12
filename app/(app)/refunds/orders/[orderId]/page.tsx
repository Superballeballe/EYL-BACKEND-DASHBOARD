import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
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

export const dynamic = "force-dynamic";

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
  const { order, invoice, cancelled, ledger, reviews } = await loadOrderRefund(orderId);
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
            <Line label="Razorpay payment">
              <code>{invoice?.provider_ref ?? "—"}</code>
            </Line>
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
