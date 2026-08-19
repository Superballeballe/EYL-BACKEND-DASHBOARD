"use client";

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
import { fmtDateTime } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { CouponRedemption } from "@/lib/types";

export default function CouponRedemptionsTable({ redemptions }: { redemptions: CouponRedemption[] }) {
  if (redemptions.length === 0) {
    return <EmptyState message="No coupon redemptions yet." />;
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Recent redemptions
      </Typography>
      <TableContainer sx={tableShellSx}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Coupon</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Redeemed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {redemptions.map((r) => {
              const couponCode = r.monthly_coupons?.code ?? r.code;
              const renamed = r.monthly_coupons?.code && r.monthly_coupons.code !== r.code;
              return (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Chip size="small" label={couponCode} variant="outlined" />
                  {renamed ? (
                    <Box component="span" sx={{ ml: 1, color: "text.secondary", fontSize: "0.75rem" }}>
                      (as {r.code})
                    </Box>
                  ) : null}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {r.orders?.order_code ?? r.order_id.slice(0, 8)}
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {r.user_id.slice(0, 8)}…
                </TableCell>
                <TableCell>{fmtDateTime(r.redeemed_at)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
