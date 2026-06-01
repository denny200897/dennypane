"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";

export default function CronPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [form, setForm] = useState({ schedule: "0 3 * * *", command: "", label: "" });

  const load = () => api.cronJobs().then(setJobs).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.addCronJob(form);
      toast.success("任務已新增");
      setForm({ schedule: "0 3 * * *", command: "", label: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(label: string) {
    await api.removeCronJob(label);
    toast.success("任務已移除");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">排程任務</h1>
        <p className="text-sm text-muted-foreground">
          格式：<code className="font-mono">分 時 日 月 星期</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增排程任務</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input className="font-mono" placeholder="0 3 * * *" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} required />
            <Input placeholder="要執行的指令" value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} required />
            <Input placeholder="標籤（唯一）" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            <Button type="submit">新增任務</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標籤</TableHead>
              <TableHead>排程與指令</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{j.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{j.schedule_and_cmd}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => remove(j.label)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  尚無排程任務。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
