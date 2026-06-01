"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Server, Play } from "lucide-react";

export default function SshPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", hostname: "", port: 22, username: "", password: "" });
  const [selected, setSelected] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");

  const load = () => api.sshHosts().then(setHosts).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  async function addHost(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createSshHost({ ...form, port: Number(form.port) });
      toast.success("主機已新增");
      setForm({ name: "", hostname: "", port: 22, username: "", password: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (selected == null) return;
    setOutput("執行中…");
    try {
      const res = await api.sshExec(selected, command);
      setOutput(`$ ${command}\n${res.stdout}${res.stderr}\n[結束代碼 ${res.exit_code}]`);
    } catch (e: any) {
      setOutput("錯誤：" + e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SSH 主機</h1>
        <p className="text-sm text-muted-foreground">儲存遠端主機並對其執行指令</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增主機</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addHost} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(["name", "hostname", "username", "password"] as const).map((f) => (
              <Input
                key={f}
                placeholder={{ name: "名稱", hostname: "主機位址", username: "使用者名稱", password: "密碼" }[f]}
                type={f === "password" ? "password" : "text"}
                value={(form as any)[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                required={f !== "password"}
              />
            ))}
            <Button type="submit">新增主機</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelected(h.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              selected === h.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/50",
            )}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{h.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {h.username}@{h.hostname}:{h.port}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected != null && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <form onSubmit={run} className="flex gap-2">
              <span className="self-center font-mono text-primary">$</span>
              <Input className="font-mono" placeholder="例如 uptime" value={command} onChange={(e) => setCommand(e.target.value)} />
              <Button type="submit">
                <Play className="size-4" /> 執行
              </Button>
            </form>
            {output && (
              <pre className="overflow-auto rounded-lg bg-black/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap ring-1 ring-border">
                {output}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
