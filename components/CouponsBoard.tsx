"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CouponForm from "@/components/CouponForm";
import { EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { CouponRedemption, MonthlyCoupon } from "@/lib/types";

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function formatDiscount(c: MonthlyCoupon) {
  return c.type === "percent" ? `${c.value}%` : `₹${c.value}`;
}

function currentYearMonth() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

function sortCoupons(list: MonthlyCoupon[]) {
  return [...list].sort((a, b) => b.year_month.localeCompare(a.year_month) || b.code.localeCompare(a.code));
}

export default function CouponsBoard({
  coupons: initialCoupons,
  redemptions: initialRedemptions,
}: {
  coupons: MonthlyCoupon[];
  redemptions: CouponRedemption[];
}) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MonthlyCoupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyCoupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentMonth = useMemo(() => currentYearMonth(), []);
  const activeCount = useMemo(() => coupons.filter((c) => c.active).length, [coupons]);

  useEffect(() => {
    setCoupons(initialCoupons);
  }, [initialCoupons]);

  useEffect(() => {
    setRedemptions(initialRedemptions);
  }, [initialRedemptions]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(coupon: MonthlyCoupon) {
    setEditTarget(coupon);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function handleSaved(coupon: MonthlyCoupon) {
    setCoupons((prev) => {
      const i = prev.findIndex((c) => c.id === coupon.id);
      if (i >= 0) {
        return sortCoupons(prev.map((c) => (c.id === coupon.id ? { ...c, ...coupon } : c)));
      }
      return sortCoupons([{ ...coupon, redemption_count: coupon.redemption_count ?? 0 }, ...prev]);
    });
    closeForm();
    router.refresh();
  }

  async function removeCoupon() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/coupons/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      const id = deleteTarget.id;
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setRedemptions((prev) => prev.filter((r) => r.coupon_id !== id));
      setDeleteTarget(null);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setDeleteError(d.error || "Delete failed");
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {activeCount} active · {redemptions.length} redemption{redemptions.length === 1 ? "" : "s"}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New coupon
        </Button>
      </Stack>

      {coupons.length === 0 ? (
        <EmptyState message="No coupons yet." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Month</TableCell>
                <TableCell align="right">Used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 88 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "monospace" }}>{c.code}</TableCell>
                  <TableCell>{formatDiscount(c)}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{formatMonth(c.year_month)}</TableCell>
                  <TableCell align="right">{c.redemption_count}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={c.active ? "Active" : "Inactive"}
                      color={c.active ? "primary" : "default"}
                      variant={c.active ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label={`Edit ${c.code}`} onClick={() => openEdit(c)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Delete ${c.code}`}
                          onClick={() => setDeleteTarget(c)}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
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

      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Redemptions
        </Typography>
        {redemptions.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No redemptions yet.
          </Typography>
        ) : (
          <TableContainer sx={tableShellSx}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                      {r.monthly_coupons?.code ?? r.code}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {r.orders?.order_code ?? "—"}
                    </TableCell>
                    <TableCell>{fmtDateTime(r.redeemed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          {editTarget ? "Edit coupon" : "New coupon"}
          <IconButton aria-label="Close" onClick={closeForm} sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <CouponForm
            key={editTarget?.id ?? "new"}
            couponId={editTarget?.id}
            initial={editTarget ?? { year_month: currentMonth }}
            onSuccess={handleSaved}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete {deleteTarget?.code}?</DialogTitle>
        <DialogContent>
          <DialogContentText>This removes the coupon and its redemption history.</DialogContentText>
          {deleteError ? (
            <DialogContentText sx={{ mt: 1.5, color: "error.main" }}>{deleteError}</DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={removeCoupon} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
