"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Box,
  Globe,
  FolderTree,
  Database,
  FolderUp,
  Clock,
  SquareTerminal,
  KeyRound,
  Server,
  Settings,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/", label: "儀表板", icon: LayoutDashboard },
  { href: "/containers", label: "容器", icon: Box },
  { href: "/sites", label: "網站與應用", icon: Globe },
  { href: "/files", label: "檔案管理", icon: FolderTree },
  { href: "/databases", label: "資料庫", icon: Database },
  { href: "/ftp", label: "FTP / SFTP", icon: FolderUp },
  { href: "/cron", label: "排程任務", icon: Clock },
  { href: "/terminal", label: "終端機", icon: SquareTerminal },
  { href: "/ssh", label: "SSH 主機", icon: KeyRound },
  { href: "/settings", label: "設定", icon: Settings },
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
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中…</div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Server className="size-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            denny<span className="text-primary">Panel</span>
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4.5 shrink-0", active && "text-primary")} />
                {item.label}
                {active && <span className="ml-auto h-4 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold uppercase">
              {user.username.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.username}</div>
              <div className="text-xs text-muted-foreground">管理員</div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="登出">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-8">{children}</div>
      </main>
    </div>
  );
}
