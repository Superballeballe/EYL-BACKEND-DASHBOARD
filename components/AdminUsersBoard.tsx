"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import { tableShellSx } from "@/lib/surface";
import { fmtDate } from "@/lib/format";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "operator";
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export default function AdminUsersBoard({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "operator">("operator");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  async function refreshUsers() {
    const list = await fetch("/api/admin/users").then((r) => r.json());
    if (list.users) setUsers(list.users);
  }

  async function sendInvite() {
    setLoading(true);
    setError(null);
    setInviteUrl(null);
    setEmailNote(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invite failed");
        return;
      }
      setInviteUrl(data.inviteUrl);
      if (!data.emailSent && data.emailNote) setEmailNote(data.emailNote);
      setEmail("");
      setOpen(false);
      await refreshUsers();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function removeUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove user");
        return;
      }
      setDeleteTarget(null);
      await refreshUsers();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 2.5,
          p: 2,
          alignItems: { sm: "center" },
          justifyContent: "space-between",
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box>
          <Typography variant="h1">Team</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            {users.length} user{users.length === 1 ? "" : "s"} · invite teammates by email
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<EmailOutlinedIcon />} onClick={() => setOpen(true)}>
          Invite user
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {inviteUrl ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInviteUrl(null)}>
          Invite created.{emailNote ? ` Email not sent (${emailNote}).` : " Email sent."} Share link:{" "}
          <Typography component="span" sx={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: "0.85em" }}>
            {inviteUrl}
          </Typography>
        </Alert>
      ) : null}

      <TableContainer sx={tableShellSx}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right" sx={{ width: 56 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
              <TableRow key={u.id} hover>
                <TableCell>{u.name || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={u.role}
                    color={u.role === "admin" ? "primary" : "default"}
                    variant={u.role === "admin" ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell>{fmtDate(u.last_login_at)}</TableCell>
                <TableCell>{fmtDate(u.created_at.slice(0, 10))}</TableCell>
                <TableCell align="right">
                  <Tooltip title={isSelf ? "You cannot remove yourself" : "Remove user"}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={isSelf}
                        aria-label={`Remove ${u.email}`}
                        onClick={() => setDeleteTarget(u)}
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Invite teammate</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="invite-role-label">Role</InputLabel>
              <Select
                labelId="invite-role-label"
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "operator")}
              >
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={sendInvite} disabled={loading || !email}>
            {loading ? "Sending…" : "Send invite"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Remove team member?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `${deleteTarget.name || deleteTarget.email} will lose access immediately. This cannot be undone.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={removeUser} disabled={deleting}>
            {deleting ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
