"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/lineup", label: "Daily Lineup" },
  { href: "/knights", label: "Knights" },
  { href: "/salaries", label: "Salaries" },
  { href: "/clients", label: "Clients" },
  { href: "/rates", label: "Rate Cards" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-white min-h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="text-base font-bold leading-tight">EYL Delivery</div>
        <div className="text-xs text-[var(--muted)]">Operations Dashboard</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(l.href)
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--text)] hover:bg-[#f0f2f5]"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-[var(--border)]">
        <button onClick={logout} className="btn btn-secondary w-full">
          Sign out
        </button>
      </div>
    </aside>
  );
}
