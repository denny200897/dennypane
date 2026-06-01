"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function FtpPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ username: "", password: "", home_dir: "", protocol: "sftp" });
  const [err, setErr] = useState("");

  const load = () => api.ftpAccounts().then(setAccounts).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.createFtpAccount(form);
      setForm({ username: "", password: "", home_dir: "", protocol: "sftp" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this account?")) return;
    await api.deleteFtpAccount(id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">FTP / SFTP Accounts</h1>
      <p className="text-white/40 text-sm">
        On Linux hosts these create confined system users for file transfer. On other OSes accounts are recorded for testing.
      </p>

      <form onSubmit={create} className="bg-[#111824] border border-white/10 rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input className="inp" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input className="inp" type="password" placeholder="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <input className="inp" placeholder="home dir (/srv/ftp/user)" value={form.home_dir} onChange={(e) => setForm({ ...form, home_dir: e.target.value })} required />
        <select className="inp" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
        </select>
        <button className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">Add</button>
      </form>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="bg-[#111824] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr className="border-b border-white/10">
              <th className="p-3">Username</th>
              <th className="p-3">Protocol</th>
              <th className="p-3">Home</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="p-3 font-medium">{a.username}</td>
                <td className="p-3 uppercase text-white/60">{a.protocol}</td>
                <td className="p-3 text-white/50 font-mono text-xs">{a.home_dir}</td>
                <td className="p-3 text-white/50 text-xs">{a.status}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(a.id)} className="text-red-400 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-white/40">No accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .inp { padding: 8px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); outline: none; }
        .inp:focus { border-color: #34d399; }
      `}</style>
    </div>
  );
}
