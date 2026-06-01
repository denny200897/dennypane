"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CronPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [form, setForm] = useState({ schedule: "0 3 * * *", command: "", label: "" });
  const [err, setErr] = useState("");

  const load = () => api.cronJobs().then(setJobs).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.addCronJob(form);
      setForm({ schedule: "0 3 * * *", command: "", label: "" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(label: string) {
    await api.removeCronJob(label);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cron Jobs</h1>
      <p className="text-white/40 text-sm">Schedule format: minute hour day-of-month month day-of-week</p>

      <form onSubmit={add} className="bg-[#111824] border border-white/10 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input className="inp" placeholder="0 3 * * *" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} required />
        <input className="inp md:col-span-1" placeholder="command" value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} required />
        <input className="inp" placeholder="label (unique)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <button className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">Add job</button>
      </form>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="bg-[#111824] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr className="border-b border-white/10">
              <th className="p-3">Label</th>
              <th className="p-3">Schedule &amp; command</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="p-3 font-medium">{j.label}</td>
                <td className="p-3 font-mono text-xs text-white/60">{j.schedule_and_cmd}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(j.label)} className="text-red-400 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-white/40">No scheduled jobs.</td></tr>
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
