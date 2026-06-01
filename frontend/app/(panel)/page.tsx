"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  const color = percent > 85 ? "bg-red-400" : percent > 60 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111824] border border-white/10 rounded-xl p-5">
      <div className="text-sm text-white/50 mb-3">{title}</div>
      {children}
    </div>
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

  if (err) return <p className="text-red-400">{err}</p>;
  if (!data) return <p className="text-white/40">Loading metrics…</p>;

  const upHours = Math.floor(data.uptime_seconds / 3600);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-white/50 text-sm">
          {data.hostname} · {data.platform} · up {upHours}h
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title={`CPU · ${data.cpu.cores} cores`}>
          <div className="text-3xl font-bold mb-2">{data.cpu.percent.toFixed(0)}%</div>
          <Bar percent={data.cpu.percent} />
          <div className="text-xs text-white/40 mt-2">load {data.cpu.load_avg.join(" / ")}</div>
        </Card>
        <Card title="Memory">
          <div className="text-3xl font-bold mb-2">{data.memory.percent.toFixed(0)}%</div>
          <Bar percent={data.memory.percent} />
          <div className="text-xs text-white/40 mt-2">
            {bytes(data.memory.used)} / {bytes(data.memory.total)}
          </div>
        </Card>
        <Card title="Disk /">
          <div className="text-3xl font-bold mb-2">{data.disk.percent.toFixed(0)}%</div>
          <Bar percent={data.disk.percent} />
          <div className="text-xs text-white/40 mt-2">
            {bytes(data.disk.used)} / {bytes(data.disk.total)}
          </div>
        </Card>
      </div>
    </div>
  );
}
