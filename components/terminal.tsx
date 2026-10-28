"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import type { LogLine } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<LogLine["kind"], string> = {
  info: "text-[#9aa0b4]",
  tool: "text-[#67d4e8]",
  text: "text-[#d7dae3]",
  think: "text-[#7d8299] italic",
  stderr: "text-[#e8b04a]",
  error: "text-[#ff7a7a]",
  result: "text-[#6fdc9c]",
};

const TAG_COLORS = ["#b8a2ff", "#ffb38a", "#8fd4ff", "#f59ad6", "#a6e3a1", "#f9e2af"];
const tagColor = (id: number | null) => (id == null ? "#6b7085" : TAG_COLORS[id % TAG_COLORS.length]);

/** Live, append-only view of one Autopilot run's log (polls ?after=<last id>). */
export function Terminal({ runId, live, itemFilter, className }: {
  runId: number; live: boolean; itemFilter: number | null; className?: string;
}) {
  const [lines, setLines] = React.useState<LogLine[]>([]);
  const lastId = React.useRef(0);
  const box = React.useRef<HTMLDivElement>(null);
  const [follow, setFollow] = React.useState(true);

  React.useEffect(() => {
    setLines([]);
    lastId.current = 0;
  }, [runId]);

  React.useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await api<{ lines: LogLine[]; status: string }>(`/api/autopilot/runs/${runId}/log?after=${lastId.current}`);
        if (stop) return;
        if (r.lines.length) {
          lastId.current = r.lines[r.lines.length - 1].id;
          setLines((prev) => [...prev, ...r.lines]);
        }
        const more = r.lines.length === 1000 || r.status === "running" || r.status === "queued";
        if (more) timer = setTimeout(tick, r.lines.length === 1000 ? 50 : 1000);
      } catch {
        if (!stop) timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [runId, live]);

  const shown = itemFilter == null ? lines : lines.filter((l) => l.item_id === itemFilter || l.item_id == null);

  React.useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown.length, follow]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  return (
    <div className={cn("relative flex min-h-0 flex-col overflow-hidden rounded-lg bg-term text-[12.5px] leading-[1.6] shadow-inner", className)}>
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 font-sans text-xs text-[#8b90a5]">
        <span className="size-2.5 rounded-full bg-[#ff6159]/80" />
        <span className="size-2.5 rounded-full bg-[#ffbd2e]/80" />
        <span className="size-2.5 rounded-full bg-[#28c941]/80" />
        <span className="ml-2">run #{runId}{itemFilter != null ? ", one lead" : ", all leads"}</span>
        {live && <span className="ml-auto inline-flex items-center gap-1.5 text-[#6fdc9c]"><span className="size-1.5 animate-pulse rounded-full bg-[#6fdc9c]" />live</span>}
      </div>
      <div ref={box} onScroll={onScroll} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono">
        {shown.length === 0 && <div className="text-[#6b7085]">Waiting for output…</div>}
        {shown.map((l) => (
          <div key={l.id} className="flex gap-3 whitespace-pre-wrap break-words">
            <span className="shrink-0 select-none text-[#4f546a]">{l.ts}</span>
            {itemFilter == null && l.company_name && (
              <span className="w-28 shrink-0 truncate" style={{ color: tagColor(l.item_id) }} title={l.company_name}>{l.company_name}</span>
            )}
            {itemFilter == null && !l.company_name && <span className="w-28 shrink-0 text-[#4f546a]">autopilot</span>}
            <span className={cn("min-w-0", KIND_STYLE[l.kind] || KIND_STYLE.text)}>{l.line}</span>
          </div>
        ))}
        {live && <div className="mt-1 h-4 w-2 animate-pulse bg-[#9aa0b4]/70" />}
      </div>
      {!follow && (
        <button type="button" onClick={() => setFollow(true)}
          className="absolute bottom-3 right-4 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-sans text-xs text-white backdrop-blur hover:bg-white/20">
          <ArrowDown className="size-3" />Jump to latest
        </button>
      )}
    </div>
  );
}
