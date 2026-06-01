"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getToken } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▣" },
  { href: "/containers", label: "Containers", icon: "❒" },
  { href: "/sites", label: "Sites & Apps", icon: "🌐" },
  { href: "/files", label: "File Manager", icon: "🗂" },
  { href: "/databases", label: "Databases", icon: "🗄" },
  { href: "/ftp", label: "FTP / SFTP", icon: "📁" },
  { href: "/cron", label: "Cron Jobs", icon: "⏱" },
  { href: "/terminal", label: "Terminal", icon: "▶" },
  { href: "/ssh", label: "SSH Hosts", icon: "⌘" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api.me().then(setUser).catch(() => router.replace("/login"));
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-white/40">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-white/10 bg-[#0d131e] flex flex-col">
        <div className="p-5 text-xl font-bold">
          denny<span className="text-emerald-400">Panel</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  active ? "bg-emerald-500/15 text-emerald-300" : "text-white/60 hover:bg-white/5"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm">
          <div className="text-white/50 mb-2">{user.username}</div>
          <button onClick={logout} className="text-red-400 hover:text-red-300 text-xs">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
