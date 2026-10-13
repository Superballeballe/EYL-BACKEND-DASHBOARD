"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/ui";
import PaymentReviewActions from "@/components/PaymentReviewActions";
import RefundModeControl from "@/components/RefundModeControl";
import { fmtDateTime } from "@/lib/format";
import {
  ageLabel,
  formatPaise,
  refundOriginLabel,
  refundStatusInfo,
  reviewKindLabel,
  reviewStatusInfo,
  type AutoRefundMode,
  type ModeHistoryEntry,
  type RefundListRow,
} from "@/lib/refunds";
import { tableShellSx } from "@/lib/surface";
import type { PaymentRefund, PaymentReview } from "@/lib/types";

type Props = {
  refunds: RefundListRow[];
  openReviews: PaymentReview[];
  closedReviews: PaymentReview[];
  isAdmin: boolean;
  mode: AutoRefundMode;
  modeRaw: string | null;
  modeUpdatedAt: string | null;
  modeUpdatedBy: string | null;
  modeHistory: ModeHistoryEntry[];
  dryRunRows: PaymentRefund[];
  missing: string[];
  initialTab?: number;
};

const STATUS_FILTERS = ["all", "pending", "processing", "failed", "refunded", "dry_run"] as const;

function OrderLink({ orderId, code }: { orderId: string | null; code: string | null }) {
  if (!orderId) return <span>{code || "—"}</span>;
  return (
    <Link href={`/refunds/orders/${orderId}`} style={{ fontWeight: 600 }}>
      {code || "Open order"}
    </Link>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 160,
        borderRadius: 1,
        border: "1px dashed",
        borderColor: "divider",
      }}
    >
      <EmptyState message={message} compact />
    </Box>
  );
}

function RefundsTable({ rows }: { rows: RefundListRow[] }) {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "dry_run" ? r.status === "dry_run" || r.status === "skipped" : r.status === filter,
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
        {STATUS_FILTERS.map((f) => {
          const count =
            f === "all"
              ? rows.length
              : rows.filter((r) => (f === "dry_run" ? r.status === "dry_run" || r.status === "skipped" : r.status === f)).length;
          return (
            <Chip
              key={f}
              size="small"
              clickable
              color={filter === f ? "primary" : "default"}
              variant={filter === f ? "filled" : "outlined"}
              label={`${f === "all" ? "All" : refundStatusInfo(f).label} · ${count}`}
              onClick={() => setFilter(f)}
            />
          );
        })}
      </Stack>
      {shown.length === 0 ? (
        <Empty message="No refunds here." />
      ) : (
        <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Why</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment · refund</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((r) => {
                const s = refundStatusInfo(r.status);
                return (
                  <TableRow key={r.key}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.at)}</TableCell>
                    <TableCell>
                      <OrderLink orderId={r.order_id} code={r.order_code} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{refundOriginLabel(r.origin)}</Typography>
                      {r.reason ? (
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          {r.reason}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {formatPaise(r.amount_paise)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={s.color} variant={s.color === "default" ? "outlined" : "filled"} label={s.label} />
                      {r.last_error ? (
                        <Typography variant="caption" sx={{ color: "error.main", display: "block", maxWidth: 260 }}>
                          {r.last_error}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: "block", fontFamily: "monospace" }}>
                        {r.payment_id || "—"}
                      </Typography>
                      {r.refund_ref ? (
                        <Typography variant="caption" sx={{ display: "block", fontFamily: "monospace", color: "text.secondary" }}>
                          {r.refund_ref}
                        </Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

function ReviewsTable({ rows, open }: { rows: PaymentReview[]; open: boolean }) {
  if (rows.length === 0) {
    return <Empty message={open ? "Nothing needs review." : "No resolved or refunded reviews yet."} />;
  }
  return (
    <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Kind</TableCell>
            <TableCell>Order</TableCell>
            <TableCell align="right">Expected</TableCell>
            <TableCell align="right">Captured</TableCell>
            <TableCell>Payment</TableCell>
            <TableCell>Captured at</TableCell>
            <TableCell>{open ? "Age" : "Outcome"}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const s = reviewStatusInfo(r.status);
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {reviewKindLabel(r.kind)}
                  </Typography>
                  {r.detail ? (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", maxWidth: 240 }}>
                      {r.detail}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  <OrderLink orderId={r.order_id} code={r.order_code} />
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatPaise(r.expected_paise)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {formatPaise(r.captured_paise)}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {r.razorpay_payment_id}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.captured_at)}</TableCell>
                <TableCell>
                  {open ? (
                    <>
                      {ageLabel(r.created_at)}
                      {r.last_error ? (
                        <Typography variant="caption" sx={{ color: "error.main", display: "block", maxWidth: 220 }}>
                          Last try: {r.last_error}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Chip size="small" color={s.color} label={s.label} />
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", maxWidth: 260 }}>
                        {[
                          r.refunded_paise ? formatPaise(r.refunded_paise) : null,
                          r.refund_ref,
                          r.resolution_note,
                          r.resolved_by,
                          r.resolved_at ? fmtDateTime(r.resolved_at) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
                    </>
                  )}
                </TableCell>
                <TableCell align="right">{open ? <PaymentReviewActions review={r} /> : null}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function RefundsBoard(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState(props.initialTab ?? 0);
  const openCount = props.openReviews.length;

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const stream = new EventSource("/api/refunds/stream");
    stream.addEventListener("change", () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    });
    return () => {
      if (debounce) clearTimeout(debounce);
      stream.close();
    };
  }, [router]);

  return (
    <Box>
      {props.missing.length ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some refund data isn&apos;t available yet ({props.missing.join(", ")}). The backend update may not be deployed.
        </Alert>
      ) : null}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider", minHeight: 44 }}
      >
        <Tab label="Refunds" />
        <Tab
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Needs review</span>
              {openCount > 0 ? <Chip size="small" color="warning" label={openCount} /> : null}
            </Stack>
          }
        />
        {props.isAdmin ? <Tab label="Auto-refund mode" /> : null}
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Refunds are automatic: not confirmed within 30 minutes of payment, paid after cancel, and any paid order
              cancelled before pickup (100%). Only a failed refund needs you; open the order to retry.
            </Typography>
            <RefundsTable rows={props.refunds} />
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 0.5 }}>
                Needs review
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                Wrong-amount and duplicate payments are never refunded automatically. Refund the payment, or mark it
                resolved with a note.
              </Typography>
              <ReviewsTable rows={props.openReviews} open />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h2" sx={{ mb: 2 }}>
                History
              </Typography>
              <ReviewsTable rows={props.closedReviews} open={false} />
            </CardContent>
          </Card>
        </Stack>
      )}

      {tab === 2 && props.isAdmin && (
        <RefundModeControl
          mode={props.mode}
          modeRaw={props.modeRaw}
          updatedAt={props.modeUpdatedAt}
          updatedBy={props.modeUpdatedBy}
          history={props.modeHistory}
          dryRunRows={props.dryRunRows}
        />
      )}
    </Box>
  );
}
