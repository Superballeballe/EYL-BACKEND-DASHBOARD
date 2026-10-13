"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";
import { chrome } from "@/lib/surface";

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
        bgcolor: chrome.bar,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420, borderRadius: "16px" }}>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
            EYL Delivery
          </Typography>
          <Typography variant="h1" sx={{ mt: 0.5 }}>
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
