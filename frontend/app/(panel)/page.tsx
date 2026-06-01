"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Server,
  Box,
  Play,
  Square,
  Layers,
  HardDriveDownload,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

function bytes(n: number) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}

function Bar({ percent }: { percent: number }) {
  const color = percent > 85 ? "bg-destructive" : percent > 60 ? "bg-amber-400" : "bg-primary";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function StatCard({ title, icon: Icon, value, percent, sub }: any) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl" />
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {percent != null && <Bar percent={percent} />}
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "text-foreground" }: any) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className={`text-lg font-semibold leading-none ${tone}`}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [docker, setDocker] = useState<any>(null);
  const [procs, setProcs] = useState<any[]>([]);
  const [net, setNet] = useState({ up: 0, down: 0 });
  const [err, setErr] = useState("");
  const prev = useRef<{ sent: number; recv: number; t: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.systemOverview();
        const now = Date.now();
        if (prev.current) {
          const dt = (now - prev.current.t) / 1000;
          if (dt > 0) {
            setNet({
              up: Math.max(0, (d.network.bytes_sent - prev.current.sent) / dt),
              down: Math.max(0, (d.network.bytes_recv - prev.current.recv) / dt),
            });
          }
        }
        prev.current = { sent: d.network.bytes_sent, recv: d.network.bytes_recv, t: now };
        setData(d);
      } catch (e: any) {
        setErr(e.message);
      }
    };
    load();
    api.dockerSummary().then(setDocker).catch(() => {});
    api.processes(8).then(setProcs).catch(() => {});
    const t = setInterval(() => {
      load();
      api.processes(8).then(setProcs).catch(() => {});
    }, 3000);
    const t2 = setInterval(() => api.dockerSummary().then(setDocker).catch(() => {}), 8000);
    return () => {
      clearInterval(t);
      clearInterval(t2);
    };
  }, []);

  if (err) return <p className="text-destructive">{err}</p>;
  if (!data) return <p className="text-muted-foreground">正在載入系統資訊…</p>;

  const upHours = Math.floor(data.uptime_seconds / 3600);
  const upDays = Math.floor(upHours / 24);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">儀表板</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Server className="size-3.5" /> {data.hostname}
          </span>
          <span>{data.os} · {data.arch}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> 已運行 {upDays > 0 ? `${upDays} 天 ` : ""}
            {upHours % 24} 小時
          </span>
        </p>
      </div>

      {/* Docker 概況 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Box} label="容器總數" value={docker ? docker.containers_total : "—"} />
        <MiniStat icon={Play} label="運行中" value={docker ? docker.containers_running : "—"} tone="text-primary" />
        <MiniStat icon={Square} label="已停止" value={docker ? docker.containers_stopped : "—"} />
        <MiniStat icon={Layers} label="映像檔" value={docker ? docker.images : "—"} />
      </div>

      {/* 主要資源 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title={`CPU · ${data.cpu.cores} 核心`}
          icon={Cpu}
          value={`${data.cpu.percent.toFixed(0)}%`}
          percent={data.cpu.percent}
          sub={`負載 ${data.cpu.load_avg.join(" / ")} · ${data.cpu.physical_cores} 實體核心`}
        />
        <StatCard
          title="記憶體"
          icon={MemoryStick}
          value={`${data.memory.percent.toFixed(0)}%`}
          percent={data.memory.percent}
          sub={`${bytes(data.memory.used)} / ${bytes(data.memory.total)}`}
        />
        <StatCard
          title="磁碟 /"
          icon={HardDrive}
          value={`${data.disk.percent.toFixed(0)}%`}
          percent={data.disk.percent}
          sub={`${bytes(data.disk.used)} / ${bytes(data.disk.total)}`}
        />
      </div>

      {/* 次要資源：Swap / 網路 / 每核心 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          title="Swap"
          icon={HardDriveDownload}
          value={data.swap.total > 0 ? `${data.swap.percent.toFixed(0)}%` : "無"}
          percent={data.swap.total > 0 ? data.swap.percent : 0}
          sub={data.swap.total > 0 ? `${bytes(data.swap.used)} / ${bytes(data.swap.total)}` : "未設定 swap"}
        />
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">網路流量</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-xl font-bold">
              <ArrowDown className="size-4 text-primary" /> {bytes(net.down)}/s
            </div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <ArrowUp className="size-4 text-amber-400" /> {bytes(net.up)}/s
            </div>
            <div className="text-xs text-muted-foreground">
              累計 ↓ {bytes(data.network.bytes_recv)} · ↑ {bytes(data.network.bytes_sent)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">每核心使用率</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {data.cpu.per_core.map((p: number, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-xs text-muted-foreground">#{i}</span>
                  <Bar percent={p} />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums">{p.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 程序 Top */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">資源用量最高的程序</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">PID</th>
                  <th className="px-3 py-2 font-medium">名稱</th>
                  <th className="px-3 py-2 font-medium">使用者</th>
                  <th className="px-3 py-2 text-right font-medium">CPU%</th>
                  <th className="px-3 py-2 text-right font-medium">記憶體%</th>
                </tr>
              </thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.pid} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.pid}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.username || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(p.cpu_percent || 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(p.memory_percent || 0).toFixed(1)}</td>
                  </tr>
                ))}
                {procs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      載入中…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
