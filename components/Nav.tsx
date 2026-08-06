"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { gray } from "@/lib/surface";

const SIDEBAR_STORAGE_KEY = "eyl-sidebar-collapsed";
const EXPANDED_W = 224;
const COLLAPSED_W = 72;

const LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardOutlinedIcon },
  { href: "/deliveries", label: "Deliveries", Icon: LocalShippingOutlinedIcon },
  { href: "/map", label: "Plotting map", Icon: MapOutlinedIcon },
  { href: "/lineup", label: "Daily Lineup", Icon: CalendarMonthOutlinedIcon },
  { href: "/knights", label: "Knights", Icon: ShieldOutlinedIcon },
  { href: "/salaries", label: "Salaries", Icon: BadgeOutlinedIcon },
  { href: "/clients", label: "Clients", Icon: PeopleOutlinedIcon },
  { href: "/rates", label: "Rate Cards", Icon: CreditCardOutlinedIcon },
  { href: "/coupons", label: "Coupons", Icon: ConfirmationNumberOutlinedIcon },
] as const;

const ADMIN_LINKS = [{ href: "/admin/users", label: "Team", Icon: ManageAccountsOutlinedIcon }] as const;

const linkSx = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
} as const;

const navItemSx = (active: boolean) => ({
  mb: 0.5,
  borderRadius: 1,
  minHeight: 40,
  px: 1.5,
  ...(active
    ? {
        bgcolor: "#eff6ff",
        color: "primary.main",
        "& .MuiListItemIcon-root": { color: "primary.main" },
        "&:hover": { bgcolor: "#dbeafe" },
      }
    : {
        color: "text.primary",
        "& .MuiListItemIcon-root": { color: "text.secondary" },
        "&:hover": { bgcolor: gray.hover },
      }),
});

function NavItem({
  href,
  label,
  Icon,
  active,
  collapsed,
  mounted,
}: {
  href: string;
  label: string;
  Icon: (typeof LINKS)[number]["Icon"] | (typeof ADMIN_LINKS)[number]["Icon"];
  active: boolean;
  collapsed: boolean;
  mounted: boolean;
}) {
  const link = (
    <Link href={href} prefetch style={linkSx}>
      <ListItemButton
        component="div"
        tabIndex={-1}
        disableRipple
        selected={active}
        sx={navItemSx(active)}
        aria-label={collapsed ? label : undefined}
      >
        <ListItemIcon sx={{ minWidth: 36, justifyContent: "center" }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={label}
          sx={{
            flex: collapsed ? "0 0 0px" : "1 1 auto",
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            m: 0,
            transition: mounted ? "opacity 0.12s ease, flex-basis 0.15s ease" : "none",
            "& .MuiListItemText-primary": {
              typography: "body2",
              fontWeight: active ? 600 : 500,
              whiteSpace: "nowrap",
            },
          }}
        />
      </ListItemButton>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip title={label} placement="right" disableInteractive enterDelay={400}>
      {link}
    </Tooltip>
  );
}

function userInitials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  }
  return email[0]?.toUpperCase() ?? "?";
}

export default function Nav({
  user,
}: {
  user: { email: string; name: string | null; role: "admin" | "operator" };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    setMounted(true);
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const profileActive = isActive("/profile");

  const profileLink = (
    <Link href="/profile" prefetch style={linkSx} aria-label="Profile">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: collapsed ? 0.75 : 1.5,
          py: 1,
          mx: collapsed ? 0 : 0,
          borderRadius: 1,
          minHeight: 40,
          justifyContent: collapsed ? "center" : "flex-start",
          ...(profileActive
            ? {
                bgcolor: "#eff6ff",
                color: "primary.main",
                "& .MuiTypography-root": { color: profileActive ? "inherit" : undefined },
              }
            : { "&:hover": { bgcolor: gray.hover } }),
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            bgcolor: "primary.main",
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        >
          {userInitials(user.name, user.email)}
        </Avatar>
        {!collapsed ? (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name || user.email}
            </Typography>
            {user.name ? (
              <Typography
                variant="caption"
                sx={{
                  color: profileActive ? "primary.main" : "text.secondary",
                  opacity: profileActive ? 0.85 : 1,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Link>
  );

  const signOutButton = (
    <ListItemButton onClick={logout} sx={navItemSx(false)}>
      <ListItemIcon sx={{ minWidth: 36, justifyContent: "center" }}>
        <LogoutOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary="Sign out"
        sx={{
          flex: collapsed ? "0 0 0px" : "1 1 auto",
          opacity: collapsed ? 0 : 1,
          overflow: "hidden",
          m: 0,
          transition: mounted ? "opacity 0.12s ease, flex-basis 0.15s ease" : "none",
          "& .MuiListItemText-primary": { typography: "body2", fontWeight: 500, whiteSpace: "nowrap" },
        }}
      />
    </ListItemButton>
  );

  return (
    <Box
      component="aside"
      sx={{
        position: "sticky",
        top: 0,
        flexShrink: 0,
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${gray.border}`,
        bgcolor: "#fff",
        overflow: "hidden",
        transition: mounted ? "width 0.15s ease" : "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: collapsed ? 1 : 1.5,
          py: 2,
          borderBottom: `1px solid ${gray.border}`,
          minHeight: 68,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
          <Box
            component="button"
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 1,
              bgcolor: "primary.main",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              p: 0,
              fontFamily: "inherit",
              transition: "background-color 0.15s ease",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            EYL
          </Box>
        </Tooltip>

        {!collapsed ? (
          <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" }}>
              EYL Delivery
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
              Operations
            </Typography>
          </Box>
        ) : null}
      </Box>

      <List dense disablePadding sx={{ px: 1, py: 1.5, flex: 1 }} component="ul">
        {[...LINKS, ...(user.role === "admin" ? ADMIN_LINKS : [])].map(({ href, label, Icon }) => (
          <Box key={href} component="li" sx={{ listStyle: "none" }}>
            <NavItem
              href={href}
              label={label}
              Icon={Icon}
              active={isActive(href)}
              collapsed={collapsed}
              mounted={mounted}
            />
          </Box>
        ))}
      </List>

      <Box sx={{ px: collapsed ? 1 : 0.5, pb: 1.5, pt: 0.5 }}>
        <Divider sx={{ mb: 1 }} />
        {collapsed ? (
          <Tooltip title={`${user.name || user.email} · Profile`} placement="right" disableInteractive enterDelay={400}>
            {profileLink}
          </Tooltip>
        ) : (
          profileLink
        )}
        {collapsed ? (
          <Tooltip title="Sign out" placement="right" disableInteractive enterDelay={400}>
            {signOutButton}
          </Tooltip>
        ) : (
          signOutButton
        )}
      </Box>
    </Box>
  );
}
