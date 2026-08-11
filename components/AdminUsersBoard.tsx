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

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "operator";
  expires_at: string;
  created_at: string;
};

export default function AdminUsersBoard({
  initialUsers,
  initialInvites,
  currentUserId,
}: {
  initialUsers: UserRow[];
  initialInvites: InviteRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<InviteRow | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "operator">("operator");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  async function refreshTeam() {
    const data = await fetch("/api/admin/users").then((r) => r.json());
    if (data.users) setUsers(data.users);
    if (data.invites) setInvites(data.invites);
  }

  async function sendInvite() {
    setLoading(true);
    setError(null);
    setInviteNotice(null);
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
      const invitedEmail = data.invite?.email ?? email.trim().toLowerCase();
      setInviteNotice(
        data.emailSent
          ? `Invite created. Email sent. to ${invitedEmail}`
          : `Invite created. Email not sent to ${invitedEmail}.${data.emailNote ? ` ${data.emailNote}` : ""}`,
      );
      setEmail("");
      setOpen(false);
      await refreshTeam();
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
      await refreshTeam();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  async function cancelInvite() {
    if (!cancelInviteTarget) return;
    setCancellingInvite(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invites/${cancelInviteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not cancel invite");
        return;
      }
      setCancelInviteTarget(null);
      await refreshTeam();
    } catch {
      setError("Network error");
    } finally {
      setCancellingInvite(false);
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
            {users.length} user{users.length === 1 ? "" : "s"}
            {invites.length ? ` · ${invites.length} pending invite${invites.length === 1 ? "" : "s"}` : ""}
            {" · "}invite teammates by email
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

      {inviteNotice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInviteNotice(null)}>
          {inviteNotice}
        </Alert>
      ) : null}

      {invites.length ? (
        <TableContainer sx={{ ...tableShellSx, mb: 2.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell colSpan={6} sx={{ fontWeight: 700, bgcolor: "action.hover" }}>
                  Pending invites
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Invited</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 56 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id} hover>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={invite.role}
                      color={invite.role === "admin" ? "primary" : "default"}
                      variant={invite.role === "admin" ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell>{fmtDate(invite.created_at.slice(0, 10))}</TableCell>
                  <TableCell>{fmtDate(invite.expires_at.slice(0, 10))}</TableCell>
                  <TableCell>
                    <Chip size="small" color="warning" variant="outlined" label="pending" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Cancel invite">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Cancel invite for ${invite.email}`}
                        onClick={() => setCancelInviteTarget(invite)}
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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

      <Dialog open={!!cancelInviteTarget} onClose={() => setCancelInviteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Cancel invite?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {cancelInviteTarget
              ? `The invite for ${cancelInviteTarget.email} will be revoked. They will not be able to join with the old link.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelInviteTarget(null)} disabled={cancellingInvite}>
            Keep invite
          </Button>
          <Button color="error" variant="contained" onClick={cancelInvite} disabled={cancellingInvite}>
            {cancellingInvite ? "Cancelling…" : "Cancel invite"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
