"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Globe, FileCode, Newspaper, ExternalLink, Lock, Trash2, Loader2 } from "lucide-react";

const KINDS = [
  { id: "static", label: "Static site", desc: "nginx serving HTML/CSS/JS", icon: FileCode },
  { id: "wordpress", label: "WordPress", desc: "WordPress + MariaDB", icon: Globe },
  { id: "ghost", label: "Ghost blog", desc: "Ghost CMS", icon: Newspaper },
];

export default function SitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [domain, setDomain] = useState("");
  const [kind, setKind] = useState("static");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.sites().then(setSites).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createSite({ domain, kind, admin_email: email || null });
      toast.success(`Deploying ${domain}…`);
      setDomain("");
      setEmail("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this site and its container(s)?")) return;
    try {
      await api.deleteSite(id);
      toast.success("Site deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function setupProxy(id: number, ssl: boolean) {
    try {
      const res: any = await api.applyProxy(id, { enable_ssl: ssl, email: email || null });
      if (res.applied) toast.success(ssl ? "Proxy + SSL requested" : "Reverse proxy applied");
      else toast.info(`Config generated (not applied: ${res.reason})`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sites &amp; Apps</h1>
        <p className="text-sm text-muted-foreground">Deploy a site or app in one click</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {KINDS.map((k) => {
                const Icon = k.icon;
                return (
                  <button
                    type="button"
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      kind === k.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        kind === k.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{k.label}</div>
                      <div className="text-xs text-muted-foreground">{k.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input placeholder="domain (e.g. blog.example.com)" value={domain} onChange={(e) => setDomain(e.target.value)} required />
              {kind !== "static" && (
                <Input placeholder="admin email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
              <Button type="submit" disabled={busy} className="sm:w-32">
                {busy && <Loader2 className="animate-spin" />}
                {busy ? "Deploying…" : "Deploy"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sites.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{s.domain}</CardTitle>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.kind}</span>
              </div>
              <Badge variant="default">{s.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.upstream_port > 0 && (
                <a
                  href={`http://localhost:${s.upstream_port}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  localhost:{s.upstream_port} <ExternalLink className="size-3.5" />
                </a>
              )}
              <div className="flex items-center gap-1 pt-1">
                <Button variant="outline" size="sm" onClick={() => setupProxy(s.id, false)}>
                  <Globe className="size-3.5" /> Proxy
                </Button>
                <Button variant="outline" size="sm" onClick={() => setupProxy(s.id, true)}>
                  <Lock className="size-3.5" /> SSL
                </Button>
                {s.ssl_enabled && (
                  <Badge variant="secondary" className="text-primary">
                    <Lock className="size-3" /> SSL
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="ml-auto text-destructive hover:text-destructive" onClick={() => remove(s.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sites.length === 0 && (
          <p className="text-sm text-muted-foreground">No sites yet. Deploy one above.</p>
        )}
      </div>
    </div>
  );
}
