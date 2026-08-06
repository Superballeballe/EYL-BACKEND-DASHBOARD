"use client";

import { useMemo, useState } from "react";
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
import { tableShellSx } from "@/lib/surface";
import type { MonthlyCoupon } from "@/lib/types";

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatDiscount(c: MonthlyCoupon) {
  return c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`;
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

export default function CouponsBoard({ coupons }: { coupons: MonthlyCoupon[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MonthlyCoupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyCoupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const currentMonth = useMemo(() => currentYearMonth(), []);
  const current = coupons.find((c) => c.year_month === currentMonth && c.active);

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

  async function removeCoupon() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/coupons/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
    }
  }

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
            This month ({formatMonth(currentMonth)})
          </Typography>
          {current ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Code <strong>{current.code}</strong> — {current.label} ({formatDiscount(current)})
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: "warning.main" }}>
              No active coupon set for this month
            </Typography>
          )}
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Set coupon
        </Button>
      </Stack>

      {coupons.length === 0 ? (
        <EmptyState message="No monthly coupons yet. Set one to get started." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 96 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{formatMonth(c.year_month)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.code} variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDiscount(c)}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.label}</TableCell>
                  <TableCell>
                    {c.active ? (
                      <Chip size="small" color="primary" label="active" />
                    ) : (
                      <Chip size="small" variant="outlined" label="inactive" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Edit coupon">
                        <IconButton size="small" aria-label={`Edit ${c.code}`} onClick={() => openEdit(c)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete coupon">
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

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          {editTarget ? "Edit monthly coupon" : "Set monthly coupon"}
          <IconButton
            aria-label="Close"
            onClick={closeForm}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <CouponForm
            key={editTarget?.id ?? "new"}
            couponId={editTarget?.id}
            initial={
              editTarget ?? {
                year_month: currentMonth,
              }
            }
            onSuccess={closeForm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete coupon?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `Remove ${deleteTarget.code} (${formatMonth(deleteTarget.year_month)})? This cannot be undone.`
              : null}
          </DialogContentText>
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
