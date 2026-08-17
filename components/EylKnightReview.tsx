"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { EylKnight } from "@/lib/types";

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  driving_license: "Driving licence",
  selfie: "Selfie",
};

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

  async function updateStatus(status: "approved" | "rejected") {
    setSaving(true);
    try {
      const res = await fetch(`/api/eyl-knights/${applicant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_note: note || null, knight_role: role }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update applicant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: 2.5,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {applicant.name || "Unnamed applicant"}
          </Typography>
          <Chip size="small" label={applicant.status} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {applicant.email || "No email"} · {applicant.phone || "No phone"}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Work areas: {applicant.work_areas?.length ? applicant.work_areas.join(", ") : "Not selected yet"}
        </Typography>
        {applicant.knight_id ? (
          <Typography variant="body2" sx={{ mt: 1, color: "success.main" }}>
            Linked to ops roster
          </Typography>
        ) : null}
      </Box>

      <FormControl size="small" sx={{ maxWidth: 220 }}>
        <InputLabel id="eyl-knight-role">Delivery role</InputLabel>
        <Select
          labelId="eyl-knight-role"
          label="Delivery role"
          value={role}
          onChange={(e) => setRole(e.target.value as "walker" | "biker")}
          disabled={applicant.status === "approved"}
        >
          <MenuItem value="walker">Walker</MenuItem>
          <MenuItem value="biker">Biker</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Documents
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          {Object.entries(DOC_LABELS).map(([key, label]) => {
            const url = documentUrls[key];
            return (
              <Box
                key={key}
                sx={{
                  width: 220,
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={label}
                    style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Not uploaded
                  </Typography>
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
        minRows={2}
        fullWidth
        size="small"
      />

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="contained"
          color="success"
          disabled={saving || applicant.status === "approved"}
          onClick={() => updateStatus("approved")}
        >
          Approve & add to roster
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={saving || applicant.status === "rejected"}
          onClick={() => updateStatus("rejected")}
        >
          Reject
        </Button>
      </Stack>
    </Stack>
  );
}
