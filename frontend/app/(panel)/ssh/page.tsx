"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SshPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", hostname: "", port: 22, username: "", password: "" });
  const [selected, setSelected] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.sshHosts().then(setHosts).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function addHost(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.createSshHost({ ...form, port: Number(form.port) });
      setForm({ name: "", hostname: "", port: 22, username: "", password: "" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (selected == null) return;
    setOutput("running…");
    try {
      const res = await api.sshExec(selected, command);
      setOutput(`$ ${command}\n${res.stdout}${res.stderr}\n[exit ${res.exit_code}]`);
    } catch (e: any) {
      setOutput("Error: " + e.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">SSH / Terminal</h1>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <form onSubmit={addHost} className="bg-[#111824] border border-white/10 rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["name", "hostname", "username", "password"] as const).map((f) => (
          <input
            key={f}
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-emerald-400"
            placeholder={f}
            type={f === "password" ? "password" : "text"}
            value={(form as any)[f]}
            onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            required={f !== "password"}
          />
        ))}
        <button className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
          Add host
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {hosts.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelected(h.id)}
            className={`text-left p-4 rounded-xl border ${
              selected === h.id ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 bg-[#111824]"
            }`}
          >
            <div className="font-medium">{h.name}</div>
            <div className="text-xs text-white/40">
              {h.username}@{h.hostname}:{h.port}
            </div>
          </button>
        ))}
      </div>

      {selected != null && (
        <div className="space-y-3">
          <form onSubmit={run} className="flex gap-2">
            <span className="px-3 py-2.5 text-emerald-400 font-mono">$</span>
            <input
              className="flex-1 px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 font-mono outline-none focus:border-emerald-400"
              placeholder="uptime"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <button className="px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
              Run
            </button>
          </form>
          {output && (
            <pre className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
