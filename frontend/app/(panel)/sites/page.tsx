"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const KINDS = [
  { id: "static", label: "Static site", desc: "nginx serving HTML/CSS/JS" },
  { id: "wordpress", label: "WordPress", desc: "WordPress + MariaDB" },
  { id: "ghost", label: "Ghost blog", desc: "Ghost CMS" },
];

export default function SitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [domain, setDomain] = useState("");
  const [kind, setKind] = useState("static");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => api.sites().then(setSites).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.createSite({ domain, kind, admin_email: email || null });
      setDomain("");
      setEmail("");
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this site and its container(s)?")) return;
    await api.deleteSite(id);
    load();
  }

  async function setupProxy(id: number, ssl: boolean) {
    setErr("");
    try {
      const res: any = await api.applyProxy(id, { enable_ssl: ssl, admin_email: email } as any);
      if (res.applied) {
        alert(ssl ? "Proxy + SSL requested. " + JSON.stringify(res.certificate || {}) : "Reverse proxy applied.");
      } else {
        alert("Generated nginx config (not applied: " + res.reason + ")\n\n" + res.config);
      }
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sites &amp; Apps</h1>

      <form onSubmit={create} className="bg-[#111824] border border-white/10 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`text-left p-3 rounded-lg border ${
                kind === k.id ? "border-emerald-400 bg-emerald-500/10" : "border-white/10"
              }`}
            >
              <div className="font-medium text-sm">{k.label}</div>
              <div className="text-xs text-white/40">{k.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-emerald-400"
            placeholder="domain (e.g. blog.example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          />
          {kind !== "static" && (
            <input
              className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-emerald-400"
              placeholder="admin email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <button
            disabled={busy}
            className="px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-50"
          >
            {busy ? "Deploying…" : "Deploy"}
          </button>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map((s) => (
          <div key={s.id} className="bg-[#111824] border border-white/10 rounded-xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{s.domain}</div>
                <div className="text-xs text-white/40 uppercase">{s.kind}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-300">
                {s.status}
              </span>
            </div>
            {s.upstream_port > 0 && (
              <a
                href={`http://localhost:${s.upstream_port}`}
                target="_blank"
                className="text-emerald-400 text-sm mt-2 inline-block"
              >
                localhost:{s.upstream_port} ↗
              </a>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => setupProxy(s.id, false)} className="text-emerald-400 text-xs">
                Setup proxy
              </button>
              <button onClick={() => setupProxy(s.id, true)} className="text-emerald-400 text-xs">
                Enable SSL
              </button>
              {s.ssl_enabled && <span className="text-xs text-emerald-300">🔒 SSL</span>}
              <button onClick={() => remove(s.id)} className="text-red-400 text-xs ml-auto">
                Delete
              </button>
            </div>
          </div>
        ))}
        {sites.length === 0 && <p className="text-white/40">No sites yet. Deploy one above.</p>}
      </div>
    </div>
  );
}
