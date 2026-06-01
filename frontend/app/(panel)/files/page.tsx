"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

function bytes(n: number) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(0)} ${u[i]}`;
}

export default function FilesPage() {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback((p: string) => {
    api
      .listFiles(p)
      .then((d) => {
        setEntries(d.entries);
        setPath(d.path);
        setErr("");
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const crumbs = path ? path.split("/") : [];

  async function open(entry: any) {
    if (entry.is_dir) {
      load(entry.path);
    } else {
      const f = await api.readFile(entry.path);
      setEditing(f);
    }
  }

  async function save() {
    if (!editing) return;
    await api.writeFile(editing.path, editing.content);
    setEditing(null);
    load(path);
  }

  async function makeDir() {
    const name = prompt("New folder name");
    if (!name) return;
    await api.mkdir(path ? `${path}/${name}` : name);
    load(path);
  }

  async function remove(entry: any) {
    if (!confirm(`Delete ${entry.name}?`)) return;
    await api.deletePath(entry.path);
    load(path);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">File Manager</h1>
        <button onClick={makeDir} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm hover:bg-white/20">
          + New folder
        </button>
      </div>

      <div className="flex gap-1 text-sm text-white/60">
        <button onClick={() => load("")} className="hover:text-emerald-400">
          root
        </button>
        {crumbs.map((c, i) => (
          <span key={i}>
            {" / "}
            <button onClick={() => load(crumbs.slice(0, i + 1).join("/"))} className="hover:text-emerald-400">
              {c}
            </button>
          </span>
        ))}
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="bg-[#111824] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {entries.map((e) => (
              <tr key={e.path} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 cursor-pointer" onClick={() => open(e)}>
                  {e.is_dir ? "📁" : "📄"} {e.name}
                </td>
                <td className="p-3 text-white/40 text-right w-24">{e.is_dir ? "" : bytes(e.size)}</td>
                <td className="p-3 text-right w-20">
                  <button onClick={() => remove(e)} className="text-red-400 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="p-6 text-center text-white/40">Empty folder.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6" onClick={() => setEditing(null)}>
          <div className="bg-[#0d131e] border border-white/10 rounded-xl w-full max-w-4xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <span className="font-mono text-sm">{editing.path}</span>
              <div className="space-x-2">
                <button onClick={save} className="px-3 py-1 rounded bg-emerald-500 text-black text-sm font-semibold">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="text-white/50">
                  ✕
                </button>
              </div>
            </div>
            <textarea
              className="p-4 bg-black/40 font-mono text-xs text-white/80 h-[60vh] outline-none resize-none"
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
