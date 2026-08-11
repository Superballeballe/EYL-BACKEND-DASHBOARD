"use client";

import { Box, Button, Typography } from "@mui/material";

export default function CouponsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>
        Could not load coupons
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {error.message || "Something went wrong. Try refreshing the page."}
      </Typography>
      <Button variant="contained" onClick={() => reset()}>
        Try again
      </Button>
    </Box>
  );
}
