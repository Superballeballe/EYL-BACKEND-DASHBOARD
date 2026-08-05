"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import AuthShell from "@/components/AuthShell";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing confirmation token.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("ok");
          setMessage("Email confirmed. Redirecting…");
          router.replace("/");
          router.refresh();
        } else {
          setStatus("error");
          setMessage(data.error || "Confirmation failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error");
      });
  }, [token, router]);

  return (
    <AuthShell title="Confirm email" subtitle="Verifying your EYL Delivery account.">
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        {status === "loading" ? <CircularProgress size={28} /> : null}
        {status === "ok" ? <Alert severity="success">{message}</Alert> : null}
        {status === "error" ? (
          <>
            <Alert severity="error">{message}</Alert>
            <Button component={Link} href="/login" variant="contained">
              Back to sign in
            </Button>
          </>
        ) : null}
        {status === "loading" ? (
          <Typography variant="body2" color="text.secondary">
            One moment…
          </Typography>
        ) : null}
      </Stack>
    </AuthShell>
  );
}
