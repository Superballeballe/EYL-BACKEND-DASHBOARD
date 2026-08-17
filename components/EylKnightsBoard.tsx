"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { formatWorkAreas } from "@/lib/workAreas";
import { tableShellSx } from "@/lib/surface";
import type { EylKnight } from "@/lib/types";

const STATUS_COLOR: Record<EylKnight["status"], "default" | "warning" | "info" | "success" | "error"> = {
  pending: "default",
  documents: "warning",
  submitted: "info",
  approved: "success",
  rejected: "error",
};

export default function EylKnightsBoard({ applicants }: { applicants: EylKnight[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<EylKnight | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return applicants.filter((row) => status === "all" || row.status === status);
  }, [applicants, status]);

  async function removeApplicant() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/eyl-knights/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setDeleteError(d.error || "Delete failed");
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          mb: 2.5,
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="eyl-knight-status">Status</InputLabel>
          <Select
            labelId="eyl-knight-status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="all">All status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="documents">Documents uploaded</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Showing {rows.length} applicant{rows.length === 1 ? "" : "s"}
        </Typography>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState message="No knight applicants yet." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Work areas</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.name || "—"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {row.email || row.user_id.slice(0, 8)}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.phone || "—"}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{row.knight_role || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      color={STATUS_COLOR[row.status]}
                      variant={row.status === "pending" ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    {row.work_areas?.length ? formatWorkAreas(row.work_areas).join(", ") : "—"}
                  </TableCell>
                  <TableCell>{row.submitted_at ? fmtDate(row.submitted_at) : "—"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                      <Link href={`/eyl-knights/${row.id}`} style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        Review
                      </Link>
                      <Tooltip title="Remove application">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Remove ${row.name || "applicant"}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(row);
                          }}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Remove application?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {deleteTarget?.name || "This applicant"} will be removed from the review queue.
            {deleteTarget?.knight_id ? " Their ops roster entry will stay." : ""}
          </Typography>
          {deleteError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {deleteError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={removeApplicant} disabled={deleting}>
            {deleting ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
