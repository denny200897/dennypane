"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function DatabasesPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [open, setOpen] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    api.dbServers().then(setServers).catch((e) => setErr(e.message));
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
    const res = await api.dbDatabases(id);
    setOpen((o) => ({ ...o, [id]: res.databases }));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Databases</h1>
      <p className="text-white/40 text-sm">MySQL / MariaDB / Postgres servers discovered from your Docker containers.</p>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="space-y-3">
        {servers.map((s) => (
          <div key={s.id} className="bg-[#111824] border border-white/10 rounded-xl p-5">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-semibold">{s.name}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 uppercase">{s.engine}</span>
                <div className="text-xs text-white/40">{s.image}</div>
              </div>
              <button onClick={() => toggle(s.id)} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm hover:bg-white/20">
                {open[s.id] ? "Hide" : "Show databases"}
              </button>
            </div>
            {open[s.id] && (
              <ul className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {open[s.id].length === 0 && <li className="text-white/40 text-sm">No databases / no access.</li>}
                {open[s.id].map((db) => (
                  <li key={db} className="px-3 py-2 rounded bg-black/30 text-sm font-mono">🗄 {db}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {servers.length === 0 && <p className="text-white/40">No database servers found. Deploy a WordPress site or run a DB container.</p>}
      </div>
    </div>
  );
}
