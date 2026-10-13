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
  Link,
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
import { shownContact, sortContacts, whatsAppLink, whatsAppPreview } from "@/lib/hubContacts";
import { tableShellSx } from "@/lib/surface";
import type { HubContact } from "@/lib/types";

const HEADING = "“Urgent, connect with us”";

function appBehaviour(shown: HubContact | null, activeCount: number) {
  if (!shown) return `No active contact: ${HEADING} uses the number built into the app.`;
  const extra =
    activeCount > 1
      ? ` ${activeCount - 1} other active row${activeCount > 2 ? "s are" : " is"} not shown; saving any contact as active hides the rest.`
      : "";
  return `The app shows only this contact under ${HEADING}, with Call and WhatsApp buttons.${extra}`;
}

function WhatsAppPreview({ phone }: { phone: string }) {
  return (
    <Link
      href={whatsAppLink(phone)}
      target="_blank"
      rel="noopener noreferrer"
      variant="caption"
      sx={{ fontFamily: "monospace", display: "block" }}
    >
      {whatsAppPreview(phone)}
    </Link>
  );
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
  const shown = useMemo(() => shownContact(contacts), [contacts]);

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

  // The API hides every other contact when one is saved as active; mirror that here.
  function upsert(contact: HubContact) {
    setContacts((prev) => {
      const others = prev
        .filter((c) => c.id !== contact.id)
        .map((c) => (contact.active && c.active ? { ...c, active: false } : c));
      return sortContacts([...others, contact]);
    });
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
          {shown ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Shown in the app: {shown.label} · <span style={{ fontFamily: "monospace" }}>{shown.phone}</span>
              </Typography>
              <Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
                WhatsApp opens <WhatsAppPreview phone={shown.phone} />
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              No active contact
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {appBehaviour(shown, active.length)} Customers see changes the next time they open or return to the app.
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
        <EmptyState message="No contacts yet. The app uses its built-in number until you add one." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
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
                const isShown = c.id === shown?.id;
                return (
                  <TableRow key={c.id} hover sx={c.active ? undefined : { "& td": { color: "text.secondary" } }}>
                    <TableCell align="right">{c.sort_order}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{c.label}</TableCell>
                    <TableCell>{c.description || "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {c.phone}
                      {isShown ? <WhatsAppPreview phone={c.phone} /> : null}
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          c.active
                            ? isShown
                              ? "Shown in the app. Turn off to use the app's built-in number."
                              : "Active but not shown (another row comes first). Turn off."
                            : shown
                              ? `Show in the app instead of ${shown.label}`
                              : "Show in the app"
                        }
                      >
                        <span>
                          <Switch
                            size="small"
                            checked={c.active}
                            disabled={toggling === c.id}
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
          {editTarget ? "Edit contact" : "New contact"}
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
                active: active.length === 0,
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
          <Button variant="outlined" onClick={closeDelete} disabled={deleting}>
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
