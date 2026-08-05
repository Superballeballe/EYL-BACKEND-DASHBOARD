"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader, SectionLabel } from "@/components/ui";
import { tableShellSx } from "@/lib/surface";

type ProfileUser = {
  email: string;
  name: string | null;
  role: "admin" | "operator";
};

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  }
  return email[0]?.toUpperCase() ?? "?";
}

export default function ProfileForm({ user }: { user: ProfileUser }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update password");
        return;
      }
      setSuccess(data.message || "Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Profile" subtitle="Account details and password" />

      <Box sx={{ ...tableShellSx, overflow: "hidden" }}>
        <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: "primary.main",
              fontSize: "1.1rem",
              fontWeight: 700,
            }}
          >
            {initials(user.name, user.email)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {user.name || user.email}
            </Typography>
            {user.name ? (
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                {user.email}
              </Typography>
            ) : null}
            <Box sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={user.role === "admin" ? "Admin" : "Operator"}
                color={user.role === "admin" ? "primary" : "default"}
                variant={user.role === "admin" ? "filled" : "outlined"}
              />
            </Box>
          </Box>
        </Box>

        <Divider />

        <Box component="form" onSubmit={onSubmit} sx={{ p: 3 }}>
          <SectionLabel>Change password</SectionLabel>

          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
              size="small"
              helperText="At least 8 characters"
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
              size="small"
            />
            <Box>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
