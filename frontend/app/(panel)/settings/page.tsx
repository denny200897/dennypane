"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, KeyRound, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);

  const refresh = () => api.me().then(setMe).catch((e) => toast.error(e.message));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-muted-foreground">管理您的帳號、密碼與安全性</p>
      </div>

      <AccountCard me={me} onChanged={refresh} />
      <PasswordCard />
      <TwoFACard me={me} onChanged={refresh} />
    </div>
  );
}

function AccountCard({ me, onChanged }: { me: any; onChanged: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setUsername(me.username);
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.changeUsername(password, username);
      toast.success("使用者名稱已更新");
      setPassword("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4.5 text-primary" /> 帳號
        </CardTitle>
        <CardDescription>更改您的使用者名稱（需輸入目前密碼確認）</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid max-w-md gap-4">
          <div className="space-y-1.5">
            <Label>使用者名稱</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="space-y-1.5">
            <Label>目前密碼</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <Button type="submit" disabled={busy || !me}>
              {busy && <Loader2 className="animate-spin" />} 儲存使用者名稱
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("兩次輸入的新密碼不一致");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      toast.success("密碼已更新");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4.5 text-primary" /> 密碼
        </CardTitle>
        <CardDescription>定期更換密碼以維護帳號安全</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid max-w-md gap-4">
          <div className="space-y-1.5">
            <Label>目前密碼</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>新密碼</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label>確認新密碼</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} 更新密碼
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFACard({ me, onChanged }: { me: any; onChanged: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const enabled = me?.totp_enabled;

  useEffect(() => {
    if (setup?.otpauth_uri) {
      QRCode.toDataURL(setup.otpauth_uri, { margin: 1, width: 200 }).then(setQr).catch(() => {});
    }
  }, [setup]);

  async function startSetup() {
    setBusy(true);
    try {
      setSetup(await api.setup2fa());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.enable2fa(code);
      toast.success("已啟用兩步驟驗證");
      setSetup(null);
      setCode("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.disable2fa(password);
      toast.success("已停用兩步驟驗證");
      setPassword("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4.5 text-primary" /> 兩步驟驗證 (2FA)
          {enabled ? (
            <Badge variant="default">已啟用</Badge>
          ) : (
            <Badge variant="secondary">未啟用</Badge>
          )}
        </CardTitle>
        <CardDescription>
          使用 Google Authenticator、Authy 等驗證器 App，登入時額外輸入一次性驗證碼。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <form onSubmit={disable} className="grid max-w-md gap-4">
            <p className="text-sm text-muted-foreground">輸入目前密碼以停用兩步驟驗證。</p>
            <div className="space-y-1.5">
              <Label>目前密碼</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ShieldOff className="size-4" />} 停用 2FA
              </Button>
            </div>
          </form>
        ) : !setup ? (
          <Button onClick={startSetup} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} 設定兩步驟驗證
          </Button>
        ) : (
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              {qr ? (
                <img src={qr} alt="2FA QR" className="rounded-lg bg-white p-2" width={200} height={200} />
              ) : (
                <div className="flex size-[200px] items-center justify-center rounded-lg bg-muted">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">用驗證器 App 掃描</p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">或手動輸入金鑰：</p>
                <code className="mt-1 block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {setup.secret}
                </code>
              </div>
              <Separator />
              <form onSubmit={enable} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>輸入驗證器顯示的 6 位數驗證碼</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />} 確認並啟用
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                    取消
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
