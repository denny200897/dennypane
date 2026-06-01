"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ContainersPage() {
  const [containers, setContainers] = useState<any[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api.containers().then(setContainers).catch((e) => setErr(e.message));
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
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function showLogs(c: any) {
    const { logs } = await api.containerLogs(c.id);
    setLogs({ name: c.name, text: logs });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Containers</h1>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="bg-[#111824] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr className="border-b border-white/10">
              <th className="p-3">Name</th>
              <th className="p-3">Image</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ports</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-white/60">{c.image}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      c.state === "running"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {c.state}
                  </span>
                </td>
                <td className="p-3 text-white/50 text-xs">
                  {Object.entries(c.ports || {})
                    .map(([k, v]: any) => (v ? `${v[0]?.HostPort}→${k}` : k))
                    .join(", ")}
                </td>
                <td className="p-3 text-right space-x-1 whitespace-nowrap">
                  {c.state === "running" ? (
                    <button onClick={() => act(c.id, "stop")} disabled={!!busy} className="btn">
                      Stop
                    </button>
                  ) : (
                    <button onClick={() => act(c.id, "start")} disabled={!!busy} className="btn">
                      Start
                    </button>
                  )}
                  <button onClick={() => act(c.id, "restart")} disabled={!!busy} className="btn">
                    Restart
                  </button>
                  <button onClick={() => showLogs(c)} className="btn">
                    Logs
                  </button>
                  <button onClick={() => act(c.id, "remove")} disabled={!!busy} className="btn-danger">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {containers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/40">
                  No containers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {logs && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6" onClick={() => setLogs(null)}>
          <div className="bg-[#0d131e] border border-white/10 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between">
              <span className="font-medium">Logs · {logs.name}</span>
              <button onClick={() => setLogs(null)} className="text-white/50">✕</button>
            </div>
            <pre className="p-4 overflow-auto text-xs text-white/70 whitespace-pre-wrap">{logs.text || "(empty)"}</pre>
          </div>
        </div>
      )}

      <style jsx global>{`
        .btn {
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 12px;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .btn-danger {
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(248, 113, 113, 0.15);
          color: #fca5a5;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
