"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

type TabDef = {
  href: string;
  label: string;
  icon: (props: { active: boolean }) => React.ReactNode;
};

const TABS: TabDef[] = [
  {
    href: "/feed",
    label: "Feed",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/post",
    label: "Post",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" stroke={active ? "#0a0a0a" : "currentColor"} />
      </svg>
    ),
  },
  {
    href: "/claims",
    label: "Claims",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l4-4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        <path d="M8 11l3 3 5-5" />
      </svg>
    ),
  },
  {
    href: "/pulls",
    label: "Pulls",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export function TabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs =
    role === "warehouse"
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
                className={`flex flex-col items-center justify-center h-14 gap-0.5 ${
                  active ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                <tab.icon active={active} />
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
