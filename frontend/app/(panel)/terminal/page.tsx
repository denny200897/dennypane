"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/api";
import "@xterm/xterm/css/xterm.css";

// Backend websocket origin. In dev the API runs on :8000; override via env.
function wsBase() {
  if (process.env.NEXT_PUBLIC_BACKEND_WS) return process.env.NEXT_PUBLIC_BACKEND_WS;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.hostname}:8000`;
}

export default function TerminalPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("connecting…");

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
      ws = new WebSocket(`${wsBase()}/api/terminal/ws?token=${token}`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("connected");
        ws.send(`\x00resize:${term.rows}:${term.cols}`);
      };
      ws.onmessage = (e) => {
        if (typeof e.data === "string") term.write(e.data);
        else term.write(new Uint8Array(e.data));
      };
      ws.onclose = () => setStatus("disconnected");
      ws.onerror = () => setStatus("connection error (is the backend on :8000?)");

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
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Terminal</h1>
        <span className="text-xs text-white/50">{status}</span>
      </div>
      <div ref={ref} className="flex-1 min-h-[60vh] bg-[#0b0f17] border border-white/10 rounded-xl p-2" />
    </div>
  );
}
