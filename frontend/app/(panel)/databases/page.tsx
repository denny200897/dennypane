"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ChevronDown, ChevronUp } from "lucide-react";

export default function DatabasesPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [open, setOpen] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.dbServers().then(setServers).catch((e) => toast.error(e.message));
  }, []);

  async function toggle(id: string) {
    if (open[id]) {
      setOpen((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      return;
    }
    try {
      const res = await api.dbDatabases(id);
      setOpen((o) => ({ ...o, [id]: res.databases }));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">資料庫</h1>
        <p className="text-sm text-muted-foreground">
          從您的 Docker 容器中探索到的 MySQL / MariaDB / Postgres 伺服器。
        </p>
      </div>

      <div className="space-y-3">
        {servers.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">{s.image}</div>
                </div>
                <Badge variant="secondary" className="uppercase">{s.engine}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => toggle(s.id)}>
                {open[s.id] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {open[s.id] ? "隱藏" : "資料庫"}
              </Button>
            </CardHeader>
            {open[s.id] && (
              <CardContent>
                <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {open[s.id].length === 0 && (
                    <li className="text-sm text-muted-foreground">無資料庫 / 無存取權限。</li>
                  )}
                  {open[s.id].map((db) => (
                    <li key={db} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 font-mono text-sm">
                      <Database className="size-3.5 text-muted-foreground" /> {db}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        ))}
        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            找不到資料庫伺服器。請部署 WordPress 網站或啟動一個資料庫容器。
          </p>
        )}
      </div>
    </div>
  );
}
