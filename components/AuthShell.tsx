"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 700 }}>
            EYL Delivery
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 3, color: "text.secondary" }}>
            {subtitle}
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
