"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import "@xterm/xterm/css/xterm.css";

// Backend websocket origin.
// - If NEXT_PUBLIC_BACKEND_WS is set (dev points it at :8000), use it.
// - Otherwise use the same origin, so it works behind a reverse proxy that
//   forwards /api/* (including the WebSocket upgrade) to the backend.
function wsBase() {
  if (process.env.NEXT_PUBLIC_BACKEND_WS) return process.env.NEXT_PUBLIC_BACKEND_WS;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}`;
}

export default function TerminalPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("連線中…");

  useEffect(() => {
    let term: any;
    let ws: WebSocket;
    let dispose = () => {};

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (!ref.current) return;

      term = new Terminal({
        cursorBlink: true,
        fontFamily: "ui-monospace, monospace",
        fontSize: 13,
        theme: { background: "#0b0f17", foreground: "#e6edf3" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(ref.current);
      fit.fit();

      const token = getToken();
      // Token is sent as the first WS message (not in the URL) so it can't leak
      // into reverse-proxy access logs or browser history.
      ws = new WebSocket(`${wsBase()}/api/terminal/ws`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("已連線");
        ws.send(`\x00auth:${token ?? ""}`);
        ws.send(`\x00resize:${term.rows}:${term.cols}`);
      };
      ws.onmessage = (e) => {
        if (typeof e.data === "string") term.write(e.data);
        else term.write(new Uint8Array(e.data));
      };
      ws.onclose = () => setStatus("已斷線");
      ws.onerror = () => setStatus("連線錯誤（後端是否在 :8000 執行？）");

      term.onData((d: string) => ws.readyState === WebSocket.OPEN && ws.send(d));

      const onResize = () => {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) ws.send(`\x00resize:${term.rows}:${term.cols}`);
      };
      window.addEventListener("resize", onResize);
      dispose = () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      dispose();
      ws?.close();
      term?.dispose();
    };
  }, []);

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">終端機</h1>
          <p className="text-sm text-muted-foreground">主機上的互動式 Shell</p>
        </div>
        <Badge variant={status === "已連線" ? "default" : "secondary"}>
          <span
            className={`mr-1 inline-block size-1.5 rounded-full ${
              status === "已連線" ? "bg-primary-foreground" : "bg-muted-foreground"
            }`}
          />
          {status}
        </Badge>
      </div>
      <div ref={ref} className="min-h-[62vh] flex-1 rounded-xl border border-border bg-[#0d121c] p-3 shadow-inner" />
    </div>
  );
}
