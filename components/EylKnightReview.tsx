"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatWorkArea } from "@/lib/workAreas";
import type { EylKnight } from "@/lib/types";

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  driving_license: "Driving licence",
  selfie: "Selfie",
};

const STATUS_COLOR: Record<EylKnight["status"], "default" | "warning" | "info" | "success" | "error"> = {
  pending: "default",
  documents: "warning",
  submitted: "info",
  approved: "success",
  rejected: "error",
};

const STATUS_LABEL: Record<EylKnight["status"], string> = {
  pending: "Pending",
  documents: "Documents uploaded",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ display: "block", color: "text.secondary", fontWeight: 700, letterSpacing: 0.6, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

export default function EylKnightReview({
  applicant,
  documentUrls,
}: {
  applicant: EylKnight;
  documentUrls: Record<string, string | null>;
}) {
  const router = useRouter();
  const [note, setNote] = useState(applicant.review_note ?? "");
  const [role, setRole] = useState<"walker" | "biker">(applicant.knight_role ?? "walker");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFinal = applicant.status === "approved" || applicant.status === "rejected";

  async function updateStatus(status: "approved" | "rejected") {
    if (status === "rejected" && !window.confirm("Reject this applicant? They will not be added to the roster.")) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/eyl-knights/${applicant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_note: note || null, knight_role: role }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update applicant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      {isFinal ? (
        <Alert severity={applicant.status === "approved" ? "success" : "error"}>
          {applicant.status === "approved"
            ? "This applicant has been approved and added to the ops roster."
            : "This applicant was rejected."}
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{
          p: 2.5,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { sm: "flex-start" }, justifyContent: "space-between", mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {applicant.name || "Unnamed applicant"}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.75, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={STATUS_LABEL[applicant.status]}
                color={STATUS_COLOR[applicant.status]}
                variant={applicant.status === "pending" ? "outlined" : "filled"}
              />
              {applicant.knight_id ? (
                <Chip size="small" label="On ops roster" color="success" variant="outlined" />
              ) : null}
            </Stack>
          </Box>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="eyl-knight-role">Delivery role</InputLabel>
            <Select
              labelId="eyl-knight-role"
              label="Delivery role"
              value={role}
              onChange={(e) => setRole(e.target.value as "walker" | "biker")}
              disabled={isFinal}
            >
              <MenuItem value="walker">Walker</MenuItem>
              <MenuItem value="biker">Biker</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <SectionLabel>Contact</SectionLabel>
            <Stack spacing={0.5}>
              {applicant.email ? (
                <Link href={`mailto:${applicant.email}`} underline="hover" variant="body2">
                  {applicant.email}
                </Link>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No email
                </Typography>
              )}
              {applicant.phone ? (
                <Link href={`tel:${applicant.phone}`} underline="hover" variant="body2">
                  {applicant.phone}
                </Link>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No phone
                </Typography>
              )}
            </Stack>
          </Box>

          <Box sx={{ flex: 1.4, minWidth: 0 }}>
            <SectionLabel>Work areas</SectionLabel>
            {applicant.work_areas?.length ? (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                {applicant.work_areas.map((area) => (
                  <Chip key={area} size="small" label={formatWorkArea(area)} variant="outlined" />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Not selected yet
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Documents
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          {Object.entries(DOC_LABELS).map(([key, label]) => {
            const url = documentUrls[key];
            return (
              <Box
                key={key}
                sx={{
                  width: { xs: "100%", sm: 220 },
                  p: 1.5,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  {label}
                </Typography>
                {url ? (
                  <Link href={url} target="_blank" rel="noopener noreferrer" underline="none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${label} document`}
                      width={196}
                      height={140}
                      style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, display: "block" }}
                    />
                  </Link>
                ) : (
                  <Box
                    sx={{
                      height: 140,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Not uploaded
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      <TextField
        label="Review note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        size="small"
        disabled={isFinal}
        placeholder="Optional note for approval or rejection…"
      />

      {!isFinal ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            color="success"
            disabled={saving}
            onClick={() => updateStatus("approved")}
          >
            {saving ? "Saving…" : "Approve & add to roster"}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={saving}
            onClick={() => updateStatus("rejected")}
          >
            Reject
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
