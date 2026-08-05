"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClientForm from "@/components/ClientForm";
import { EmptyState } from "@/components/ui";
import { tableShellSx } from "@/lib/surface";
import type { Client } from "@/lib/types";

export default function ClientsBoard({
  clients,
  initialQuery = "",
}: {
  clients: Client[];
  initialQuery?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQuery);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) =>
      [c.client_name, c.company_name, c.gst_no, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [clients, q]);

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
        <TextField
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company or GST…"
          sx={{ minWidth: { sm: 280 }, flex: 1, maxWidth: 420 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Showing {rows.length} client{rows.length === 1 ? "" : "s"}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add client
          </Button>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState message="No clients found." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>GST</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{c.client_name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.company_name ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                    {c.gst_no ?? "—"}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.phone ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button component={Link} href={`/clients/${c.id}`} size="small">
                      Edit
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
          Add client
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <ClientForm mode="new" onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
