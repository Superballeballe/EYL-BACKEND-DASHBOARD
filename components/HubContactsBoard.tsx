"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import HubContactForm from "@/components/HubContactForm";
import { EmptyState } from "@/components/ui";
import { HUB_CONTACTS_MAX_ACTIVE } from "@/lib/schemas";
import { tableShellSx } from "@/lib/surface";
import type { HubContact } from "@/lib/types";

// Same order the app uses: sort_order, then label.
function sortContacts(list: HubContact[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

function appBehaviour(active: HubContact[]) {
  if (active.length === 0) return "No active contacts: “Call the Hub” dials the number built into the app.";
  if (active.length === 1) return `One active contact: “Call the Hub” dials ${active[0].label} directly.`;
  return `${active.length} active contacts: “Call the Hub” opens a sheet listing them in this order.`;
}

export default function HubContactsBoard({ contacts: initialContacts }: { contacts: HubContact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HubContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HubContact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const active = useMemo(() => contacts.filter((c) => c.active), [contacts]);
  const atCap = active.length >= HUB_CONTACTS_MAX_ACTIVE;

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(contact: HubContact) {
    setEditTarget(contact);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function upsert(contact: HubContact) {
    setContacts((prev) =>
      sortContacts(
        prev.some((c) => c.id === contact.id)
          ? prev.map((c) => (c.id === contact.id ? contact : c))
          : [...prev, contact],
      ),
    );
  }

  function handleSaved(contact: HubContact) {
    upsert(contact);
    closeForm();
    router.refresh();
  }

  async function toggleActive(contact: HubContact) {
    setToggling(contact.id);
    setToggleError(null);
    const res = await fetch(`/api/hub-contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !contact.active }),
    });
    setToggling(null);
    if (res.ok) {
      upsert((await res.json()) as HubContact);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setToggleError(d.error || "Update failed");
  }

  async function removeContact() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/hub-contacts/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      const id = deleteTarget.id;
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setDeleteTarget(null);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setDeleteError(d.error || "Delete failed");
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {active.length} of {HUB_CONTACTS_MAX_ACTIVE} active
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {appBehaviour(active)} Customers see changes the next time they open or return to the app.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          New contact
        </Button>
      </Stack>

      {toggleError ? (
        <Alert severity="error" onClose={() => setToggleError(null)} sx={{ mb: 2 }}>
          {toggleError}
        </Alert>
      ) : null}

      {contacts.length === 0 ? (
        <EmptyState message="No hub contacts yet. The app dials its built-in number until you add one." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="right" sx={{ width: 64 }}>
                  Order
                </TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right" sx={{ width: 88 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c) => {
                const blocked = !c.active && atCap;
                return (
                  <TableRow key={c.id} hover sx={c.active ? undefined : { "& td": { color: "text.secondary" } }}>
                    <TableCell align="right">{c.sort_order}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{c.label}</TableCell>
                    <TableCell>{c.description || "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{c.phone}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          blocked
                            ? `Only ${HUB_CONTACTS_MAX_ACTIVE} contacts can be active. Hide one first.`
                            : c.active
                              ? "Hide from the app"
                              : "Show in the app"
                        }
                      >
                        <span>
                          <Switch
                            size="small"
                            checked={c.active}
                            disabled={blocked || toggling === c.id}
                            onChange={() => toggleActive(c)}
                            slotProps={{ input: { "aria-label": `${c.label} active` } }}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" aria-label={`Edit ${c.label}`} onClick={() => openEdit(c)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete ${c.label}`}
                            onClick={() => setDeleteTarget(c)}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          {editTarget ? "Edit hub contact" : "New hub contact"}
          <IconButton aria-label="Close" onClick={closeForm} sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <HubContactForm
            key={editTarget?.id ?? "new"}
            contactId={editTarget?.id}
            initial={
              editTarget ?? {
                active: !atCap,
                sort_order: contacts.length ? Math.max(...contacts.map((c) => c.sort_order)) + 1 : 0,
              }
            }
            onSuccess={handleSaved}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle>Delete {deleteTarget?.label}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Customers stop seeing it the next time they open the app. To keep it for later, turn off Active instead.
          </DialogContentText>
          {deleteError ? (
            <DialogContentText sx={{ mt: 1.5, color: "error.main" }}>{deleteError}</DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={removeContact} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
