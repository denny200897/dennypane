"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert, ShieldBan, ShieldCheck, Ban, Loader2, RefreshCw } from "lucide-react";

type LoginEvent = {
  id: number;
  username: string;
  ip: string;
  user_agent: string;
  success: boolean;
  reason: string;
  created_at: string;
};
type BlockedIp = { id: number; ip: string; reason: string; created_at: string };

const REASON_LABEL: Record<string, string> = {
  bad_password: "帳號或密碼錯誤",
  bad_otp: "兩步驟驗證碼錯誤",
  blocked: "IP 已封鎖",
};

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function SecurityPage() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [ev, bl] = await Promise.all([api.loginHistory(200), api.blockedIps()]);
      setEvents(ev);
      setBlocked(bl);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const blockedSet = new Set(blocked.map((b) => b.ip));

  async function block(ip: string, reason: string) {
    try {
      await api.blockIp(ip, reason);
      toast.success(`已封鎖 ${ip}，該 IP 的登入工作階段已失效`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function unblock(id: number, ip: string) {
    try {
      await api.unblockIp(id);
      toast.success(`已解除封鎖 ${ip}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">登入紀錄</h1>
          <p className="text-sm text-muted-foreground">
            檢視登入活動，發現可疑 IP 時可立即封鎖並強制登出
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />} 重新整理
        </Button>
      </div>

      <BlockManual onBlock={block} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldBan className="size-4.5 text-primary" /> 已封鎖的 IP
            <Badge variant="secondary">{blocked.length}</Badge>
          </CardTitle>
          <CardDescription>
            封鎖後，來自該 IP 的請求會立即被拒絕（即使持有有效權杖也會被登出）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前沒有被封鎖的 IP。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP 位址</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>封鎖時間</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocked.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.ip}</TableCell>
                    <TableCell className="text-muted-foreground">{b.reason || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{fmt(b.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => unblock(b.id, b.ip)}>
                        <ShieldCheck className="size-4" /> 解除封鎖
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4.5 text-primary" /> 登入活動
          </CardTitle>
          <CardDescription>最近的登入嘗試（含成功與失敗）</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無登入紀錄。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>使用者</TableHead>
                  <TableHead>IP 位址</TableHead>
                  <TableHead>瀏覽器 / 用戶端</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.success ? (
                        <Badge variant="default">成功</Badge>
                      ) : (
                        <Badge variant="destructive">
                          {REASON_LABEL[e.reason] || "失敗"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(e.created_at)}</TableCell>
                    <TableCell>{e.username}</TableCell>
                    <TableCell className="font-mono">{e.ip}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground" title={e.user_agent}>
                      {e.user_agent || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {blockedSet.has(e.ip) ? (
                        <Badge variant="secondary">已封鎖</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => block(e.ip, `來自登入紀錄：${e.username}`)}
                        >
                          <Ban className="size-4" /> 封鎖
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BlockManual({ onBlock }: { onBlock: (ip: string, reason: string) => void }) {
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    onBlock(ip.trim(), reason.trim());
    setIp("");
    setReason("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ban className="size-4.5 text-primary" /> 手動封鎖 IP
        </CardTitle>
        <CardDescription>輸入要封鎖的 IP 位址（IPv4 或 IPv6）</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Input
              placeholder="例如 203.0.113.45"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Input
              placeholder="原因（選填）"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" variant="destructive">
            <Ban className="size-4" /> 封鎖
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
