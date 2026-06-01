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
      toast.success(`Container ${action}ed`);
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
        <h1 className="text-2xl font-bold tracking-tight">Containers</h1>
        <p className="text-sm text-muted-foreground">{containers.length} containers on this host</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                      <Button variant="ghost" size="icon" title="Stop" disabled={!!busy} onClick={() => act(c.id, "stop")}>
                        <Square className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" title="Start" disabled={!!busy} onClick={() => act(c.id, "start")}>
                        <Play className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Restart" disabled={!!busy} onClick={() => act(c.id, "restart")}>
                      <RotateCw className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Logs" onClick={() => showLogs(c)}>
                      <ScrollText className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Remove" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={() => act(c.id, "remove")}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {containers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No containers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!logs} onOpenChange={(o) => !o && setLogs(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Logs · {logs?.name}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-black/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
            {logs?.text || "(empty)"}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
