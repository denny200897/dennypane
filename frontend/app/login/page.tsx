"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Loader2 } from "lucide-react";

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
      setError(err.message || "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/60 shadow-2xl shadow-primary/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <Server className="size-6" />
          </div>
          <CardTitle className="text-2xl">
            denny<span className="text-primary">Panel</span>
          </CardTitle>
          <CardDescription>登入以管理您的伺服器</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">使用者名稱</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "登入中…" : "登入"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">預設帳密：admin / dennypanel</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
