"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(username, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[#111824] border border-white/10 rounded-2xl p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            denny<span className="text-emerald-400">Panel</span>
          </h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your server</p>
        </div>
        <div className="space-y-3">
          <input
            className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-emerald-400"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-emerald-400"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-white/30 text-center">Default: admin / dennypanel</p>
      </form>
    </div>
  );
}
