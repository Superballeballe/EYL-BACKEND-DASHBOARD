"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import AuthShell from "@/components/AuthShell";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setChecking(false);
      return;
    }
    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) {
          setInvalid(true);
          if (d.expired) setError("This invite link has expired.");
        } else {
          setEmail(d.email);
        }
      })
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(data.error || "Could not accept invite");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  if (invalid) {
    return (
      <AuthShell title="Invalid invite" subtitle="Ask your admin to send a new invitation.">
        {error ? <Alert severity="error">{error}</Alert> : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accept invite" subtitle="Set your password to join the dashboard.">
      <form onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField label="Email" value={email} disabled />
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Password"
            type="password"
            required
            helperText="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </Stack>
      </form>
      <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
        You’ll stay signed in on this device after setup.
      </Typography>
    </AuthShell>
  );
}
