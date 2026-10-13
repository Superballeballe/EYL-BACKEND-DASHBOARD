"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Form from "next/form";
import {
  Badge,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import TwoWheelerOutlinedIcon from "@mui/icons-material/TwoWheelerOutlined";
import { chrome, CONTROL_RADIUS, gray, ink, RADIUS } from "@/lib/surface";

const SIDEBAR_STORAGE_KEY = "eyl-sidebar-collapsed";
const TOPBAR_H = 56;
const EXPANDED_W = 240;
const COLLAPSED_W = 60;
const CONTROL = `${CONTROL_RADIUS}px`;
/** The frame's rounded top corners: quarter-circle cut-outs hanging off the top bar. */
const cornerMask = (side: "left" | "right") =>
  `radial-gradient(circle at ${side === "left" ? "100%" : "0"} 100%, transparent ${RADIUS}px, ${chrome.bar} ${RADIUS + 0.5}px)`;

type NavLink = { href: string; label: string; Icon: typeof DashboardOutlinedIcon; adminOnly?: boolean };

const SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Operations",
    links: [
      { href: "/", label: "Dashboard", Icon: DashboardOutlinedIcon },
      { href: "/deliveries", label: "Deliveries", Icon: LocalShippingOutlinedIcon },
      { href: "/cancelled-orders", label: "Cancelled orders", Icon: CancelOutlinedIcon },
      { href: "/refunds", label: "Refunds", Icon: CurrencyRupeeOutlinedIcon },
      { href: "/map", label: "Plotting map", Icon: MapOutlinedIcon },
      { href: "/lineup", label: "Daily Lineup", Icon: CalendarMonthOutlinedIcon },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/knights", label: "Knights", Icon: ShieldOutlinedIcon },
      { href: "/eyl-knights", label: "Approve new knights", Icon: TwoWheelerOutlinedIcon },
      { href: "/salaries", label: "Salaries", Icon: BadgeOutlinedIcon },
      { href: "/clients", label: "Clients", Icon: PeopleOutlinedIcon },
    ],
  },
  {
    title: "Setup",
    links: [
      { href: "/rates", label: "Rate Cards", Icon: CreditCardOutlinedIcon },
      { href: "/coupons", label: "Coupons", Icon: ConfirmationNumberOutlinedIcon },
      { href: "/hub-contacts", label: "Customer care", Icon: PhoneInTalkOutlinedIcon },
      { href: "/invoices", label: "Tax invoices", Icon: DescriptionOutlinedIcon },
      { href: "/admin/users", label: "Team", Icon: ManageAccountsOutlinedIcon, adminOnly: true },
    ],
  },
];

const linkSx = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
} as const;

const navItemSx = (active: boolean) => ({
  mb: 0.5,
  borderRadius: CONTROL,
  minHeight: 28,
  py: 0.5,
  px: 1,
  color: "text.primary",
  "& .MuiListItemIcon-root": { color: active ? "text.primary" : ink.icon },
  ...(active
    ? { "&, &.Mui-selected, &:hover, &.Mui-selected:hover": { bgcolor: "#fafafa" } }
    : { "&:hover": { bgcolor: gray.hover } }),
});

const navIconSx = (collapsed: boolean) => ({
  minWidth: 20,
  mr: collapsed ? 0 : 1,
  justifyContent: "center",
  "& svg": { fontSize: 18 },
});

/** The label fades and gives up its width as the sidebar collapses to icons. */
const navTextSx = (collapsed: boolean, mounted: boolean, active: boolean) => ({
  flex: collapsed ? "0 0 0px" : "1 1 auto",
  opacity: collapsed ? 0 : 1,
  overflow: "hidden",
  m: 0,
  transition: mounted ? "opacity 0.12s ease, flex-basis 0.15s ease" : "none",
  "& .MuiListItemText-primary": {
    fontSize: "0.8125rem",
    lineHeight: "20px",
    fontWeight: active ? 600 : 500,
    whiteSpace: "nowrap",
  },
});

