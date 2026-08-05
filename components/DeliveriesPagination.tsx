"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";

const LIMIT = 100;

type SP = Record<string, string | string[] | undefined>;

export default function DeliveriesPagination({
  sp,
  offset,
  total,
}: {
  sp: SP;
  offset: number;
  total: number;
}) {
  const mk = (newOffset: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "offset") continue;
      const val = Array.isArray(v) ? v[0] : v;
      if (val) params.set(k, val);
    }
    if (newOffset > 0) params.set("offset", String(newOffset));
    return `/deliveries?${params.toString()}`;
  };

  const page = Math.floor(offset / LIMIT) + 1;
  const pages = Math.ceil(total / LIMIT);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mt: 2 }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Page {page} of {pages} · {total} total
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        {offset > 0 ? (
          <Button component={Link} href={mk(offset - LIMIT)} variant="outlined" size="small">
            ← Previous
          </Button>
        ) : null}
        {offset + LIMIT < total ? (
          <Button component={Link} href={mk(offset + LIMIT)} variant="outlined" size="small">
            Next →
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
