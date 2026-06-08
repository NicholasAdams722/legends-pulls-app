"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const TABS = [
  { href: "/feed", label: "Feed" },
  { href: "/post", label: "Post" },
  { href: "/claims", label: "Claims" },
  { href: "/pulls", label: "Pulls" },
  { href: "/history", label: "History" },
] as const;

export function TabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  // Warehouse-only users don't post pulls in v1
  const tabs = role === "warehouse"
    ? TABS.filter((t) => t.href !== "/post" && t.href !== "/pulls")
    : TABS;

  return (
    <nav className="pb-safe sticky bottom-0 z-10 bg-zinc-950/95 backdrop-blur border-t border-zinc-900">
      <ul className="flex">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex items-center justify-center h-14 text-xs font-medium ${
                  active ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
