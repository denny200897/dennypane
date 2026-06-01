"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Folder, FileText, FolderPlus, Trash2, Save, ChevronRight } from "lucide-react";

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

  const load = useCallback((p: string) => {
    api
      .listFiles(p)
      .then((d) => {
        setEntries(d.entries);
        setPath(d.path);
      })
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const crumbs = path ? path.split("/") : [];

  async function open(entry: any) {
    if (entry.is_dir) load(entry.path);
    else {
      try {
        setEditing(await api.readFile(entry.path));
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  }

  async function save() {
    if (!editing) return;
    await api.writeFile(editing.path, editing.content);
    toast.success("Saved");
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
    toast.success("Deleted");
    load(path);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">File Manager</h1>
        <Button variant="outline" size="sm" onClick={makeDir}>
          <FolderPlus className="size-4" /> New folder
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button onClick={() => load("")} className="rounded px-1.5 py-0.5 hover:text-foreground">
          root
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <button
              onClick={() => load(crumbs.slice(0, i + 1).join("/"))}
              className="rounded px-1.5 py-0.5 hover:text-foreground"
            >
              {c}
            </button>
          </span>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.path}>
                <TableCell className="cursor-pointer" onClick={() => open(e)}>
                  <span className="flex items-center gap-2.5">
                    {e.is_dir ? (
                      <Folder className="size-4 text-primary" />
                    ) : (
                      <FileText className="size-4 text-muted-foreground" />
                    )}
                    {e.name}
                  </span>
                </TableCell>
                <TableCell className="w-24 text-right text-muted-foreground">
                  {e.is_dir ? "" : bytes(e.size)}
                </TableCell>
                <TableCell className="w-12 text-right">
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => remove(e)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell className="py-10 text-center text-muted-foreground">Empty folder.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4 font-mono text-sm">
              {editing?.path}
              <Button size="sm" onClick={save}>
                <Save className="size-4" /> Save
              </Button>
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="h-[60vh] w-full resize-none rounded-lg bg-black/40 p-4 font-mono text-xs text-foreground outline-none ring-1 ring-border focus:ring-primary"
            value={editing?.content ?? ""}
            onChange={(e) => editing && setEditing({ ...editing, content: e.target.value })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
