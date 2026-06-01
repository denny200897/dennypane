"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export default function FtpPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ username: "", password: "", home_dir: "", protocol: "sftp" });

  const load = () => api.ftpAccounts().then(setAccounts).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createFtpAccount(form);
      toast.success("帳號已建立");
      setForm({ username: "", password: "", home_dir: "", protocol: "sftp" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: number) {
    if (!confirm("確定要刪除此帳號嗎？")) return;
    await api.deleteFtpAccount(id);
    toast.success("已刪除");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">FTP / SFTP 帳號</h1>
        <p className="text-sm text-muted-foreground">
          在 Linux 上會建立受限的系統使用者；在其他作業系統上僅記錄帳號以供測試。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增帳號</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="使用者名稱" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <Input type="password" placeholder="密碼" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Input placeholder="家目錄 /srv/ftp/user" value={form.home_dir} onChange={(e) => setForm({ ...form, home_dir: e.target.value })} required />
            <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v ?? "sftp" })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sftp">SFTP</SelectItem>
                <SelectItem value="ftp">FTP</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">新增帳號</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>使用者名稱</TableHead>
              <TableHead>協定</TableHead>
              <TableHead>家目錄</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.username}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="uppercase">{a.protocol}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.home_dir}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.status}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => remove(a.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  尚無帳號。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
