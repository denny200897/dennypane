"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, RotateCw, ScrollText, Trash2, Plus, Loader2 } from "lucide-react";

// "8080:80" → { "80/tcp": 8080 }
function parsePorts(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split(/[\n,]/)) {
    const t = line.trim();
    if (!t) continue;
    const [host, cont] = t.split(":");
    if (host && cont) out[`${cont.trim()}/tcp`] = Number(host.trim());
  }
  return out;
}

// "KEY=VALUE" lines → { KEY: VALUE }
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

// "/host/path:/container/path" lines → { host: container }
function parseVolumes(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.lastIndexOf(":");
    if (idx > 0) out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return out;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm = { image: "", name: "", ports: "", env: "", volumes: "", restart: "unless-stopped" };
  const [form, setForm] = useState(emptyForm);

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

  async function createContainer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.runContainer({
        image: form.image.trim(),
        name: form.name.trim() || null,
        ports: parsePorts(form.ports),
        env: parseEnv(form.env),
        volumes: parseVolumes(form.volumes),
        restart: form.restart,
      });
      toast.success(`容器已建立（${form.image}）`);
      setCreateOpen(false);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">容器</h1>
          <p className="text-sm text-muted-foreground">此主機上共有 {containers.length} 個容器</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> 新建容器
        </Button>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建容器</DialogTitle>
          </DialogHeader>
          <form onSubmit={createContainer} className="space-y-4">
            <div className="space-y-1.5">
              <Label>映像檔 *</Label>
              <Input
                placeholder="例如 nginx:alpine（本機沒有會自動拉取）"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>容器名稱</Label>
              <Input
                placeholder="選填，例如 my-web"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>連接埠對應</Label>
                <textarea
                  className="h-20 w-full resize-none rounded-md bg-input/30 p-2 font-mono text-xs outline-none ring-1 ring-border focus:ring-primary"
                  placeholder={"主機:容器\n8080:80\n8443:443"}
                  value={form.ports}
                  onChange={(e) => setForm({ ...form, ports: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>掛載目錄</Label>
                <textarea
                  className="h-20 w-full resize-none rounded-md bg-input/30 p-2 font-mono text-xs outline-none ring-1 ring-border focus:ring-primary"
                  placeholder={"主機路徑:容器路徑\n/srv/data:/data"}
                  value={form.volumes}
                  onChange={(e) => setForm({ ...form, volumes: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>環境變數</Label>
              <textarea
                className="h-20 w-full resize-none rounded-md bg-input/30 p-2 font-mono text-xs outline-none ring-1 ring-border focus:ring-primary"
                placeholder={"KEY=VALUE\nTZ=Asia/Taipei"}
                value={form.env}
                onChange={(e) => setForm({ ...form, env: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>重啟策略</Label>
              <Select value={form.restart} onValueChange={(v) => setForm({ ...form, restart: v ?? "unless-stopped" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unless-stopped">unless-stopped</SelectItem>
                  <SelectItem value="always">always</SelectItem>
                  <SelectItem value="on-failure">on-failure</SelectItem>
                  <SelectItem value="no">no</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={creating || !form.image.trim()}>
                {creating && <Loader2 className="animate-spin" />}
                {creating ? "建立中…" : "建立並啟動"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
