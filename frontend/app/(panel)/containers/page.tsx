"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Square, RotateCw, ScrollText, Trash2 } from "lucide-react";

export default function ContainersPage() {
  const [containers, setContainers] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null);

  const load = useCallback(() => {
    api.containers().then(setContainers).catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: string) {
    setBusy(id + action);
    try {
      await api.containerAction(id, action);
      const verb: Record<string, string> = { start: "已啟動", stop: "已停止", restart: "已重啟", remove: "已移除" };
      toast.success(`容器${verb[action] ?? "操作完成"}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  async function showLogs(c: any) {
    try {
      const { logs } = await api.containerLogs(c.id);
      setLogs({ name: c.name, text: logs });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">容器</h1>
        <p className="text-sm text-muted-foreground">此主機上共有 {containers.length} 個容器</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead>映像檔</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>連接埠</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.image}</TableCell>
                <TableCell>
                  <Badge variant={c.state === "running" ? "default" : "secondary"}>
                    <span
                      className={`mr-1 inline-block size-1.5 rounded-full ${
                        c.state === "running" ? "bg-primary-foreground" : "bg-muted-foreground"
                      }`}
                    />
                    {c.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {Object.entries(c.ports || {})
                    .map(([k, v]: any) => (v ? `${v[0]?.HostPort}→${k}` : k))
                    .join(", ")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.state === "running" ? (
                      <Button variant="ghost" size="icon" title="停止" disabled={!!busy} onClick={() => act(c.id, "stop")}>
                        <Square className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" title="啟動" disabled={!!busy} onClick={() => act(c.id, "start")}>
                        <Play className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="重啟" disabled={!!busy} onClick={() => act(c.id, "restart")}>
                      <RotateCw className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="日誌" onClick={() => showLogs(c)}>
                      <ScrollText className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="移除" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={() => act(c.id, "remove")}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {containers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  找不到任何容器。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!logs} onOpenChange={(o) => !o && setLogs(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">日誌 · {logs?.name}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-black/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
            {logs?.text || "（空）"}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
