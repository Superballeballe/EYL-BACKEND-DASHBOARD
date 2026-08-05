"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Dialog,
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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import KnightForm from "@/components/KnightForm";
import { EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { Knight } from "@/lib/types";

export default function KnightsBoard({ knights }: { knights: Knight[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    return knights.filter((k) => {
      if (role !== "all" && k.role !== role) return false;
      if (status === "active" && !k.active) return false;
      if (status === "inactive" && k.active) return false;
      return true;
    });
  }, [knights, role, status]);

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
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="knight-role">Role</InputLabel>
            <Select
              labelId="knight-role"
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="walker">Walker</MenuItem>
              <MenuItem value="biker">Biker</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="knight-status">Status</InputLabel>
            <Select
              labelId="knight-status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">All status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Showing {rows.length} knight{rows.length === 1 ? "" : "s"}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add knight
          </Button>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState message="No knights found. Add one to get started." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Display</TableCell>
                <TableCell>Full name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{k.display_name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{k.full_name}</TableCell>
                  <TableCell>
                    {k.role ? (
                      <Chip size="small" label={k.role} variant="outlined" />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{fmtDate(k.joining_date)}</TableCell>
                  <TableCell>
                    {k.active ? (
                      <Chip size="small" color="primary" label="active" />
                    ) : (
                      <Chip size="small" variant="outlined" label="inactive" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button component={Link} href={`/knights/${k.id}`} size="small">
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          Add knight
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <KnightForm mode="new" onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
