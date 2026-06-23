"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeIndianRupee,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const SIDEBAR_STORAGE_KEY = "eyl-sidebar-collapsed";

const LINKS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/deliveries", label: "Deliveries", Icon: PackageCheck },
  { href: "/lineup", label: "Daily Lineup", Icon: CalendarDays },
  { href: "/knights", label: "Knights", Icon: ShieldCheck },
  { href: "/salaries", label: "Salaries", Icon: BadgeIndianRupee },
  { href: "/clients", label: "Clients", Icon: Users },
  { href: "/rates", label: "Rate Cards", Icon: CreditCard },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggleSidebar() {
    setIsCollapsed((current) => {
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

  return (
    <aside
      className={`${
        isCollapsed ? "w-16" : "w-56"
      } shrink-0 border-r border-[var(--border)] bg-white min-h-screen sticky top-0 flex flex-col transition-[width] duration-200 ease-in-out`}
    >
      <div
        className={`border-b border-[var(--border)] ${
          isCollapsed ? "px-2 py-3" : "px-4 py-4"
        }`}
      >
        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-xs font-bold text-white transition-colors hover:bg-[var(--brand-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            EYL
          </button>
          {!isCollapsed ? (
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight">EYL Delivery</div>
              <div className="text-xs text-[var(--muted)]">Operations Dashboard</div>
            </div>
          ) : null}
        </div>
      </div>
      <nav className={`flex-1 space-y-1 ${isCollapsed ? "p-2" : "p-3"}`}>
        {LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex h-10 items-center rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text)] hover:bg-[#f0f2f5]"
              } ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
              title={label}
              aria-label={label}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[var(--muted)]"}`}
                strokeWidth={2}
              />
              {!isCollapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className={`border-t border-[var(--border)] ${isCollapsed ? "p-2" : "p-3"}`}>
        <button
          type="button"
          onClick={logout}
          className={`btn btn-secondary ${isCollapsed ? "h-10 w-10 p-0" : "w-full"}`}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {!isCollapsed ? <span>Sign out</span> : null}
        </button>
      </div>
    </aside>
  );
}
