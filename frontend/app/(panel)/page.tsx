"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MemoryStick, HardDrive, Clock, Server } from "lucide-react";

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
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function StatCard({
  title,
  icon: Icon,
  value,
  percent,
  sub,
}: {
  title: string;
  icon: any;
  value: string;
  percent: number;
  sub: string;
}) {
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
        <Bar percent={percent} />
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = () => api.systemOverview().then(setData).catch((e) => setErr(e.message));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
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
          <span>{data.platform}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> 已運行 {upDays > 0 ? `${upDays} 天 ` : ""}
            {upHours % 24} 小時
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title={`CPU · ${data.cpu.cores} 核心`}
          icon={Cpu}
          value={`${data.cpu.percent.toFixed(0)}%`}
          percent={data.cpu.percent}
          sub={`負載 ${data.cpu.load_avg.join(" / ")}`}
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
    </div>
  );
}