function NavItem({
  href,
  label,
  Icon,
  active,
  collapsed,
  mounted,
  badge = 0,
}: {
  badge?: number;
  href: string;
  label: string;
  Icon: NavLink["Icon"];
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
        <ListItemIcon sx={navIconSx(collapsed)}>
          <Badge color="warning" variant="dot" invisible={!collapsed || badge <= 0}>
            <Icon fontSize="small" />
          </Badge>
        </ListItemIcon>
        <ListItemText primary={label} sx={navTextSx(collapsed, mounted, active)} />
        {badge > 0 && !collapsed ? (
          <Box
            component="span"
            aria-label={`${badge} need review`}
            sx={{
              ml: 1,
              px: 0.75,
              minWidth: 20,
              textAlign: "center",
              borderRadius: CONTROL,
              bgcolor: "rgba(0, 0, 0, 0.08)",
              color: "text.secondary",
              fontSize: "0.75rem",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </Box>
        ) : null}
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
  reviewCount = 0,
}: {
  user: { email: string; name: string | null; role: "admin" | "operator" };
  /** Open payment_reviews: badge on Refunds. */
  reviewCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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
    setMenuAnchor(null);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const profileActive = isActive("/profile");
  const menuOpen = Boolean(menuAnchor);
  const displayName = user.name || user.email;

  return (
    <>
      <Box
        component="header"
        sx={{
          gridColumn: "1 / -1",
          position: "sticky",
          top: 0,
          zIndex: "appBar",
          height: TOPBAR_H,
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 1.5,
          bgcolor: chrome.bar,
          color: chrome.text,
          "&::before, &::after": {
            content: '""',
            position: "absolute",
            top: "100%",
            width: RADIUS,
            height: RADIUS,
            pointerEvents: "none",
          },
          "&::before": { left: 0, background: cornerMask("left") },
          "&::after": { right: 0, background: cornerMask("right") },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1.25 }}>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Box
              component="button"
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 0,
                border: "none",
                borderRadius: CONTROL,
                bgcolor: "transparent",
                color: chrome.text,
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                "&:hover": { bgcolor: chrome.control },
                "&:focus-visible": { outline: `2px solid ${chrome.muted}`, outlineOffset: 2 },
              }}
            >
              {collapsed ? <MenuIcon sx={{ fontSize: 20 }} /> : <MenuOpenIcon sx={{ fontSize: 20 }} />}
            </Box>
          </Tooltip>
          <Box
            component={Link}
            href="/"
            aria-label="EYL Delivery — dashboard"
            sx={{
              width: 36,
              height: 28,
              flexShrink: 0,
              borderRadius: CONTROL,
              bgcolor: "#fff",
              color: chrome.bar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textDecoration: "none",
              "&:focus-visible": { outline: `2px solid ${chrome.muted}`, outlineOffset: 2 },
            }}
          >
            EYL
          </Box>
          <Typography
            sx={{
              display: { xs: "none", sm: "block" },
              color: "#fff",
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            EYL Delivery
          </Typography>
          <Box
            component="span"
            sx={{
              display: { xs: "none", md: "block" },
              px: 0.75,
              border: `1px solid ${chrome.border}`,
              borderRadius: "6px",
              fontSize: "0.6875rem",
              fontWeight: 500,
              lineHeight: "18px",
              whiteSpace: "nowrap",
            }}
          >
            Operations
          </Box>
        </Box>

        <Box sx={{ flex: "0 1 480px", minWidth: 0 }}>
          <Form action="/deliveries" role="search">
            <Box
              component="label"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                height: 32,
                px: 1.25,
                borderRadius: CONTROL,
                border: `1px solid ${chrome.border}`,
                bgcolor: chrome.control,
                color: chrome.muted,
                cursor: "text",
                "&:focus-within": { borderColor: chrome.muted },
              }}
            >
              <SearchIcon sx={{ fontSize: 16 }} />
              <Box
                component="input"
                type="search"
                name="q"
                placeholder="Search deliveries"
                aria-label="Search deliveries"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  p: 0,
                  border: "none",
                  outline: "none",
                  bgcolor: "transparent",
                  color: chrome.text,
                  font: "inherit",
                  fontSize: "0.8125rem",
                  "&::placeholder": { color: chrome.muted, opacity: 1 },
                }}
              />
            </Box>
          </Form>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end" }}>
          <Box
            component="button"
            type="button"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            aria-label={`Account menu for ${displayName}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
              height: 36,
              pl: 0.5,
              pr: { xs: 0.5, md: 1 },
              border: "none",
              borderRadius: CONTROL,
              bgcolor: profileActive || menuOpen ? chrome.control : "transparent",
              color: chrome.text,
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.8125rem",
              fontWeight: 500,
              transition: "background-color 0.15s ease",
              "&:hover": { bgcolor: chrome.control },
              "&:focus-visible": { outline: `2px solid ${chrome.muted}`, outlineOffset: 2 },
            }}
          >
            <Box
              component="span"
              sx={{
                width: 28,
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: CONTROL,
                bgcolor: "#36d3bd",
                color: chrome.bar,
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              {userInitials(user.name, user.email)}
            </Box>
            <Box
              component="span"
              sx={{
                display: { xs: "none", md: "block" },
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </Box>
          </Box>
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { mt: 0.5, minWidth: 220 } } }}
          >
            <MenuItem component={Link} href="/profile" selected={profileActive} onClick={() => setMenuAnchor(null)}>
              <ListItemIcon>
                <PersonOutlineOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Profile"
                secondary={user.email}
                slotProps={{
                  primary: { sx: { fontSize: "0.8125rem", fontWeight: 500 } },
                  secondary: { sx: { fontSize: "0.75rem" }, noWrap: true },
                }}
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout}>
              <ListItemIcon>
                <LogoutOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Sign out" slotProps={{ primary: { sx: { fontSize: "0.8125rem", fontWeight: 500 } } }} />
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box
        component="aside"
        sx={{
          position: "sticky",
          top: TOPBAR_H,
          alignSelf: "start",
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
          display: "flex",
          flexDirection: "column",
          bgcolor: gray.sidebar,
          overflow: "hidden",
          transition: mounted ? "width 0.15s ease" : "none",
        }}
      >
        <Box component="nav" aria-label="Main" sx={{ p: 1.5, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {SECTIONS.map(({ title, links }, index) => (
            <Box key={title} sx={{ mt: index === 0 ? 0 : 1.5 }}>
              {collapsed ? (
                index > 0 ? <Divider sx={{ mb: 1 }} /> : null
              ) : (
                <Typography
                  variant="caption"
                  sx={{ display: "block", px: 1, mb: 0.5, color: "text.secondary", fontWeight: 500, whiteSpace: "nowrap" }}
                >
                  {title}
                </Typography>
              )}
              <List dense disablePadding component="ul">
                {links
                  .filter((link) => !link.adminOnly || user.role === "admin")
                  .map(({ href, label, Icon }) => (
                    <Box key={href} component="li" sx={{ listStyle: "none" }}>
                      <NavItem
                        href={href}
                        label={label}
                        Icon={Icon}
                        active={isActive(href)}
                        collapsed={collapsed}
                        mounted={mounted}
                        badge={href === "/refunds" ? reviewCount : 0}
                      />
                    </Box>
                  ))}
              </List>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}
