"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const initialTab = params.get("tab") === "signup" ? 1 : 0;

  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setNeedsVerify(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.replace(next);
        router.refresh();
      } else if (data.emailNotVerified) {
        setNeedsVerify(true);
        setError("Confirm your email before signing in.");
      } else {
        setError(data.error || "Sign in failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInfo(data.message || "Check your email for a confirmation link.");
        setTab(0);
        setPassword("");
      } else {
        setError(data.error || "Sign up failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInfo(data.message || "Confirmation email sent.");
      else setError(data.error || "Could not resend email");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={tab === 0 ? "Welcome back" : "Create account"}
      subtitle={
        tab === 0
          ? "Sign in with your email and password."
          : "First account becomes admin. We’ll email you a confirmation link."
      }
    >
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(null); setInfo(null); }} sx={{ mb: 2 }}>
        <Tab label="Sign in" />
        <Tab label="Sign up" />
      </Tabs>

      {tab === 0 ? (
        <form onSubmit={onSignIn}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            {info ? <Alert severity="info">{info}</Alert> : null}
            {needsVerify ? (
              <Button variant="outlined" onClick={resendVerification} disabled={loading}>
                Resend confirmation email
              </Button>
            ) : null}
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </form>
      ) : (
        <form onSubmit={onSignUp}>
          <Stack spacing={2}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              required
              helperText="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            {info ? <Alert severity="success">{info}</Alert> : null}
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </Stack>
        </form>
      )}

      <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
        Invited by a teammate? Use the link in your invite email instead.
      </Typography>
    </AuthShell>
  );
}
