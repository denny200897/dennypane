"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(username, password, needOtp ? otp : undefined);
      router.push("/");
    } catch (err: any) {
      if (err.message === "OTP_REQUIRED") {
        setNeedOtp(true);
        setError("");
      } else {
        setError(err.message || "登入失敗");
      }
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
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={needOtp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={needOtp}
              />
            </div>
            {needOtp && (
              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" /> 兩步驟驗證碼
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 位數驗證碼"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">請輸入驗證器 App 上顯示的 6 位數字</p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "登入中…" : needOtp ? "驗證並登入" : "登入"}
            </Button>
            {!needOtp && (
              <p className="text-center text-xs text-muted-foreground">預設帳密：admin / dennypanel</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
